"""Configuration API round trips with real state merging and no database side effects."""

import ast
import os
from pathlib import Path
from typing import Any, Dict
from unittest.mock import Mock

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from mem0.configs.base import MemoryConfig
from server import server_state


@pytest.mark.parametrize("key,expected", [("test-key", "dashscope"), ("", "openai")])
def test_default_models_follow_provider_with_only_shared_credentials(monkeypatch, key, expected):
    for name in (
        "MEM0_DEFAULT_LLM_PROVIDER",
        "MEM0_DEFAULT_EMBEDDER_PROVIDER",
        "MEM0_DEFAULT_LLM_MODEL",
        "MEM0_DEFAULT_EMBEDDER_MODEL",
    ):
        monkeypatch.setenv(name, "")
    monkeypatch.setenv("DASHSCOPE_API_KEY", key)
    names = {"DEFAULT_LLM_PROVIDER", "DEFAULT_EMBEDDER_PROVIDER", "DEFAULT_LLM_MODEL", "DEFAULT_EMBEDDER_MODEL"}
    source = ast.parse((Path(__file__).parents[1] / "server/main.py").read_text())
    nodes = [
        node
        for node in source.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id in names for target in node.targets)
    ]
    values = {"os": os}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "server/main.py", "exec"), values)
    assert values["DEFAULT_LLM_PROVIDER"] == values["DEFAULT_EMBEDDER_PROVIDER"] == expected
    if expected == "dashscope":
        assert values["DEFAULT_LLM_MODEL"] == "qwen3.8-flash"
        assert values["DEFAULT_EMBEDDER_MODEL"] == "qwen3.7-text-embedding-flash"
    else:
        assert values["DEFAULT_LLM_MODEL"] == "gpt-5-mini"
        assert values["DEFAULT_EMBEDDER_MODEL"] == "text-embedding-3-small"


@pytest.fixture
def config_client(monkeypatch):
    initial = {
        "llm": {"provider": "openai", "config": {"api_key": "old-provider-key", "openai_base_url": "old"}},
        "embedder": {"provider": "openai", "config": {}},
        "reranker": None,
    }
    monkeypatch.setattr(server_state, "_current_config", initial)
    monkeypatch.setattr(server_state, "_memory_instance", Mock())
    saved = {}
    monkeypatch.setattr(server_state, "_load_overrides", lambda: saved)
    monkeypatch.setattr(server_state, "_save_overrides", lambda config: saved.update(config))

    def create_memory(config):
        MemoryConfig(**config)
        return Mock()

    monkeypatch.setattr(server_state.Memory, "from_config", create_memory)
    source = ast.parse((Path(__file__).parents[1] / "server/main.py").read_text())
    assignments = {
        "BUNDLED_LLM_PROVIDERS",
        "BUNDLED_EMBEDDER_PROVIDERS",
        "BUNDLED_RERANKER_PROVIDERS",
        "SENSITIVE_CONFIG_KEYS",
    }
    functions = {"_validate_bundled_providers", "_redact_config", "get_config", "set_config", "list_bundled_providers"}
    nodes = [
        node
        for node in source.body
        if getattr(node, "name", "") in functions
        or (isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in assignments for t in node.targets))
    ]
    app = FastAPI()
    namespace = dict(
        Any=Any,
        Dict=Dict,
        Depends=Depends,
        HTTPException=HTTPException,
        app=app,
        verify_auth=lambda: None,
        require_admin=lambda: None,
        get_current_config=server_state.get_current_config,
        update_config=server_state.update_config,
    )
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "server/main.py", "exec"), namespace)
    return TestClient(app), saved


def test_dashboard_can_discover_all_dashscope_providers(config_client):
    client, _ = config_client
    response = client.get("/configure/providers")
    assert response.status_code == 200
    assert all("dashscope" in response.json()[kind] for kind in ("llm", "embedder", "reranker"))


def test_dashboard_saves_and_disables_reranker_without_leaking_keys(config_client):
    client, saved = config_client
    config = {
        "llm": {"provider": "dashscope", "config": {"model": "qwen3.8-flash"}},
        "embedder": {"provider": "dashscope", "config": {"model": "qwen3.7-text-embedding-flash"}},
        "reranker": {"provider": "dashscope", "config": {"model": "qwen3.7-text-rerank", "api_key": "new-key"}},
    }
    assert client.post("/configure", json=config).status_code == 200
    response = client.get("/configure")
    assert response.status_code == 200
    assert "new-key" not in response.text
    assert "old-provider-key" not in response.text
    assert response.json()["reranker"]["config"]["api_key"] == "[redacted]"
    assert "openai_base_url" not in response.json()["llm"]["config"]
    assert saved["reranker"]["provider"] == "dashscope"
    assert client.post("/configure", json={"reranker": None}).status_code == 200
    assert client.get("/configure").json()["reranker"] is None
    assert saved["reranker"] is None


def test_unbundled_reranker_is_rejected(config_client):
    client, _ = config_client
    assert client.post("/configure", json={"reranker": {"provider": "unknown", "config": {}}}).status_code == 400


def test_invalid_config_returns_400_and_keeps_previous_state(config_client, monkeypatch):
    client, _ = config_client
    initial = client.get("/configure").json()

    def invalid(config):
        raise TypeError("private-api-key")

    monkeypatch.setattr(server_state.Memory, "from_config", invalid)
    response = client.post("/configure", json={"reranker": {"provider": "dashscope", "config": {}}})
    assert response.status_code == 400
    assert "private-api-key" not in response.text
    assert client.get("/configure").json() == initial

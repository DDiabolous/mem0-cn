"""Exercise the actual search route without starting database/auth/telemetry globals."""

import ast
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from unittest.mock import Mock

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field


@pytest.fixture
def search_client():
    source = ast.parse((Path(__file__).parents[1] / "server/main.py").read_text())
    nodes = [n for n in source.body if getattr(n, "name", "") in {"SearchRequest", "search_memories"}]
    memory = Mock()
    memory.search.return_value = {"results": [{"id": str(i)} for i in range(20)]}
    app = FastAPI()
    namespace = dict(
        BaseModel=BaseModel,
        Field=Field,
        Optional=Optional,
        Dict=Dict,
        Any=Any,
        Depends=Depends,
        HTTPException=HTTPException,
        app=app,
        logging=logging,
        verify_auth=lambda: None,
        get_memory_instance=lambda: memory,
        upstream_error=lambda: HTTPException(status_code=502),
    )
    exec(compile(ast.Module(body=nodes, type_ignores=[]), "server/main.py", "exec"), namespace)
    return TestClient(app), memory


def test_candidate_pool_and_user_device_filters(search_client):
    client, memory = search_client
    filters = {"user_id": "u", "agent_id": "device"}
    response = client.post(
        "/search", json={"query": "q", "filters": filters, "rerank": True, "candidate_k": 20, "top_k": 5}
    )
    assert response.status_code == 200
    assert len(response.json()["results"]) == 5
    memory.search.assert_called_once_with(query="q", filters=filters, top_k=20, rerank=True)


@pytest.mark.parametrize(
    "body,status",
    [
        ({"candidate_k": 20}, 400),
        ({"rerank": True, "candidate_k": 2, "top_k": 5}, 400),
        ({"rerank": True, "candidate_k": 101}, 422),
    ],
)
def test_invalid_candidate_count(search_client, body, status):
    client, memory = search_client
    assert client.post("/search", json={"query": "q", **body}).status_code == status
    memory.search.assert_not_called()


def test_missing_reranker_is_explicit(search_client):
    client, memory = search_client
    memory.reranker = None
    assert client.post("/search", json={"query": "q", "rerank": True}).status_code == 400


def test_normal_search_keeps_existing_behavior(search_client):
    client, memory = search_client
    assert client.post("/search", json={"query": "q", "top_k": 5}).status_code == 200
    memory.search.assert_called_once_with(query="q", filters={}, top_k=5)

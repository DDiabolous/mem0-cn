from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from mem0.configs.base import MemoryConfig
from mem0.utils.dashscope import dashscope_base_url
from mem0.utils.factory import EmbedderFactory, LlmFactory, RerankerFactory


@pytest.fixture(autouse=True)
def dashscope_env(monkeypatch):
    monkeypatch.setenv("DASHSCOPE_API_KEY", "dashscope-key")
    monkeypatch.setenv("DASHSCOPE_BASE_URL", "https://workspace.example.com/api/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "other-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://other.example.com/v1")
    monkeypatch.setenv("OPENROUTER_API_KEY", "other-router-key")


@pytest.mark.parametrize("suffix", ["", "/", "/api/v1/", "/compatible-mode/v1"])
def test_shared_base_url_normalizes_both_protocols(suffix):
    root = "https://workspace.example.com"
    assert dashscope_base_url(root + suffix) == root + "/compatible-mode/v1"
    assert dashscope_base_url(root + suffix, native=True) == root + "/api/v1"


def test_llm_uses_dashscope_credentials_and_json_mode():
    with patch("mem0.llms.dashscope.OpenAI") as client:
        client.return_value.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"memory": []}'))],
        )
        llm = LlmFactory.create("dashscope", {"model": "qwen3.8-flash"})
        assert (
            llm.generate_response([{"role": "user", "content": "你好"}], response_format={"type": "json_object"})
            == '{"memory": []}'
        )
        client.assert_called_once_with(
            api_key="dashscope-key", base_url="https://workspace.example.com/compatible-mode/v1"
        )
        params = client.return_value.chat.completions.create.call_args.kwargs
        assert params["extra_body"] == {"enable_thinking": False}
        assert params["response_format"] == {"type": "json_object"}
        assert "models" not in params


def test_explicit_config_overrides_environment():
    with patch("mem0.llms.dashscope.OpenAI") as client:
        LlmFactory.create("dashscope", {"api_key": "override", "base_url": "https://explicit.example.com"})
        client.assert_called_once_with(api_key="override", base_url="https://explicit.example.com/compatible-mode/v1")


def test_typed_config_retains_provider_specific_url():
    from mem0.configs.llms.dashscope import DashScopeConfig

    with patch("mem0.llms.dashscope.OpenAI") as client:
        LlmFactory.create("dashscope", DashScopeConfig(base_url="https://typed.example.com", enable_thinking=True))
        assert client.call_args.kwargs["base_url"] == "https://typed.example.com/compatible-mode/v1"


def test_embedding_batch_preserves_order_and_api_batch_limit():
    with patch("mem0.embeddings.dashscope.OpenAI") as client:

        def embeddings(**kwargs):
            return SimpleNamespace(
                data=[
                    SimpleNamespace(index=i, embedding=[float(text)])
                    for i, text in reversed(list(enumerate(kwargs["input"])))
                ]
            )

        client.return_value.embeddings.create.side_effect = embeddings
        embedder = EmbedderFactory.create("dashscope", {"embedding_dims": 1024}, None)
        assert embedder.embed_batch([str(i) for i in range(23)]) == [[float(i)] for i in range(23)]
        calls = client.return_value.embeddings.create.call_args_list
        assert [len(call.kwargs["input"]) for call in calls] == [10, 10, 3]
        assert all(call.kwargs["dimensions"] == 1024 for call in calls)
        client.assert_called_once_with(
            api_key="dashscope-key", base_url="https://workspace.example.com/compatible-mode/v1"
        )


def test_reranker_uses_same_key_and_native_endpoint():
    reranker = RerankerFactory.create("dashscope", {})
    assert reranker.api_key == "dashscope-key"
    assert reranker.url == "https://workspace.example.com/api/v1/services/rerank/text-rerank/text-rerank"
    reranker.client.close()


def test_memory_config_accepts_dashscope_for_all_models():
    config = MemoryConfig(
        llm={"provider": "dashscope", "config": {}},
        embedder={"provider": "dashscope", "config": {}},
        reranker={"provider": "dashscope", "config": {}},
    )
    assert config.llm.provider == config.embedder.provider == config.reranker.provider == "dashscope"


def test_new_providers_do_not_use_openai_key_when_dashscope_key_missing(monkeypatch):
    monkeypatch.delenv("DASHSCOPE_API_KEY")
    with pytest.raises(ValueError, match="DASHSCOPE_API_KEY"):
        LlmFactory.create("dashscope", {})
    with pytest.raises(ValueError, match="DASHSCOPE_API_KEY"):
        EmbedderFactory.create("dashscope", {}, None)


def test_provider_switch_drops_incompatible_config():
    from server.server_state import _merge_config

    merged = _merge_config(
        {"llm": {"provider": "openai", "config": {"api_key": "old", "openai_base_url": "old", "model": "old"}}},
        {"llm": {"provider": "dashscope", "config": {"model": "qwen3.8-flash"}}},
    )
    assert merged["llm"]["config"] == {"model": "qwen3.8-flash"}


def test_invalid_config_does_not_replace_running_config(monkeypatch):
    from server import server_state

    current = {"llm": {"provider": "openai", "config": {}}}
    monkeypatch.setattr(server_state, "_current_config", current)
    previous = Mock()
    monkeypatch.setattr(server_state, "_memory_instance", previous)
    with patch.object(server_state.Memory, "from_config", side_effect=ValueError("bad provider")):
        with pytest.raises(ValueError):
            server_state.update_config({"llm": {"provider": "invalid"}})
    assert server_state.get_current_config() == current
    assert server_state.get_memory_instance() is previous


def test_disable_reranker_is_persisted_and_restored(monkeypatch):
    from server import server_state

    default = {"reranker": {"provider": "dashscope", "config": {}}}
    monkeypatch.setattr(server_state, "_current_config", default)
    monkeypatch.setattr(server_state, "_memory_instance", Mock())
    saved = {}
    monkeypatch.setattr(server_state, "_load_overrides", lambda: saved)
    monkeypatch.setattr(server_state, "_save_overrides", lambda config: saved.update(config))
    with patch.object(server_state.Memory, "from_config", return_value=Mock()) as factory:
        server_state.update_config({"reranker": None})
        assert saved["reranker"] is None
        server_state.initialize_state(default)
        assert factory.call_args.args[0]["reranker"] is None


def test_same_provider_partial_update_preserves_saved_key():
    from server.server_state import _merge_config

    merged = _merge_config(
        {"reranker": {"provider": "dashscope", "config": {"api_key": "keep", "model": "old"}}},
        {"reranker": {"provider": "dashscope", "config": {"model": "new"}}},
    )
    assert merged["reranker"]["config"] == {"api_key": "keep", "model": "new"}

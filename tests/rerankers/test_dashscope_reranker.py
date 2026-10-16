from unittest.mock import Mock

import httpx
import pytest

from mem0.configs.rerankers.dashscope import DashScopeRerankerConfig
from mem0.utils.factory import RerankerFactory


@pytest.fixture
def reranker(monkeypatch):
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("DASHSCOPE_RERANK_BASE_URL", "https://example.com/api/v1/")
    instance = RerankerFactory.create("dashscope", {"timeout": 2, "instruct": "Match the question"})
    yield instance
    instance.client.close()


def test_reorders_without_losing_identity_or_mutating_input(reranker):
    documents = [
        {"id": "a", "memory": "量子计算", "user_id": "u", "agent_id": "d", "score": 0.8},
        {"id": "b", "memory": "文本排序", "metadata": {"category": "search"}, "score": 0.7},
    ]
    response = httpx.Response(
        200,
        request=httpx.Request("POST", reranker.url),
        json={
            "output": {"results": [{"index": 1, "relevance_score": 0.99}]},
        },
    )
    reranker.client.post = Mock(return_value=response)
    result = reranker.rerank("排序", documents, top_k=1)
    assert result == [{**documents[1], "rerank_score": 0.99}]
    assert "rerank_score" not in documents[1]
    kwargs = reranker.client.post.call_args.kwargs
    assert kwargs["headers"]["Authorization"] == "Bearer test-key"
    assert kwargs["json"]["input"]["documents"] == ["量子计算", "文本排序"]
    assert kwargs["json"]["parameters"] == {"top_n": 1, "instruct": "Match the question"}


@pytest.mark.parametrize(
    "results", [[], [{"index": 9, "relevance_score": 0.9}], [{"index": 0, "relevance_score": "NaN"}]]
)
def test_malformed_response_falls_back(reranker, results):
    reranker.client.post = Mock(
        return_value=httpx.Response(
            200,
            request=httpx.Request("POST", reranker.url),
            json={"output": {"results": results}},
        )
    )
    documents = [{"id": "a", "memory": "one"}, {"id": "b", "memory": "two"}]
    assert reranker.rerank("q", documents, top_k=1) == documents[:1]


def test_timeout_returns_original_order(reranker):
    reranker.client.post = Mock(side_effect=httpx.ReadTimeout("timeout"))
    documents = [{"id": "a", "memory": "one"}, {"id": "b", "memory": "two"}]
    assert reranker.rerank("q", documents, top_k=1) == documents[:1]


def test_http_error_does_not_expose_private_response(reranker, caplog):
    reranker.client.post = Mock(
        return_value=httpx.Response(
            429,
            request=httpx.Request("POST", reranker.url),
            text="private document text",
        )
    )
    documents = [{"id": "a", "memory": "one"}]
    assert reranker.rerank("q", documents) == documents
    assert "private document text" not in caplog.text


def test_duplicate_indices_fall_back_without_duplicating_memory(reranker):
    reranker.client.post = Mock(
        return_value=httpx.Response(
            200,
            request=httpx.Request("POST", reranker.url),
            json={
                "output": {
                    "results": [
                        {"index": 1, "relevance_score": 0.9},
                        {"index": 1, "relevance_score": 0.8},
                    ]
                }
            },
        )
    )
    documents = [{"id": "a", "memory": "one"}, {"id": "b", "memory": "two"}]
    assert reranker.rerank("q", documents) == documents


def test_empty_documents_do_not_call_api(reranker):
    reranker.client.post = Mock()
    assert reranker.rerank("q", []) == []
    reranker.client.post.assert_not_called()


def test_missing_credentials_fail_early(monkeypatch):
    from mem0.reranker.dashscope_reranker import DashScopeReranker

    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    with pytest.raises(ValueError, match="requires an API key"):
        DashScopeReranker(DashScopeRerankerConfig(base_url="https://example.com/api/v1"))

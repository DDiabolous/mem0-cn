import logging
import math
import os
from typing import Any, Dict, List

import httpx

from mem0.reranker.base import BaseReranker
from mem0.utils.dashscope import dashscope_base_url

logger = logging.getLogger(__name__)


class DashScopeReranker(BaseReranker):
    """Rerank through DashScope's native HTTP API, preserving memory identities."""

    def __init__(self, config):
        self.config = config
        self.api_key = config.api_key or os.getenv("DASHSCOPE_API_KEY") or os.getenv("OPENAI_API_KEY")
        # Keep the old variable and key fallback for existing reranker-only deployments.
        base_url = config.base_url or os.getenv("DASHSCOPE_BASE_URL") or os.getenv("DASHSCOPE_RERANK_BASE_URL")
        if not self.api_key:
            raise ValueError("DashScope reranker requires an API key; set DASHSCOPE_API_KEY")
        self.url = dashscope_base_url(base_url, native=True) + "/services/rerank/text-rerank/text-rerank"
        self.client = httpx.Client(timeout=config.timeout)

    def rerank(self, query: str, documents: List[Dict[str, Any]], top_k: int = None) -> List[Dict[str, Any]]:
        if not documents:
            return []
        limit = min(top_k if top_k is not None else (self.config.top_k or len(documents)), len(documents))
        if limit <= 0:
            return []
        texts = [str(doc.get("memory", doc.get("text", doc.get("content", "")))) for doc in documents]
        parameters = {"top_n": limit}
        if self.config.instruct:
            parameters["instruct"] = self.config.instruct
        try:
            response = self.client.post(
                self.url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.config.model,
                    "input": {"query": query, "documents": texts},
                    "parameters": parameters,
                },
            )
            response.raise_for_status()
            results = response.json()["output"]["results"]
            if not isinstance(results, list) or len(results) != limit:
                raise ValueError("Incomplete reranker response")
            ranked = []
            seen = set()
            for result in results:
                index = result["index"]
                score = float(result["relevance_score"])
                if type(index) is not int or not 0 <= index < len(documents) or index in seen:
                    raise ValueError("Invalid reranker document index")
                if not math.isfinite(score):
                    raise ValueError("Invalid reranker score")
                seen.add(index)
                ranked.append({**documents[index], "rerank_score": score})
            return sorted(ranked, key=lambda doc: doc["rerank_score"], reverse=True)
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            # Do not log response bodies: they may contain private memory text.
            logger.warning("DashScope reranking failed; returning original retrieval order")
            return [dict(doc) for doc in documents[:limit]]

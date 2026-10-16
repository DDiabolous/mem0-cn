from typing import Optional

from pydantic import Field

from mem0.configs.rerankers.base import BaseRerankerConfig


class DashScopeRerankerConfig(BaseRerankerConfig):
    model: str = "qwen3.7-text-rerank"
    base_url: Optional[str] = Field(default=None, description="Shared DashScope API base URL")
    timeout: float = Field(default=15.0, gt=0, description="HTTP timeout in seconds")
    instruct: Optional[str] = None

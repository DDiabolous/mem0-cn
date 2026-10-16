from openai import OpenAI

from mem0.configs.embeddings.dashscope import DashScopeEmbedderConfig
from mem0.embeddings.base import EmbeddingBase
from mem0.embeddings.openai import OpenAIEmbedding
from mem0.utils.dashscope import dashscope_api_key, dashscope_base_url


class DashScopeEmbedding(OpenAIEmbedding):
    def __init__(self, config=None):
        if config is None:
            config = DashScopeEmbedderConfig()
        EmbeddingBase.__init__(self, config)
        self.config.model = self.config.model or "qwen3.7-text-embedding-flash"
        self.config.embedding_dims = self.config.embedding_dims or 1024
        self._pass_dimensions_to_api = True
        self.client = OpenAI(
            api_key=dashscope_api_key(self.config.api_key),
            base_url=dashscope_base_url(self.config.base_url),
        )

    def embed_batch(self, texts, memory_action="add"):
        # Ten inputs also works with text-embedding-v3/v4, whose batch limit is lower.
        result = []
        for start in range(0, len(texts), 10):
            result.extend(super().embed_batch(texts[start : start + 10], memory_action))
        return result

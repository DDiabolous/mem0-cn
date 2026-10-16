from mem0.configs.embeddings.base import BaseEmbedderConfig


class DashScopeEmbedderConfig(BaseEmbedderConfig):
    def __init__(self, base_url=None, **kwargs):
        super().__init__(**kwargs)
        self.base_url = base_url

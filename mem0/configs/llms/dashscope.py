from mem0.configs.llms.openai import OpenAIConfig


class DashScopeConfig(OpenAIConfig):
    def __init__(self, base_url=None, enable_thinking=False, **kwargs):
        super().__init__(**kwargs)
        self.base_url = base_url
        self.enable_thinking = enable_thinking

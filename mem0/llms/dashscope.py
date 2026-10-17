from openai import OpenAI

from mem0.configs.llms.dashscope import DashScopeConfig
from mem0.llms.base import LLMBase
from mem0.llms.openai import OpenAILLM
from mem0.utils.dashscope import dashscope_api_key, dashscope_base_url


class DashScopeLLM(OpenAILLM):
    """Qwen chat via DashScope's OpenAI-compatible API with independent credentials."""

    def __init__(self, config=None):
        if config is None:
            config = DashScopeConfig()
        elif isinstance(config, dict):
            config = DashScopeConfig(**config)
        LLMBase.__init__(self, config)
        self.config.model = self.config.model or "qwen3.8-flash"
        self.client = OpenAI(
            api_key=dashscope_api_key(self.config.api_key),
            base_url=dashscope_base_url(self.config.base_url),
        )

    def generate_response(self, messages, response_format=None, tools=None, tool_choice="auto", **kwargs):
        params = self._get_supported_params(messages=messages, **kwargs)
        params.update({"model": self.config.model, "messages": messages})
        params["extra_body"] = {**params.get("extra_body", {}), "enable_thinking": self.config.enable_thinking}
        if response_format:
            params["response_format"] = response_format
        if tools:
            params.update({"tools": tools, "tool_choice": tool_choice})
        response = self.client.chat.completions.create(**params)
        return self._parse_response(response, tools)

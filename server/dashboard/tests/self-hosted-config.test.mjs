import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProviderConfig,
  getEffectiveConfig,
} from "../src/utils/self-hosted-config.ts";

test("DashScope model saves without overwriting a stored secret", () => {
  const payload = JSON.parse(
    JSON.stringify(
      buildProviderConfig({
        provider: "dashscope",
        model: " qwen3.7-text-rerank ",
        apiKey: "",
      }),
    ),
  );
  assert.deepEqual(payload, {
    provider: "dashscope",
    config: { model: "qwen3.7-text-rerank", base_url: null },
  });
});

test("DashScope keeps credential overrides but uses the server base URL", () => {
  const payload = buildProviderConfig({
    provider: "dashscope",
    model: "qwen3.8-flash",
    apiKey: "new-key",
  });
  assert.equal(payload.config.api_key, "new-key");
  assert.equal(payload.config.base_url, null);
});

test("other providers do not receive DashScope-specific fields", () => {
  const payload = buildProviderConfig({
    provider: "openai",
    model: "gpt-5-mini",
  });
  assert.equal("base_url" in payload.config, false);
});

test("effective config includes the reranker, including disabled state", () => {
  const config = { llm: { provider: "dashscope" }, reranker: null };
  assert.deepEqual(getEffectiveConfig({ effective_config: config }), config);
  assert.deepEqual(getEffectiveConfig({ config }), config);
  assert.deepEqual(getEffectiveConfig(config), config);
  assert.equal(getEffectiveConfig(null), null);
});

type ProviderConfig = {
  provider?: string;
  config?: {
    model?: string;
    api_key?: string;
  };
};

export type EffectiveConfig = {
  llm?: ProviderConfig;
  embedder?: ProviderConfig;
  reranker?: ProviderConfig | null;
};

export const getEffectiveConfig = (data: unknown): EffectiveConfig | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  return (
    (record.effective_config as EffectiveConfig) ||
    (record.config as EffectiveConfig) ||
    (record as EffectiveConfig)
  );
};

export const buildProviderConfig = ({
  provider,
  model,
  apiKey,
}: {
  provider: string;
  model: string;
  apiKey?: string;
}) => {
  if (!provider) {
    return undefined;
  }

  return {
    provider,
    config: {
      model: model.trim() || undefined,
      api_key: apiKey || undefined,
      // Clear any previously saved override so DashScope uses the server environment.
      ...(provider === "dashscope" ? { base_url: null } : {}),
    },
  };
};

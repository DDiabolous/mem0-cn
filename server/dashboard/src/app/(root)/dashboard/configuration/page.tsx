"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { UpgradeBanner } from "@/components/self-hosted/upgrade-banner";
import { getErrorMessage } from "@/lib/error-message";
import { api } from "@/utils/api";
import { MEMORY_ENDPOINTS } from "@/utils/api-endpoints";
import {
  buildProviderConfig,
  getEffectiveConfig,
  type EffectiveConfig,
} from "@/utils/self-hosted-config";
import { useAuth } from "@/hooks/use-auth";
import { useApiQuery } from "@/hooks/use-api-query";

type BundledProviders = {
  llm: string[];
  embedder: string[];
  reranker: string[];
};

type ModelForm = {
  provider: string;
  model: string;
  apiKey: string;
};

const emptyModel: ModelForm = {
  provider: "",
  model: "",
  apiKey: "",
};
const dashscopeModels = {
  llm: "qwen3.6-flash",
  embedder: "qwen3.7-text-embedding-flash",
  reranker: "qwen3.7-text-rerank",
};

function modelForm(config: EffectiveConfig["llm"]): ModelForm {
  return {
    provider: config?.provider || "",
    model: config?.config?.model || "",
    apiKey: "",
  };
}

function ModelCard({
  title,
  kind,
  value,
  onChange,
  providers,
  disabled,
}: {
  title: string;
  kind: keyof BundledProviders;
  value: ModelForm;
  onChange: (value: ModelForm) => void;
  providers?: string[];
  disabled: boolean;
}) {
  const isDisabled = value.provider === "none";
  return (
    <Card className="border-memBorder-primary">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`${kind}-provider`}>
              Provider
            </Label>
            <Select
              value={value.provider}
              onValueChange={(provider) =>
                onChange({
                  ...emptyModel,
                  provider,
                  model: provider === "dashscope" ? dashscopeModels[kind] : "",
                })
              }
              disabled={disabled || !providers}
            >
              <SelectTrigger id={`${kind}-provider`}>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {kind === "reranker" && (
                  <SelectItem value="none">Disabled</SelectItem>
                )}
                {providers?.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`${kind}-model`}>
              Model
            </Label>
            <Input
              id={`${kind}-model`}
              value={value.model}
              placeholder={
                value.provider === "dashscope"
                  ? dashscopeModels[kind]
                  : kind === "embedder"
                    ? "text-embedding-3-small"
                    : "gpt-5-mini"
              }
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              disabled={disabled || isDisabled}
            />
          </div>
        </div>
        {!isDisabled && (
          <>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor={`${kind}-key`}>
                API Key (optional override)
              </Label>
              <Input
                id={`${kind}-key`}
                type="password"
                autoComplete="new-password"
                value={value.apiKey}
                placeholder={
                  value.provider === "dashscope"
                    ? "Use saved key or DASHSCOPE_API_KEY"
                    : "Keep saved key or server environment"
                }
                onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
                disabled={disabled}
              />
            </div>
          </>
        )}
        {kind === "reranker" && (
          <p className="text-xs text-onSurface-default-tertiary">
            Configure a model here, then send rerank: true in search requests.
            candidate_k controls retrieval depth; top_k limits final results.
            Reranking adds model latency and usage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConfigurationPage() {
  const { isAdmin } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [llm, setLlm] = useState<ModelForm>(emptyModel);
  const [embedder, setEmbedder] = useState<ModelForm>(emptyModel);
  const [reranker, setReranker] = useState<ModelForm>({
    ...emptyModel,
    provider: "none",
  });

  const { data: config, isLoading: isPrefilling } = useApiQuery(
    async () => {
      const res = await api.get(MEMORY_ENDPOINTS.CONFIGURE);
      return getEffectiveConfig(res.data);
    },
    { errorToast: "Failed to load server configuration" },
  );

  const { data: providers } = useApiQuery<BundledProviders>(
    async () => {
      const res = await api.get<BundledProviders>(
        MEMORY_ENDPOINTS.CONFIGURE_PROVIDERS,
      );
      return res.data;
    },
    { errorToast: "Failed to load bundled providers" },
  );

  useEffect(() => {
    if (!config) return;
    setLlm(modelForm(config.llm));
    setEmbedder(modelForm(config.embedder));
    setReranker(
      config.reranker
        ? modelForm(config.reranker)
        : { ...emptyModel, provider: "none" },
    );
  }, [config]);

  const handleSave = async () => {
    const enabledModels = [
      llm,
      embedder,
      ...(reranker.provider !== "none" ? [reranker] : []),
    ];
    if (enabledModels.some((model) => !model.provider || !model.model.trim())) {
      toast({
        title: "Select a provider and model for each enabled model",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      await api.post(MEMORY_ENDPOINTS.CONFIGURE, {
        version: "v1.1",
        llm: buildProviderConfig(llm),
        embedder: buildProviderConfig(embedder),
        reranker:
          reranker.provider === "none" ? null : buildProviderConfig(reranker),
      });
      setLlm((current) => ({ ...current, apiKey: "" }));
      setEmbedder((current) => ({ ...current, apiKey: "" }));
      setReranker((current) => ({ ...current, apiKey: "" }));
      toast({ title: "Configuration saved", variant: "success" });
    } catch (error) {
      toast({
        title: "Failed to save configuration",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = !isAdmin || isPrefilling || isSaving;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold font-fustat">Configuration</h1>
        {isPrefilling && (
          <p className="text-sm text-onSurface-default-tertiary">
            Loading effective server configuration...
          </p>
        )}
      </div>
      <ModelCard
        title="LLM Provider"
        kind="llm"
        value={llm}
        onChange={setLlm}
        providers={providers?.llm}
        disabled={disabled}
      />
      <ModelCard
        title="Embedding Model"
        kind="embedder"
        value={embedder}
        onChange={setEmbedder}
        providers={providers?.embedder}
        disabled={disabled}
      />
      <ModelCard
        title="Reranking Model"
        kind="reranker"
        value={reranker}
        onChange={setReranker}
        providers={providers?.reranker}
        disabled={disabled}
      />
      {isAdmin && (
        <Button
          onClick={handleSave}
          disabled={disabled || !config || !providers}
        >
          {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      )}
      <UpgradeBanner
        id="config-sso"
        message="Looking for SSO / SAML? Available in Enterprise."
        ctaLabel="Contact sales"
        ctaUrl="https://app.mem0.ai/enterprise?utm_source=oss&utm_medium=dashboard-configuration-sso"
        variant="enterprise"
      />
    </div>
  );
}

"use client";
import { useLanguage } from "@/lib/i18n";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/self-hosted/empty-state";
import DeleteConfirmationModal from "@/components/ui/delete-confirmation-modal";
import { api } from "@/utils/api";
import { API_KEY_ENDPOINTS } from "@/utils/api-endpoints";
import { toast } from "@/components/ui/use-toast";
import { UpgradeBanner } from "@/components/self-hosted/upgrade-banner";
import { Plus, Copy, Check, Trash2 } from "lucide-react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { format } from "date-fns";
import { getErrorMessage } from "@/lib/error-message";
import { useApiQuery } from "@/hooks/use-api-query";
import { ApiKey, ApiKeyCreateResponse } from "@/types/api";

export default function ApiKeysPage() {
  const { t, locale } = useLanguage();

  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  const {
    data: keys = [],
    isLoading,
    refetch,
  } = useApiQuery<ApiKey[]>(
    async () => {
      const res = await api.get<ApiKey[]>(API_KEY_ENDPOINTS.BASE);
      return res.data ?? [];
    },
    { errorToast: "Failed to load API keys", initialData: [] },
  );

  const handleCreate = async () => {
    try {
      const res = await api.post<ApiKeyCreateResponse>(API_KEY_ENDPOINTS.BASE, {
        label: newLabel,
      });
      setNewKey(res.data.key);
      void refetch();
    } catch (error) {
      toast({
        title: t("Failed to create key"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      await api.delete(API_KEY_ENDPOINTS.BY_ID(keyToRevoke.id));
      toast({ title: t("API key revoked"), variant: "success" });
      setKeyToRevoke(null);
      void refetch();
    } catch (error) {
      toast({
        title: t("Failed to revoke key"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setNewKey("");
      setNewLabel("");
      setCopied(false);
    }
    setCreateOpen(open);
  };

  const columns = [
    { key: "label" as keyof ApiKey, label: t("Label"), width: 150 },
    {
      key: "key_prefix" as keyof ApiKey,
      label: t("Key"),
      width: 120,
      render: (value: string) => (
        <code className="text-xs font-mono">{value}...</code>
      ),
    },
    {
      key: "created_at" as keyof ApiKey,
      label: t("Created"),
      width: 120,
      render: (value: string) =>
        format(
          new Date(value),
          locale === "zh-CN" ? "yyyy年M月d日" : "MMM d, yyyy",
        ),
    },
    {
      key: "last_used_at" as keyof ApiKey,
      label: t("Last Used"),
      width: 120,
      render: (value: string | null) =>
        value
          ? format(
              new Date(value),
              locale === "zh-CN" ? "yyyy年M月d日" : "MMM d, yyyy",
            )
          : t("Never"),
    },
    {
      key: "id" as keyof ApiKey,
      label: "",
      width: 40,
      render: (_: string, row: ApiKey) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setKeyToRevoke(row)}
          className="size-7"
        >
          <Trash2 className="size-3.5 text-onSurface-danger-primary" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold font-fustat">{t("API Keys")}</h1>
        <Dialog open={createOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-1" /> {t("Create Key")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Create API Key")}</DialogTitle>
            </DialogHeader>
            {!newKey ? (
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key-label">{t("Label")}</Label>
                  <Input
                    id="api-key-label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder={t("e.g. Production")}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!newLabel}
                  className="w-full"
                >
                  {t("Create")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="api-key-new">{t("Your API Key")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="api-key-new"
                      value={newKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <CopyToClipboard
                      text={newKey}
                      onCopy={() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      <Button variant="outline" size="icon">
                        {copied ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </CopyToClipboard>
                  </div>
                  <p className="text-xs text-onSurface-danger-primary">
                    {t("Save this key -- you won't see it again.")}
                  </p>
                </div>
                <Button
                  onClick={() => handleDialogClose(false)}
                  className="w-full"
                >
                  {t("Done")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length >= 3 && (
        <UpgradeBanner
          id="api-keys-3"
          message={t(
            "Managing multiple apps? Cloud offers project-based isolation.",
          )}
          ctaLabel={t("Explore Cloud")}
          ctaUrl="https://app.mem0.ai?utm_source=oss&utm_medium=dashboard-api-keys"
          variant="cloud"
        />
      )}

      {isLoading ? (
        <TableSkeleton rows={3} columns={4} />
      ) : keys.length === 0 ? (
        <EmptyState
          title={t("No API keys yet")}
          description={t(
            "Create your first API key to start using the Mem0 API.",
          )}
        />
      ) : (
        <Card className="border-memBorder-primary overflow-hidden">
          <DataTable
            data={keys}
            columns={columns}
            getRowKey={(row) => row.id}
          />
        </Card>
      )}

      <DeleteConfirmationModal
        isOpen={!!keyToRevoke}
        onClose={() => setKeyToRevoke(null)}
        onConfirm={handleRevoke}
        title={t("Revoke API key")}
        description={t(
          "Applications using this key will immediately stop working. This cannot be undone.",
        )}
        itemName={keyToRevoke?.label ?? ""}
        confirmButtonText="Revoke"
      />
    </div>
  );
}

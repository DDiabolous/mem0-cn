"use client";
import { useLanguage } from "@/lib/i18n";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/self-hosted/empty-state";
import DeleteConfirmationModal from "@/components/ui/delete-confirmation-modal";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/utils/api";
import { ENTITY_ENDPOINTS } from "@/utils/api-endpoints";
import { getErrorMessage } from "@/lib/error-message";
import { useApiQuery } from "@/hooks/use-api-query";
import { Entity } from "@/types/api";

export default function EntitiesPage() {
  const { t, locale } = useLanguage();

  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);

  const {
    data: entities = [],
    isLoading,
    refetch,
  } = useApiQuery<Entity[]>(
    async () => {
      const res = await api.get<Entity[]>(ENTITY_ENDPOINTS.BASE);
      return res.data ?? [];
    },
    { errorToast: "Failed to load entities", initialData: [] },
  );

  const handleDelete = async () => {
    if (!entityToDelete) return;
    try {
      await api.delete(
        ENTITY_ENDPOINTS.BY_ID(entityToDelete.type, entityToDelete.id),
      );
      toast({ title: t("Entity deleted"), variant: "success" });
      setEntityToDelete(null);
      void refetch();
    } catch (error) {
      toast({
        title: t("Failed to delete entity"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const columns = [
    {
      key: "type" as keyof Entity,
      label: t("Type"),
      width: 100,
      render: (value: Entity["type"]) => (
        <Badge variant="outline" className="capitalize">
          {value}
        </Badge>
      ),
    },
    {
      key: "id" as keyof Entity,
      label: t("ID"),
      width: 280,
      render: (value: string) => (
        <span className="font-mono text-sm truncate">{value}</span>
      ),
    },
    {
      key: "total_memories" as keyof Entity,
      label: t("Memories"),
      width: 100,
      align: "right" as const,
    },
    {
      key: "updated_at" as keyof Entity,
      label: t("Last Active"),
      width: 140,
      render: (value: string | null) =>
        value
          ? format(
              new Date(value),
              locale === "zh-CN" ? "yyyy年M月d日" : "MMM d, yyyy",
            )
          : "--",
    },
    {
      key: "id" as keyof Entity,
      label: "",
      width: 40,
      render: (_: string, row: Entity) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEntityToDelete(row)}
          className="size-7"
        >
          <Trash2 className="size-3.5 text-onSurface-danger-primary" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold font-fustat">{t("Entities")}</h1>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : entities.length === 0 ? (
        <EmptyState
          title={t("No entities yet")}
          description={t(
            "Entities appear once memories are stored with a user_id, agent_id, or run_id.",
          )}
        />
      ) : (
        <Card className="border-memBorder-primary overflow-hidden">
          <DataTable
            data={entities}
            columns={columns}
            getRowKey={(row) => `${row.type}:${row.id}`}
          />
        </Card>
      )}

      <DeleteConfirmationModal
        isOpen={!!entityToDelete}
        onClose={() => setEntityToDelete(null)}
        onConfirm={handleDelete}
        title={t("Delete entity")}
        description={t(
          "All memories associated with this entity will be permanently removed. This cannot be undone.",
        )}
        itemName={entityToDelete?.id ?? ""}
        confirmButtonText="Delete"
      />
    </div>
  );
}

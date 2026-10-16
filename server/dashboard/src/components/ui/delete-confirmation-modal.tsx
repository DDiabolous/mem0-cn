import { useLanguage } from "@/lib/i18n";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName: string;
  confirmButtonText?: string;
}

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmButtonText = "Delete",
}: DeleteConfirmationModalProps) => {
  const { t } = useLanguage();

  const [confirmationText, setConfirmationText] = useState("");

  const handleClose = () => {
    setConfirmationText("");
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    setConfirmationText("");
  };

  const isDeleteEnabled = confirmationText === itemName;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mb-4">{description}</DialogDescription>

        <div className="space-y-4">
          <p className="text-sm text-[#565553]">
            {t("Type {name} to confirm.", { name: itemName })}
          </p>
          <Input
            type="text"
            placeholder={t("Enter name to confirm")}
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={handleClose} variant="outline">
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            variant="destructive"
            disabled={!isDeleteEnabled}
          >
            {t(confirmButtonText)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmationModal;

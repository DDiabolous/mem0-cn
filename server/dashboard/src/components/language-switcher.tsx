"use client";

import { useLanguage } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <Switch
      startIcon={
        <span lang="zh-CN" className="text-[12px] font-medium">
          中
        </span>
      }
      endIcon={
        <span lang="en" className="text-[10px] font-medium">
          EN
        </span>
      }
      aria-label={t("Language")}
      title={t("Temporary language")}
      checked={locale === "en"}
      onCheckedChange={(checked) => setLocale(checked ? "en" : "zh-CN")}
    />
  );
}

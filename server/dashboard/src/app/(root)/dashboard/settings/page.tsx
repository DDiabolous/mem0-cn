"use client";
import { useLanguage } from "@/lib/i18n";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTemporaryTheme } from "@/components/theme-provider";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/error-message";
import { api } from "@/utils/api";
import { AUTH_ENDPOINTS } from "@/utils/api-endpoints";

export default function SettingsPage() {
  const { t, preference, setPreference } = useLanguage();

  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { clearTemporaryTheme } = useTemporaryTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const profileDirty =
    user !== null && (name !== user.name || email !== user.email);
  const profileValid = name.trim().length > 0 && email.trim().length > 0;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.patch(AUTH_ENDPOINTS.ME, {
        name: name.trim(),
        email: email.trim(),
      });
      await refreshUser();
      toast({ title: t("Profile updated"), variant: "success" });
    } catch (error) {
      toast({
        title: t("Failed to update profile"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t("Passwords don't match"),
        variant: "destructive",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await api.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: t("Password updated"), variant: "success" });
    } catch (error) {
      toast({
        title: t("Failed to update password"),
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold font-fustat">{t("Settings")}</h1>

      <Card className="border-memBorder-primary">
        <CardHeader>
          <CardTitle className="text-sm">{t("Profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="settings-name" className="text-xs">
                {t("Name")}
              </Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-email" className="text-xs">
                {t("Email")}
              </Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={!profileDirty || !profileValid || savingProfile}
          >
            {savingProfile ? t("Saving...") : t("Save profile")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-memBorder-primary">
        <CardHeader>
          <CardTitle className="text-sm">{t("Password")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="settings-current-password" className="text-xs">
              {t("Current password")}
            </Label>
            <Input
              id="settings-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="settings-new-password" className="text-xs">
                {t("New password")}
              </Label>
              <Input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("Min 8 characters")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settings-confirm-password" className="text-xs">
                {t("Confirm new password")}
              </Label>
              <Input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={
              !currentPassword ||
              newPassword.length < 8 ||
              !confirmPassword ||
              savingPassword
            }
          >
            {savingPassword ? t("Saving...") : t("Update password")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-memBorder-primary">
        <CardHeader>
          <CardTitle className="text-sm">{t("Appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-onSurface-default-secondary">
              {t("Theme")}
            </span>
            <div
              role="group"
              aria-label={t("Theme")}
              className="flex items-center gap-2"
            >
              {[
                { value: "light", label: t("Light"), Icon: Sun },
                { value: "dark", label: t("Dark"), Icon: Moon },
                { value: "system", label: t("System"), Icon: Monitor },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={(theme || "system") === value}
                  onClick={() => {
                    clearTemporaryTheme();
                    setTheme(value);
                  }}
                  className={cn(
                    "rounded-md p-2 text-onSurface-default-secondary hover:bg-surface-default-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-memPurple-500",
                    (theme || "system") === value &&
                      "bg-surface-default-tertiary text-onSurface-default-primary",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-onSurface-default-secondary">
              {t("Language")}
            </span>
            <div
              role="group"
              aria-label={t("Language")}
              className="flex flex-wrap items-center gap-2"
            >
              {[
                { value: "zh-CN" as const, label: "简体中文" },
                { value: "en" as const, label: "English" },
                { value: "system" as const, label: t("System") },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preference === value}
                  onClick={() => setPreference(value)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm text-onSurface-default-secondary hover:bg-surface-default-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-memPurple-500",
                    preference === value &&
                      "bg-surface-default-tertiary text-onSurface-default-primary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-onSurface-default-tertiary">
            {t(
              "Appearance preferences apply to future logins in this browser.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

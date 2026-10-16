"use client";

import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "next-themes";
import { useTemporaryTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";
import { useRef } from "react";
import { flushSync } from "react-dom";

export function ThemeToggle() {
  const { t } = useLanguage();
  const { resolvedTheme, forcedTheme } = useTheme();
  const { setTemporaryTheme } = useTemporaryTheme();
  const switchRef = useRef<HTMLButtonElement>(null);
  const animating = useRef(false);

  const changeTheme = async (checked: boolean) => {
    if (animating.current) return;
    const next = checked ? "dark" : "light";
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setTemporaryTheme(next);
      return;
    }

    const rect = switchRef.current?.getBoundingClientRect();
    if (!rect) {
      setTemporaryTheme(next);
      return;
    }
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const root = document.documentElement;
    animating.current = true;
    root.classList.add("theme-transition");
    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => setTemporaryTheme(next));
      });
      await transition.ready;
      await root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 550,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      ).finished;
      await transition.finished;
    } catch {
      // Unsupported snapshots or interrupted animations still apply the choice.
      setTemporaryTheme(next);
    } finally {
      root.classList.remove("theme-transition");
      animating.current = false;
    }
  };
  return (
    <Switch
      ref={switchRef}
      startIcon={<SunIcon className="size-3" />}
      endIcon={<MoonIcon className="size-3" />}
      aria-label={t("Toggle theme")}
      title={t("Temporary theme")}
      checked={(forcedTheme || resolvedTheme) === "dark"}
      onCheckedChange={(checked) => {
        void changeTheme(checked);
      }}
    />
  );
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveTheme } from "@/lib/actions/misc";
import type { ThemePreference } from "@/types/domain";

const subscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * Theme is applied from localStorage before paint by next-themes (no flash)
 * and mirrored to the profile so it follows the user across devices.
 */
export function ThemeSync({ preference }: { preference: ThemePreference }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      if (!window.localStorage.getItem("theme")) setTheme(preference);
    } catch {
      setTheme(preference);
    }
  }, [preference, setTheme]);
  return null;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const Icon = !mounted ? Sun : theme === "system" ? Laptop : resolvedTheme === "dark" ? Moon : Sun;

  const choose = (value: string) => {
    const t = value as ThemePreference;
    setTheme(t);
    void saveTheme(t);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={className} aria-label="Change theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? (theme ?? "light") : "light"} onValueChange={choose}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Laptop /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

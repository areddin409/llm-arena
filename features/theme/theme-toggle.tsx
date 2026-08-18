"use client";

import { Button } from "@/features/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Which icon and label show is decided in CSS off the `dark` class, not off
 * React state. That keeps the server and client markup identical — a mounted
 * flag would render an empty square on first paint, which is the flash this
 * whole setup exists to avoid.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon aria-hidden="true" className="dark:hidden" />
      <SunIcon aria-hidden="true" className="hidden dark:block" />
      <span className="sr-only">
        <span className="dark:hidden">Switch to dark theme</span>
        <span className="hidden dark:inline">Switch to light theme</span>
      </span>
    </Button>
  );
}

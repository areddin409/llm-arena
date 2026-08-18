"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";

/**
 * Puts `class="dark"` on <html> before the first paint, so the coffee ground is
 * never a white flash first. A class rather than a media query because the
 * toggle has to be able to disagree with the system preference.
 *
 * `defaultTheme="system"` means a first visit follows the machine; once someone
 * picks, the choice is stored and it wins from then on.
 */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

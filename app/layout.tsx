import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/features/theme/theme-provider";
import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * One family at two widths. `wdth` is loaded as an extra axis so headings can
 * run at full expanded width — the signage treatment in `type-display` — while
 * body copy stays at normal width. Asking for the axis here is what makes
 * `font-stretch` in globals.css do anything at all.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

/** Every measured number in the app is set in this. */
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LLM Arena",
  description:
    "Send one prompt to three models at once, watch them answer side by side, and vote for the best.",
};

/**
 * Clerk's own components read the same palette rather than carrying a second
 * one. Each value points at a CSS variable, so the sign-in card follows the
 * theme toggle without Clerk needing to know a toggle exists.
 */
const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--card)",
    colorForeground: "var(--foreground)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    colorNeutral: "var(--foreground)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--ring)",
    colorDanger: "var(--destructive)",
    colorSuccess: "var(--winner)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-archivo)",
    fontFamilyMono: "var(--font-jetbrains-mono)",
  },
} as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning is required by next-themes: its pre-paint script
    // writes the class onto <html> before React hydrates, so the two disagree
    // by design on exactly this element.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      {/* No chrome here on purpose: the app's own frame is the shell in
          app/(app)/layout.tsx, and the auth screens deliberately have none. */}
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

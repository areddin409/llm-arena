import { AppShell } from "@/features/shell/app-shell";

/**
 * Everything inside the product sits in the shell. Sign-in and sign-up stay
 * outside this group on purpose — a sidebar full of threads is not much use to
 * someone who has not signed in yet.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}

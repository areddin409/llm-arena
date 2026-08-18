import { ThemeToggle } from "@/features/theme/theme-toggle";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="rounded-sm type-display text-base">
          LLM Arena
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <SignUp />
      </main>
    </div>
  );
}

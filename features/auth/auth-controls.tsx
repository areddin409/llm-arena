import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/**
 * Temporary auth controls. Uses the create-next-app tokens on purpose — the real
 * palette and shell land with scope.md features 4 (Design & look) and 7 (App shell).
 */
export function AuthControls() {
  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:hover:bg-white/[.08]"
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}

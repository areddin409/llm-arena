import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/features/ui/button";

/**
 * Sign-in, sign-up, and the account menu. Reads the shared palette through the
 * Button component; Clerk's own modal is themed from the same tokens in
 * app/layout.tsx, so nothing here carries colors of its own.
 */
export function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm">Create account</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}

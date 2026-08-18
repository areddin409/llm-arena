import { cn } from "@/features/ui/utils";

type ModelMarkProps = {
  /** First letter of the model's display name. */
  readonly initial: string;
  readonly size?: "sm" | "md";
  readonly className?: string;
};

const SIZE: Readonly<Record<"sm" | "md", string>> = {
  sm: "size-5 text-[0.625rem]",
  md: "size-7 text-xs",
};

/**
 * The small round mark standing in for a model, in the top bar's win chips, on
 * a response card, in a leaderboard row and on a catalog card. Deliberately
 * plain — giving each model a distinct look is parked under "Not doing right
 * now" in docs/scope.md, and until then a uniform mark is the honest version.
 */
export function ModelMark({ initial, size = "md", className }: ModelMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong font-mono font-medium text-muted-foreground",
        SIZE[size],
        className,
      )}
    >
      {initial}
    </span>
  );
}

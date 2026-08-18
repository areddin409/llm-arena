import { cn } from "@/features/ui/utils";

type TimingRailState = "streaming" | "complete" | "winner" | "failed";

type TimingRailProps = {
  /** How far through the shared time axis this model has got, 0 to 1. */
  readonly progress: number;
  /**
   * Where first token landed on that same axis, 0 to 1, or null when there is
   * genuinely nothing to mark — a provider that returned everything in one
   * chunk has no time-to-first-token to show.
   */
  readonly ttft: number | null;
  readonly state: TimingRailState;
  readonly className?: string;
};

const FILL_BY_STATE: Readonly<Record<TimingRailState, string>> = {
  // Rust: live, and the thing you are about to interact with.
  streaming: "bg-primary",
  complete: "bg-primary",
  // Green means one thing in this app and this is it.
  winner: "bg-winner",
  // Red means one thing too.
  failed: "bg-destructive",
};

/**
 * The rail under a response card: it fills as the model streams, ticked where
 * first token landed. Every rail in a turn shares one time axis, so a slow
 * model is visibly short next to a fast one — the speed numbers made watchable
 * rather than read afterwards.
 *
 * Presentational and pure: it takes fractions and renders them. Measuring is
 * `features/chat/call-metrics.ts`'s job, and the turn decides the shared axis.
 *
 * Deliberately `aria-hidden`. It carries no information that is not already
 * beside it as text, and a progressbar role on three simultaneous streams
 * announces constantly while saying nothing new.
 */
export function TimingRail({
  progress,
  ttft,
  state,
  className,
}: TimingRailProps) {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          FILL_BY_STATE[state],
        )}
        style={{ width: `${clamp(progress) * 100}%` }}
      />
      {ttft === null ? null : (
        <span
          className="absolute inset-y-0 w-px bg-background"
          style={{ left: `${clamp(ttft) * 100}%` }}
        />
      )}
    </div>
  );
}

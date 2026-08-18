import { findModelGlyph } from "@/features/models/model-glyph";
import { modelAuthorLetter } from "@/features/models/model-id";
import { cn } from "@/features/ui/utils";

type ModelMarkProps = {
  /** An OpenRouter id — `google/gemma-4-31b-it:free`. */
  readonly modelId: string;
  readonly size?: "sm" | "md";
  readonly className?: string;
};

const SIZE: Readonly<Record<"sm" | "md", string>> = {
  sm: "size-5 text-[0.625rem]",
  md: "size-7 text-xs",
};

/**
 * Who made a model, at a glance: in the top bar's win chips, on a response
 * card, in a leaderboard row, on a catalog card and beside a chip in the
 * composer.
 *
 * It takes an id rather than a letter because the id already carries the
 * author, so nothing has to be hand-maintained alongside it and feature 5's
 * live list arrives already drawable.
 *
 * **Two treatments, because the two contents want different things.** A
 * provider mark is a silhouette and reads best bare, at full size, with nothing
 * ringed around it competing at 20px. A bare letter is not a mark at all until
 * something contains it, so the fallback keeps the ring. Both occupy the same
 * box, so a row of mixed marks still lines up.
 *
 * The glyph is wrapped in a `span` rather than returned as a bare `svg`. Badge
 * ends its class list with `[&>svg]:size-3`, which outranks a size utility
 * written on the element itself — the same trap `SidebarMenuButton` set for the
 * logo, recorded in docs/scope.md. A wrapper puts the svg out of reach of it.
 *
 * `aria-hidden` throughout: every place this appears, the model is already
 * named in text beside it or in the `sr-only` sentence the chip carries.
 */
export function ModelMark({ modelId, size = "md", className }: ModelMarkProps) {
  const glyph = findModelGlyph(modelId);

  if (glyph) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center text-muted-foreground",
          SIZE[size],
          className,
        )}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d={glyph.path} />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong font-mono font-medium text-muted-foreground",
        SIZE[size],
        className,
      )}
    >
      {modelAuthorLetter(modelId)}
    </span>
  );
}

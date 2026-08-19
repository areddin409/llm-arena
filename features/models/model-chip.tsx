import { ModelMark } from "@/features/models/model-mark";
import { Button } from "@/features/ui/button";
import { cn } from "@/features/ui/utils";
import { XIcon } from "lucide-react";

type ModelChipProps = {
  /** An OpenRouter id — `google/gemma-4-31b-it:free`. */
  readonly modelId: string;
  /** OpenRouter's display name, `Vendor: Model`. Shown whole, then truncated. */
  readonly modelName: string;
  readonly onRemove: () => void;
  readonly className?: string;
};

/**
 * One model queued for a turn, with a control to take it back off.
 *
 * **This is deliberately not a `Badge`, and the reason is the whole point of
 * the component.** `Badge` ends its class list with `overflow-hidden`, which
 * clips at its padding box. A `size="icon-xs"` remove button is a 24px box
 * whose focus ring is 2px at a 2px offset, so it needs 4px of clearance and the
 * chip's `py-0.5` gives it 2px. The ring was cropped flat top and bottom, which
 * is a keyboard user losing the focus indicator on the one control here that
 * has one — the exact baseline `globals.css` and four vendored components were
 * edited to hold.
 *
 * That is not a bug in `Badge`. `Badge` clips on purpose so its content stays
 * inside the pill, and it is the right element for a label. It is the wrong
 * element for a container holding something focusable, so this draws its own
 * pill instead of overriding `Badge`'s behaviour at a call site and leaving the
 * same trap set for the next person.
 *
 * The top bar's win chips are still `Badge`es: nothing in them takes focus.
 */
export function ModelChip({
  modelId,
  modelName,
  onRemove,
  className,
}: ModelChipProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border py-0.5 pr-0.5 pl-1 text-xs font-medium whitespace-nowrap text-foreground",
        className,
      )}
    >
      <ModelMark modelId={modelId} size="sm" />
      <span className="max-w-32 truncate">{modelName}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        onClick={onRemove}
      >
        <XIcon />
        <span className="sr-only">Remove {modelName} from this turn</span>
      </Button>
    </span>
  );
}

import { PLACEHOLDER_TURN } from "@/features/shell/placeholder-data";
import { Badge } from "@/features/ui/badge";
import { Button } from "@/features/ui/button";
import { ModelMark } from "@/features/ui/model-mark";
import { Textarea } from "@/features/ui/textarea";
import { ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";

/**
 * The composer. Chips for the models this turn will go to, the prompt itself,
 * and send. Feature 5 makes the chips real and the "Add model" button open the
 * catalog popover; feature 6 makes send actually fan out.
 */
export function PromptDock() {
  return (
    <div className="sticky bottom-0 bg-background pt-4 pb-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <label htmlFor="prompt" className="sr-only">
          Your prompt
        </label>
        <Textarea
          id="prompt"
          rows={2}
          placeholder="Ask anything. Enter to send, Shift + Enter for a new line."
          className="resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ul className="flex flex-wrap items-center gap-1.5">
            {PLACEHOLDER_TURN.responses.map((response) => (
              <li key={response.modelId}>
                <Badge variant="outline" className="gap-1.5 py-0.5 pr-1 pl-0.5">
                  <ModelMark initial={response.initial} size="sm" />
                  <span className="max-w-32 truncate">
                    {response.modelName}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                  >
                    <XIcon />
                    <span className="sr-only">
                      Remove {response.modelName} from this turn
                    </span>
                  </Button>
                </Badge>
              </li>
            ))}
          </ul>

          <Button variant="outline" size="xs">
            <PlusIcon data-icon="inline-start" />
            Add model
          </Button>

          <Button size="icon" className="ml-auto rounded-full">
            <ArrowUpIcon />
            <span className="sr-only">Send prompt</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

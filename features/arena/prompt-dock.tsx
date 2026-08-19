"use client";

import { useState } from "react";
import { ArrowUpIcon } from "lucide-react";

import type { CatalogModel } from "@/features/models/catalog-model";
import { ModelChip } from "@/features/models/model-chip";
import { ModelPicker } from "@/features/models/model-picker";
import { Button } from "@/features/ui/button";
import { Textarea } from "@/features/ui/textarea";
import { MAX_MODELS_PER_TURN } from "@/features/turns/turn-request";

/**
 * The composer. Chips for the models this turn will go to, the prompt itself,
 * and send. Feature 6 makes send actually fan out.
 *
 * **This owns the selection, and nothing else does.** It is seeded from the
 * server, which derives a default from the live catalog on every render, and it
 * is not written to `localStorage`. OpenRouter's free tier turns over fast
 * enough that a remembered selection would be dead within about a week, so it
 * would need reconciling against the catalog on every load — see
 * `defaultSelection`, which has none of that problem because it cannot go stale.
 */

type PromptDockProps = {
  /**
   * The models this turn starts with. Derived on the server from the live
   * catalog; empty when the catalog could not be reached.
   */
  readonly initialModels: readonly CatalogModel[];
};

export function PromptDock({ initialModels }: PromptDockProps) {
  const [selected, setSelected] =
    useState<readonly CatalogModel[]>(initialModels);

  const toggle = (model: CatalogModel) =>
    setSelected((current) =>
      current.some((chosen) => chosen.id === model.id)
        ? current.filter((chosen) => chosen.id !== model.id)
        : current.length >= MAX_MODELS_PER_TURN
          ? current
          : [...current, model],
    );

  const remove = (id: string) =>
    setSelected((current) => current.filter((chosen) => chosen.id !== id));

  return (
    <div className="sticky bottom-0 bg-background pt-4 pb-4">
      <div className="surface p-3">
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
            {selected.map((model) => (
              <li key={model.id}>
                <ModelChip
                  modelId={model.id}
                  modelName={model.name}
                  onRemove={() => remove(model.id)}
                />
              </li>
            ))}
          </ul>

          <ModelPicker selected={selected} onToggle={toggle} />

          {selected.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add at least one model to send a prompt.
            </p>
          ) : null}

          <Button size="icon" className="ml-auto rounded-full">
            <ArrowUpIcon />
            <span className="sr-only">Send prompt</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

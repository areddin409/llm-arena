"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";

import {
  formatContextWindow,
  type CatalogModel,
} from "@/features/models/catalog-model";
import { ModelMark } from "@/features/models/model-mark";
import type { CatalogState } from "@/features/models/use-catalog";
import { Button } from "@/features/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/features/ui/command";
import { MAX_MODELS_PER_TURN } from "@/features/turns/turn-request";

/**
 * The catalog as something you choose from. Rendered inside a popover on
 * desktop and a sheet on mobile — both hand it the same list, so the two never
 * drift into being different pickers.
 *
 * **Two groups, not one flat list, and that carries the gating.** Free models
 * can be chosen; the rest need an OpenRouter key of your own, which is feature
 * 10 and is not built yet. Saying so once, under a group heading, is the whole
 * reason the split exists: the alternative is a badge repeated on 380 rows to
 * express a fact about all of them at once.
 *
 * **Price is deliberately not on a row here.** It cannot affect a choice you are
 * not able to make, and a fourth column would cost the model name the width it
 * needs. Comparing what models cost is what `/models` is for.
 */

/**
 * How many rows each group renders. Neither group is ever drawn in full: 400
 * mounted rows is a slow popover, and nobody scrolls to row 300 anyway. Search
 * is how you reach the rest, which is why the count of what is hidden is shown
 * rather than left implied.
 */
const ROWS_PER_GROUP = 50;

const matches = (model: CatalogModel, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;

  return (
    model.name.toLowerCase().includes(needle) ||
    model.id.toLowerCase().includes(needle)
  );
};

type ModelRowProps = {
  readonly model: CatalogModel;
  readonly selected: boolean;
  /** Null when the row cannot be acted on; the sentence says why. */
  readonly unavailable: string | null;
  readonly onToggle: (model: CatalogModel) => void;
};

function ModelRow({ model, selected, unavailable, onToggle }: ModelRowProps) {
  return (
    <CommandItem
      value={model.id}
      // Not cmdk's `disabled`, on purpose. That prop removes an item from
      // keyboard navigation entirely, which would put 380 paid models out of
      // reach of anyone not using a mouse — they could be read on /models and
      // nowhere else. `aria-disabled` announces the state and keeps the row
      // arrow-reachable, which is what a person needs in order to find out that
      // the model exists and what it would take to use it.
      aria-disabled={unavailable !== null}
      onSelect={() => {
        if (unavailable === null) onToggle(model);
      }}
      className={unavailable === null ? undefined : "text-muted-foreground"}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {selected ? <CheckIcon className="text-primary" /> : null}
      </span>

      <ModelMark modelId={model.id} size="sm" />

      <span className="min-w-0 flex-1 truncate">{model.name}</span>

      <span className="shrink-0 type-metric text-muted-foreground">
        {formatContextWindow(model.contextWindow)}
      </span>

      <span className="sr-only">
        {selected ? "Chosen. " : ""}
        {unavailable ?? ""}
      </span>
    </CommandItem>
  );
}

type ModelGroupProps = {
  readonly heading: string;
  readonly note?: string;
  readonly models: readonly CatalogModel[];
  readonly chosenIds: ReadonlySet<string>;
  readonly reasonFor: (model: CatalogModel) => string | null;
  readonly onToggle: (model: CatalogModel) => void;
};

/**
 * The group heading is set in `type-eyebrow`, overriding the vendored
 * `text-xs font-medium`. Both groups are counted in their heading because the
 * counts are the honest shape of this catalog — a handful free against several
 * hundred that are not — and that is the fact the picker exists to convey.
 */
function ModelGroup({
  heading,
  note,
  models,
  chosenIds,
  reasonFor,
  onToggle,
}: ModelGroupProps) {
  const hidden = models.length - ROWS_PER_GROUP;

  return (
    <CommandGroup
      heading={heading}
      className="**:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:type-eyebrow"
    >
      {note === undefined ? null : (
        <p className="px-2 pb-2 text-xs text-muted-foreground">{note}</p>
      )}

      {models.slice(0, ROWS_PER_GROUP).map((model) => (
        <ModelRow
          key={model.id}
          model={model}
          selected={chosenIds.has(model.id)}
          unavailable={reasonFor(model)}
          onToggle={onToggle}
        />
      ))}

      {hidden > 0 ? (
        <p className="px-2 pt-1.5 text-xs text-muted-foreground">
          {hidden.toLocaleString("en-US")} more. Search to narrow the list.
        </p>
      ) : null}
    </CommandGroup>
  );
}

type ModelPickerListProps = {
  readonly state: CatalogState;
  readonly selected: readonly CatalogModel[];
  readonly onToggle: (model: CatalogModel) => void;
  readonly onRetry: () => void;
};

export function ModelPickerList({
  state,
  selected,
  onToggle,
  onRetry,
}: ModelPickerListProps) {
  const [query, setQuery] = useState("");

  if (state.status === "failed") {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          The model list is unavailable right now.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status !== "ready") {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Loading models…
      </p>
    );
  }

  const chosenIds = new Set(selected.map((model) => model.id));
  const full = selected.length >= MAX_MODELS_PER_TURN;

  const found = state.models.filter((model) => matches(model, query));
  const free = found.filter((model) => model.free);
  const paid = found.filter((model) => !model.free);

  const reasonFor = (model: CatalogModel): string | null => {
    if (!model.free) return "Needs your own API key.";
    if (chosenIds.has(model.id)) return null;
    return full ? "Remove a model first." : null;
  };

  return (
    // cmdk filters by default; this filters by hand instead, so the row cap
    // below is applied to the results rather than to the whole catalog — a
    // built-in filter would hide matches that fell outside the slice.
    <Command shouldFilter={false} className="bg-transparent">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={`Search ${state.models.length} models`}
      />

      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="type-eyebrow text-muted-foreground">
          {selected.length} of {MAX_MODELS_PER_TURN} chosen
        </span>
        {full ? (
          <span className="text-xs text-muted-foreground">
            Remove one to swap
          </span>
        ) : null}
      </div>

      <CommandList className="max-h-[min(60vh,26rem)]">
        <CommandEmpty>No model matches that.</CommandEmpty>

        {free.length > 0 ? (
          <ModelGroup
            heading={`Free to use · ${free.length}`}
            models={free}
            chosenIds={chosenIds}
            reasonFor={reasonFor}
            onToggle={onToggle}
          />
        ) : null}

        {paid.length > 0 ? (
          <ModelGroup
            heading={`Needs your own key · ${paid.length}`}
            note="Adding your own OpenRouter key is coming. Until then you can compare these on the models page."
            models={paid}
            chosenIds={chosenIds}
            reasonFor={reasonFor}
            onToggle={onToggle}
          />
        ) : null}
      </CommandList>
    </Command>
  );
}

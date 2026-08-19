"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";

import {
  formatContextWindow,
  formatUsdPerMillion,
  type CatalogModel,
} from "@/features/models/catalog-model";
import { ModelMark } from "@/features/models/model-mark";
import { Button } from "@/features/ui/button";
import { Input } from "@/features/ui/input";

/**
 * How many rows a section shows before you ask for more.
 *
 * This is the one lever that moves this page's weight, and it was picked from a
 * measurement rather than taste. A `"use client"` component is still rendered to
 * HTML on the server — that is what hydration needs — so every row costs markup
 * whether it is a server component or not. All 396 rows came to **710 KB**; the
 * 379-row paid table is nearly all of it.
 */
const ROWS_PER_PAGE = 50;

/**
 * The catalog as a table you can read down.
 *
 * **A client component, and that is a correction to what feature 5 planned.**
 * The plan said a server component would keep the catalog out of the browser
 * entirely. Building it proved that backwards: a server-rendered table
 * serializes its whole rendered tree into the RSC flight payload, so 396 rows
 * came to **1.0 MB** in a production build. The same rows as data are 65 KB.
 * Rendering on the client is an order of magnitude smaller, not larger, and it
 * pays for the search box as a side effect rather than as a cost.
 *
 * The rows are a table because context window and both prices are measurements,
 * and measurements want a column that lines up — `type-metric` carries tabular
 * figures so they do.
 */

type ModelCatalogTableProps = {
  readonly models: readonly CatalogModel[];
};

const matches = (model: CatalogModel, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;

  return (
    model.name.toLowerCase().includes(needle) ||
    model.id.toLowerCase().includes(needle)
  );
};

function ModelRows({ models }: { readonly models: readonly CatalogModel[] }) {
  return (
    <tbody>
      {models.map((model) => (
        <tr key={model.id} className="border-t border-border first:border-t-0">
          <th scope="row" className="px-3 py-2 text-left font-normal">
            <span className="flex min-w-0 items-center gap-2.5">
              <ModelMark modelId={model.id} size="sm" />
              <span className="min-w-0">
                <span className="block">{model.name}</span>
                <span className="block type-metric text-xs break-all text-muted-foreground">
                  {model.id}
                </span>
              </span>
            </span>
          </th>
          <td className="px-3 py-2 text-right type-metric whitespace-nowrap text-muted-foreground">
            {formatContextWindow(model.contextWindow)}
          </td>
          <td className="px-3 py-2 text-right type-metric whitespace-nowrap text-muted-foreground">
            {formatUsdPerMillion(model.promptUsdPerMillion)}
          </td>
          <td className="px-3 py-2 text-right type-metric whitespace-nowrap text-muted-foreground">
            {formatUsdPerMillion(model.completionUsdPerMillion)}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/**
 * One group of models, revealed 50 at a time.
 *
 * Incremental disclosure rather than numbered pages: there is one piece of
 * state, nothing to reset but itself, and the list stays a single continuous
 * thing to scan — nobody has to remember which page a model was on. The count
 * still to come is shown on the button, because a control that hides an unknown
 * quantity is one people stop pressing.
 *
 * `key` on this component is the search query, so typing collapses the list back
 * to the first 50 without this needing to know that searching happened.
 */
function ModelSection({
  heading,
  description,
  models,
}: {
  readonly heading: string;
  readonly description: string;
  readonly models: readonly CatalogModel[];
}) {
  const [shown, setShown] = useState(ROWS_PER_PAGE);

  const visible = models.slice(0, shown);
  const remaining = models.length - visible.length;

  return (
    <section className="mt-10">
      <h2 className="type-eyebrow text-muted-foreground">
        {heading} · {models.length.toLocaleString("en-US")}
      </h2>
      <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
        {description}
      </p>

      {models.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing here matches that search.
        </p>
      ) : (
        // The table scrolls inside its own box rather than pushing the page
        // sideways — four columns of numbers do not fit a phone.
        <div className="mt-4 overflow-x-auto surface">
          <table className="w-full min-w-lg border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-3 py-2 font-medium">
                  Model
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Context
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Input / 1M
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Output / 1M
                </th>
              </tr>
            </thead>
            <ModelRows models={visible} />
          </table>
        </div>
      )}

      {remaining > 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShown((current) => current + ROWS_PER_PAGE)}
          >
            Show {Math.min(ROWS_PER_PAGE, remaining).toLocaleString("en-US")}{" "}
            more
          </Button>
          <span
            aria-live="polite"
            className="type-metric text-muted-foreground"
          >
            {visible.length.toLocaleString("en-US")} of{" "}
            {models.length.toLocaleString("en-US")}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function ModelCatalogTable({ models }: ModelCatalogTableProps) {
  const [query, setQuery] = useState("");

  const found = models.filter((model) => matches(model, query));

  return (
    <>
      <div className="relative mt-6 max-w-sm">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <label htmlFor="model-search" className="sr-only">
          Search models
        </label>
        <Input
          id="model-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${models.length} models`}
          className="pl-9"
        />
      </div>

      {/* Keyed by the query so a new search starts each section back at its
          first 50 rows. Remounting is the whole mechanism — no effect, and no
          reset the section has to remember to perform. */}
      <ModelSection
        key={`free-${query}`}
        heading="Free to use"
        description="Free to use. Pick any of these in the arena today."
        models={found.filter((model) => model.free)}
      />
      <ModelSection
        key={`paid-${query}`}
        heading="Needs your own key"
        description="Priced by OpenRouter. Using one needs your own API key, which is coming."
        models={found.filter((model) => !model.free)}
      />
    </>
  );
}

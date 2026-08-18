import { PLACEHOLDER_CATALOG } from "@/features/shell/placeholder-data";
import { ModelMark } from "@/features/models/model-mark";
import { PlaceholderNotice } from "@/features/ui/placeholder-notice";

function Detail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate type-metric">{value}</dd>
    </div>
  );
}

/**
 * The full free-tier catalog, browsable without opening the picker. Feature 5
 * replaces the list below with OpenRouter's live one and sorts by context
 * window; the card shape it renders into is this.
 */
export function ModelCatalog() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="type-display text-3xl">Models</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Every model the arena can call. A price of $0.000000 is the real
        measured number for a free model, not a missing one.
      </p>

      <div className="mt-6">
        <PlaceholderNotice>
          Placeholder catalog, free tier only. Feature 5 pulls OpenRouter&apos;s
          live list, and feature 10 widens it to paid models gated behind your
          own key.
        </PlaceholderNotice>
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_CATALOG.map((model) => (
          <li
            key={model.modelId}
            className="flex flex-col rounded-xl border border-border bg-card p-4"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <ModelMark modelId={model.modelId} />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">
                  {model.modelName}
                </h2>
                <p className="truncate type-eyebrow text-muted-foreground">
                  {model.author}
                </p>
              </div>
            </div>

            <dl className="mt-4">
              <Detail
                label="Context window"
                value={`${model.contextWindow.toLocaleString("en-US")} tokens`}
              />
              <Detail label="Input" value="$0.000000 / 1M" />
              <Detail label="Output" value="$0.000000 / 1M" />
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

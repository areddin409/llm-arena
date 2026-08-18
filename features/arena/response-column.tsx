import { type PlaceholderResponse } from "@/features/shell/placeholder-data";
import { Badge } from "@/features/ui/badge";
import { Button } from "@/features/ui/button";
import { ModelMark } from "@/features/ui/model-mark";
import { TimingRail } from "@/features/ui/timing-rail";
import { ChevronDownIcon } from "lucide-react";

type ResponseColumnProps = {
  readonly response: PlaceholderResponse;
  /** The slowest response in the turn. Every rail is drawn against it. */
  readonly axisMs: number;
};

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="type-metric">{value}</dd>
    </div>
  );
}

/**
 * One model's answer to the current turn. Every column is independent by
 * design: one failing shows its own plain sentence and its own retry, and says
 * nothing about the two beside it.
 *
 * The metrics panel is a native `<details>` — a disclosure that is keyboard
 * operable and announced correctly without a line of JavaScript.
 */
export function ResponseColumn({ response, axisMs }: ResponseColumnProps) {
  const hasFailed = response.state === "failed";
  const hasWon = response.state === "winner";

  return (
    <article className="flex w-full min-w-0 flex-col rounded-xl border border-border bg-card">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <ModelMark initial={response.initial} />
          <h3 className="truncate text-sm font-medium">{response.modelName}</h3>
        </div>

        {hasWon ? (
          <Badge
            variant="outline"
            className="shrink-0 border-winner type-eyebrow text-winner"
          >
            Won
          </Badge>
        ) : (
          <Button variant="outline" size="xs" disabled={hasFailed}>
            Pick this
          </Button>
        )}
      </header>

      <TimingRail
        className="mt-4 rounded-none"
        progress={response.totalMs === null ? 0.05 : response.totalMs / axisMs}
        ttft={response.ttftMs === null ? null : response.ttftMs / axisMs}
        state={response.state}
      />

      <div className="min-h-40 flex-1 px-4 py-4">
        {hasFailed ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive">
              That model didn&apos;t answer.
            </p>
            <Button variant="outline" size="sm">
              Try again
            </Button>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-card-foreground">
            {response.content}
          </p>
        )}
      </div>

      <details className="group border-t border-border">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 type-eyebrow text-muted-foreground hover:text-foreground">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-3.5 transition-transform group-open:rotate-180"
          />
          Metrics
        </summary>

        <dl className="flex flex-col gap-2 px-4 pb-4">
          {hasFailed ? (
            <p className="text-xs text-muted-foreground">
              Nothing was measured — the call never returned.
            </p>
          ) : (
            <>
              <Metric
                label="Time to first token"
                value={`${response.ttftMs}ms`}
              />
              <Metric
                label="Tokens per second"
                value={`${response.tokensPerSecond}`}
              />
              <Metric
                label="Output tokens"
                value={`${response.outputTokens}`}
              />
              <Metric label="Total time" value={`${response.totalMs}ms`} />
              {/*
                Cost is shown even though a free model always reads zero: it is
                an honestly measured number, not a missing one. Six decimals
                because that is what `costUsd` stores, and because feature 10
                makes this field stop being a constant — a model run on
                someone's own key reads a real number here.
              */}
              <Metric label="Cost" value="$0.000000" />
            </>
          )}
        </dl>
      </details>
    </article>
  );
}

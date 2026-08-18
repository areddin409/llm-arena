"use client";

import {
  PLACEHOLDER_RANKINGS,
  type PlaceholderRanking,
} from "@/features/shell/placeholder-data";
import { Button } from "@/features/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/features/ui/empty";
import { ModelMark } from "@/features/models/model-mark";
import { PlaceholderNotice } from "@/features/ui/placeholder-notice";
import { ToggleGroup, ToggleGroupItem } from "@/features/ui/toggle-group";
import { cn } from "@/features/ui/utils";
import { TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Scope = "global" | "personal";

const SCOPES: readonly { readonly value: Scope; readonly label: string }[] = [
  { value: "global", label: "Global" },
  { value: "personal", label: "Personal" },
];

function RankRow({
  ranking,
  rank,
}: {
  readonly ranking: PlaceholderRanking;
  readonly rank: number;
}) {
  const winRate = ranking.wins / ranking.votes;
  const isFirst = rank === 1;

  return (
    <tr className={cn("border-t border-border", isFirst && "bg-muted/50")}>
      <td className="px-4 py-4 type-metric text-muted-foreground">{rank}</td>

      <td className="px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <ModelMark modelId={ranking.modelId} />
          <span className="truncate text-sm font-medium">
            {ranking.modelName}
          </span>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="type-display text-2xl text-primary">
            {Math.round(winRate * 100)}%
          </span>
          <div className="min-w-24">
            {/*
              Never a bare percentage: the count it came from sits beside it, so
              a model that won 4 of 5 can never read like one that won 400 of
              500. The bar is the accent, which is the one place a win rate is
              allowed to use it.
            */}
            <p className="type-metric text-muted-foreground">
              Won {ranking.wins} of {ranking.votes}
            </p>
            <div
              aria-hidden="true"
              className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${winRate * 100}%` }}
              />
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 text-right type-metric text-muted-foreground">
        {ranking.avgTtftMs}ms
      </td>

      <td className="px-4 py-4 text-right type-metric text-muted-foreground">
        {ranking.avgTokensPerSecond} tok/s
      </td>
    </tr>
  );
}

/**
 * Two leaderboards from the same votes. No cost or "cheapest" column: every
 * model here is free, so that number would never mean anything — the same
 * reason feature 9 rules it out in docs/scope.md.
 */
export function LeaderboardScreen() {
  const [scope, setScope] = useState<Scope>("global");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="type-display text-3xl">Leaderboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every model&apos;s real record, from actual head-to-head votes.
      </p>

      <div className="mt-6">
        <PlaceholderNotice>
          Placeholder rankings. Real votes and per-call numbers land with
          feature 9.
        </PlaceholderNotice>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Leaderboard scope"
        value={scope}
        // A toggle group can be emptied by clicking the active item. There is
        // always one board showing, so an empty value is refused rather than
        // rendering nothing.
        onValueChange={(next) => {
          if (next) setScope(next as Scope);
        }}
        className="mt-6"
      >
        {SCOPES.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {scope === "global" ? (
        <section aria-labelledby="ranking-heading" className="mt-6">
          <h2 id="ranking-heading" className="text-base font-medium">
            Global ranking
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every vote, every user, ranked by real wins.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-3xl border-collapse text-left">
              <thead>
                <tr className="type-eyebrow text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Model
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Win rate
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Avg. to first token
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Avg. tokens/sec
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_RANKINGS.map((ranking, index) => (
                  <RankRow
                    key={ranking.modelId}
                    ranking={ranking}
                    rank={index + 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section aria-labelledby="personal-heading" className="mt-6">
          <h2 id="personal-heading" className="text-base font-medium">
            Your ranking
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Built only from votes you cast yourself.
          </p>

          <Empty className="mt-4 border border-dashed border-border-strong">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TrophyIcon />
              </EmptyMedia>
              <EmptyTitle>You haven&apos;t voted yet</EmptyTitle>
              <EmptyDescription>
                Send a prompt in the arena, then pick the answer you think is
                best. Your own ranking builds from there.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/">Go to the arena</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </section>
      )}
    </div>
  );
}

import { PromptDock } from "@/features/arena/prompt-dock";
import { ResponseColumn } from "@/features/arena/response-column";
import type { CatalogModel } from "@/features/models/catalog-model";
import { type PlaceholderTurn } from "@/features/shell/placeholder-data";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/features/ui/empty";
import { PlaceholderNotice } from "@/features/ui/placeholder-notice";
import { SwordsIcon } from "lucide-react";

type ArenaScreenProps = {
  /**
   * The thread's current turn, or null at `/`, where no thread exists yet.
   * A thread is created by the first prompt — `POST /api/turns` makes it and
   * hands back the ids — so an empty arena is a real state, not a loading one.
   */
  readonly turn: PlaceholderTurn | null;
  /** The models the composer starts with, derived from the live catalog. */
  readonly initialModels: readonly CatalogModel[];
};

/**
 * One turn of the arena: the prompt, then every selected model's answer beside
 * each other, then the composer for the next turn. The column count follows the
 * number of models, one to three.
 */
export function ArenaScreen({ turn, initialModels }: ArenaScreenProps) {
  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4">
      {turn === null ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SwordsIcon />
            </EmptyMedia>
            {/* The heading is a real `h1` inside the vendored title rather
                than a styled `div`. `EmptyTitle` has no `asChild`, and the
                empty arena having no heading at all is what the 2026-08-18
                review flagged. */}
            <EmptyTitle className="type-display text-2xl">
              <h1>Ask three models at once</h1>
            </EmptyTitle>
            <EmptyDescription>
              Send one prompt below and every model you pick answers it side by
              side, timed as it arrives. Vote for the best one when they land.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex-1 pt-4">
          {/* The arena's heading. Visually the prompt below is the real title of
              the screen, so this is `sr-only` rather than absent — a page with
              no h1 leaves a screen reader with nothing to orient on, which the
              2026-08-18 review flagged. */}
          <h1 className="sr-only">Arena</h1>

          <PlaceholderNotice>
            Placeholder answers and numbers. Live streaming and voting land with
            feature 6, and real threads with feature 7.
          </PlaceholderNotice>

          <div className="mt-6 flex justify-end">
            <p className="max-w-lg rounded-xl rounded-br-sm bg-muted px-4 py-2.5 text-sm">
              {turn.prompt}
            </p>
          </div>

          <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {turn.responses.map((response) => (
              <li key={response.modelId} className="flex">
                <ResponseColumn response={response} axisMs={turn.axisMs} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <PromptDock initialModels={initialModels} />
    </div>
  );
}

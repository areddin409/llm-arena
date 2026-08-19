import "server-only";

import { z } from "zod";

import type { CatalogModel } from "@/features/models/catalog-model";
import { stripFreeSuffix } from "@/features/models/model-name";

/**
 * OpenRouter's live model list, fetched on the server and cached.
 *
 * The endpoint is public and unauthenticated, so this needs no key and adds no
 * environment variable. What it does need is trimming: the real response is 415
 * models and roughly 680 KB, of which this app reads six fields per entry.
 *
 * Cached for an hour through Next's own `fetch` cache rather than a module-level
 * variable, so the cache is shared across requests and survives the way a
 * serverless instance actually lives. The list changes at most daily.
 */

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const REVALIDATE_SECONDS = 3600;

/** A hung upstream must not hold a page open. */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Deliberately loose. Extra fields are ignored, because OpenRouter adds them and
 * a strict schema would turn a harmless addition into an outage. Every field
 * read below is required, because an entry missing one cannot be rendered.
 */
const entrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  context_length: z.number().int().positive(),
  architecture: z.object({
    output_modalities: z.array(z.string()),
  }),
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
  }),
});

const responseSchema = z.object({ data: z.array(z.unknown()) });

type Entry = z.infer<typeof entrySchema>;

/** OpenRouter quotes a price in USD per token, as a string. */
const perMillion = (usdPerToken: string): number =>
  Number(usdPerToken) * 1_000_000;

/**
 * This arena sends text and renders text. A model that emits an image or audio
 * has no column to be drawn in, so it is not a candidate — and the check is on
 * the output modalities being *exactly* text, since several image generators
 * list `image` alongside it and would otherwise pass a `.includes("text")`.
 */
const emitsOnlyText = (entry: Entry): boolean =>
  entry.architecture.output_modalities.length === 1 &&
  entry.architecture.output_modalities[0] === "text";

/**
 * OpenRouter keeps its own namespace for *routers* rather than models —
 * `openrouter/free`, `openrouter/fusion`, `openrouter/auto`. Each one picks some
 * other model per request.
 *
 * They have no place in an arena whose entire output is a ranking of which model
 * is worth using: a row that means "whichever one it chose that time" cannot be
 * compared against a named model, and every vote it won would be attributed to
 * nothing. Excluding them also closes a gap found by running this — `openrouter/free`
 * is genuinely zero-priced, so it landed in the picker's free group while
 * `freeModelIdSchema` would have refused the id at `POST /api/turns` for having
 * no `:free` suffix. The picker must only offer what the API will accept.
 */
const isRouter = (entry: Entry): boolean => entry.id.startsWith("openrouter/");

const toModel = (entry: Entry): CatalogModel => {
  const promptUsdPerMillion = perMillion(entry.pricing.prompt);
  const completionUsdPerMillion = perMillion(entry.pricing.completion);

  return {
    id: entry.id,
    name: stripFreeSuffix(entry.name),
    contextWindow: entry.context_length,
    promptUsdPerMillion,
    completionUsdPerMillion,
    free: promptUsdPerMillion === 0 && completionUsdPerMillion === 0,
  };
};

/**
 * Biggest context window first, which is the ordering feature 5 asks for, with
 * the name breaking ties so the list does not reshuffle between fetches — a
 * catalog that reorders itself for no reason is one nobody can scan twice.
 */
const byContextWindowThenName = (a: CatalogModel, b: CatalogModel): number =>
  b.contextWindow - a.contextWindow || a.name.localeCompare(b.name);

export type CatalogResult =
  | { readonly ok: true; readonly models: readonly CatalogModel[] }
  | { readonly ok: false };

/**
 * The catalog, or a plain failure. This never throws and never returns a stale
 * vendored snapshot.
 *
 * The snapshot is worth saying no to explicitly, because it is the obvious
 * mitigation: OpenRouter's free tier churns hard enough that three of the six
 * model ids written into this repo days earlier had already been withdrawn by
 * the time this was built. A fallback list would confidently offer models that
 * no longer exist, which is worse than saying the list is unavailable.
 */
export async function fetchCatalog(): Promise<CatalogResult> {
  try {
    const response = await fetch(MODELS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      console.error(
        `[catalog] OpenRouter returned ${response.status} ${response.statusText}`,
      );
      return { ok: false };
    }

    const body: unknown = await response.json();
    const parsed = responseSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[catalog] unexpected response shape", parsed.error.issues);
      return { ok: false };
    }

    // Per entry rather than per list: one malformed model should cost that
    // model, not the whole catalog.
    const models = parsed.data.data
      .map((entry) => entrySchema.safeParse(entry))
      .flatMap((result) => (result.success ? [result.data] : []))
      .filter((entry) => emitsOnlyText(entry) && !isRouter(entry))
      .map(toModel)
      .sort(byContextWindowThenName);

    if (models.length === 0) {
      console.error("[catalog] no usable models in the response");
      return { ok: false };
    }

    return { ok: true, models };
  } catch (error) {
    console.error("[catalog] could not reach OpenRouter", error);
    return { ok: false };
  }
}

/**
 * Which of these model ids OpenRouter no longer lists.
 *
 * Feature 1 parked this check ("the live free-tier list should also be checked
 * against once it exists") and churn is what makes it worth collecting: an id
 * that was valid last week is now a common failure rather than an exotic one,
 * and without this it surfaces three streams later as a provider error.
 *
 * **It degrades to allowing everything when the catalog is unavailable, and that
 * is deliberate.** This runs in front of a database write. If a brief OpenRouter
 * outage could refuse turns, an outage over there would become an outage here,
 * for a check that is a courtesy rather than a safeguard — the money gate is the
 * `:free` suffix on the id, which is read from the id itself and does not depend
 * on this.
 */
export async function withdrawnModelIds(
  ids: readonly string[],
): Promise<readonly string[]> {
  const catalog = await fetchCatalog();

  if (!catalog.ok) return [];

  const known = new Set(catalog.models.map((model) => model.id));
  return ids.filter((id) => !known.has(id));
}

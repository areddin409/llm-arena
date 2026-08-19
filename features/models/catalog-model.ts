/**
 * The shape of a catalog entry, and the two formatters that render its numbers.
 *
 * Deliberately separate from `catalog.ts`, which is `server-only`: the picker is
 * a client component and needs this type and these formatters. A `server-only`
 * module cannot be imported from the browser at all, so splitting the vocabulary
 * out is what lets both sides speak it.
 */

export type CatalogModel = {
  /** An OpenRouter id — `google/gemma-4-31b-it:free`. */
  readonly id: string;
  /** Display name with OpenRouter's ` (free)` suffix removed. */
  readonly name: string;
  readonly contextWindow: number;
  readonly promptUsdPerMillion: number;
  readonly completionUsdPerMillion: number;
  /**
   * Whether OpenRouter charges nothing for this model, read from its `pricing`
   * rather than from the `:free` suffix on its id. The two are not the same
   * question: a handful of zero-priced models carry no suffix. The suffix stays
   * the money gate, because that is what `/api/chat` can read back off a stored
   * row; this is what a screen shows.
   */
  readonly free: boolean;
};

/**
 * A context window, shortened the way the numbers actually cluster: OpenRouter's
 * range runs from about 4,000 to 2,000,000, so thousands and millions are the
 * only two magnitudes worth a suffix.
 */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (tokens >= 1_000) {
    const thousands = tokens / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }

  return tokens.toLocaleString("en-US");
}

/**
 * A price per million tokens, to the cent.
 *
 * Two decimal places are enough to be honest here, which is worth stating
 * because it is a property of the data rather than a guess: the cheapest
 * non-zero rate OpenRouter currently lists is $0.01 per million, so nothing real
 * rounds down. A displayed `$0.00` therefore always means genuinely free, never
 * "too small to show" — which is the distinction this whole app is built on.
 */
export function formatUsdPerMillion(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

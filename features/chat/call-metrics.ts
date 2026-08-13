/**
 * Per-call speed numbers, measured on the server.
 *
 * Server-side is deliberate. Timing on the client would fold the user's own
 * network into every number, so a model would look slow because someone is on
 * hotel wifi. These are the model's numbers, not the connection's.
 *
 * No cost field. Every model in this arena is free tier, so the honest cost is
 * always $0.0000 — that gets rendered from a constant, not measured here.
 */
export type CallMetrics = {
  /** Provider request sent → first token out. Null if nothing ever streamed. */
  readonly timeToFirstTokenMs: number | null;
  /** First token → last token. The generation window, excluding the wait. */
  readonly generationMs: number | null;
  /** Request sent → stream closed. What the user actually waited. */
  readonly totalMs: number;
  readonly outputTokens: number | null;
  /** Output tokens over the generation window, not over the total. */
  readonly tokensPerSecond: number | null;
};

type CallTimestamps = {
  readonly startedAt: number;
  readonly firstTokenAt: number | null;
  readonly finishedAt: number;
  /**
   * How many content chunks actually arrived. A provider that returns the
   * whole answer in one chunk has no measurable generation rate — first and
   * last token land at the same instant — so a rate is not reported rather
   * than reported as an enormous fiction.
   */
  readonly contentChunks: number;
};

const roundTo = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Pure: timestamps and a token count in, metrics out. All the arithmetic lives
 * here so it can be reasoned about without a running model behind it.
 */
export const computeCallMetrics = (
  timestamps: CallTimestamps,
  outputTokens: number | undefined,
): CallMetrics => {
  const { startedAt, firstTokenAt, finishedAt, contentChunks } = timestamps;

  const timeToFirstTokenMs =
    firstTokenAt === null ? null : firstTokenAt - startedAt;
  const generationMs = firstTokenAt === null ? null : finishedAt - firstTokenAt;
  const tokens = outputTokens ?? null;

  const rateIsMeasurable =
    tokens !== null &&
    generationMs !== null &&
    generationMs > 0 &&
    contentChunks > 1;

  const tokensPerSecond =
    rateIsMeasurable && generationMs !== null && tokens !== null
      ? roundTo(tokens / (generationMs / 1000), 1)
      : null;

  return {
    timeToFirstTokenMs,
    generationMs,
    totalMs: finishedAt - startedAt,
    outputTokens: tokens,
    tokensPerSecond,
  };
};

export type CallTimer = {
  /**
   * Call once per content chunk, reasoning or text alike. Reasoning tokens are
   * output tokens as far as the provider's own count is concerned, so a clock
   * that ignored them would divide a full token count by a partial window.
   */
  readonly markContentChunk: () => void;
  readonly read: (outputTokens: number | undefined) => CallMetrics;
};

/**
 * The one place a mutable cell is allowed, and it is scoped to a single
 * request: a stopwatch cannot be pure. Everything it produces goes through
 * `computeCallMetrics`, which is.
 */
export const createCallTimer = (now: () => number = Date.now): CallTimer => {
  const startedAt = now();
  let firstTokenAt: number | null = null;
  let contentChunks = 0;

  return {
    markContentChunk: () => {
      if (firstTokenAt === null) {
        firstTokenAt = now();
      }
      contentChunks += 1;
    },
    read: (outputTokens) =>
      computeCallMetrics(
        { startedAt, firstTokenAt, finishedAt: now(), contentChunks },
        outputTokens,
      ),
  };
};

import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * One request carries exactly one model. Three selected models means three
 * independent POSTs to this endpoint, not one request fanned out server-side —
 * that is what lets a single model be slow, or fail outright, without taking
 * the other answers down with it.
 *
 * The body names a response row and nothing else. Everything that reaches the
 * model — which model, the prompt, and the whole prior conversation — is read
 * from the database, because the database already holds all of it.
 *
 * That is the end of a short series of holes, and the shape is the lesson. The
 * model id travelled here once, and could be pointed at someone else's row. Then
 * the prompt could differ from the turn's, so an answer was filed under a
 * question the model never saw. Then the prompt could be correct but followed by
 * a trailing assistant turn that steered it. Then the prompt could be correct
 * and last, with fabricated history in front of it. Each fix validated one more
 * field, and each time the caller found the next one. Nothing sent from the
 * browser is trusted now because nothing needs to be sent.
 *
 * `.strict()` on purpose: a stale client still posting `messages` gets a plain
 * 400 rather than having its history quietly ignored, which would look like the
 * server obeying it.
 */
export const chatRequestSchema = z
  .object({
    modelResponseId: z.string().min(1).max(64),
  })
  .strict();

export type ChatRequest = Readonly<z.infer<typeof chatRequestSchema>>;

/**
 * Metadata sent down the stream alongside the text. `start` carries the model
 * id so a client rendering three streams can tell them apart; `finish` carries
 * the real measured numbers.
 */
export type ChatMessageMetadata = {
  readonly modelId?: string;
  /** Lets a client match a stream to the row it is filling in. */
  readonly modelResponseId?: string;
  readonly timeToFirstTokenMs?: number | null;
  readonly tokensPerSecond?: number | null;
  readonly outputTokens?: number | null;
  readonly totalMs?: number;
};

/** The message shape both sides of the stream agree on. */
export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

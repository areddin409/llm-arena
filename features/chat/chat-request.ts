import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * One request carries exactly one model. Three selected models means three
 * independent POSTs to this endpoint, not one request fanned out server-side —
 * that is what lets a single model be slow, or fail outright, without taking
 * the other answers down with it.
 *
 * Which model that is no longer travels in the body. `POST /api/turns` creates a
 * PENDING `ModelResponse` per selected model and validated each id against the
 * free-tier shape when it did; this request names the row, and the server reads
 * the model id back off it. That closes a gap the old shape left open — a caller
 * could pair a legitimate response id with a different model — and it is why
 * `freeModelIdSchema` is no longer applied here. It still guards the id where
 * the id actually arrives, in `turn-request.ts`.
 */
export const chatRequestSchema = z.object({
  modelResponseId: z.string().min(1).max(64),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

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

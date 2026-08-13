import type { UIMessage } from "ai";
import { z } from "zod";

/**
 * One request carries exactly one model. Three selected models means three
 * independent POSTs to this endpoint, not one request fanned out server-side —
 * that is what lets a single model be slow, or fail outright, without taking
 * the other answers down with it.
 */
export const chatRequestSchema = z.object({
  modelId: z.string().min(1),
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
  readonly timeToFirstTokenMs?: number | null;
  readonly tokensPerSecond?: number | null;
  readonly outputTokens?: number | null;
  readonly totalMs?: number;
};

/** The message shape both sides of the stream agree on. */
export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

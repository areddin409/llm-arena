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

export type ChatMessage = ChatRequest["messages"][number];

/**
 * The messages a caller sends must *end* with the prompt the turn recorded.
 *
 * The turn stores one canonical prompt and every metric, vote and leaderboard row
 * is attributed to it — but the text the model receives comes from the request
 * body. Nothing used to tie the two together, so a caller could hold a legitimate
 * pending response id and send entirely different text: the model would answer
 * that, and the answer plus its speed numbers would be filed under a prompt the
 * model never saw. That is a quiet corruption of exactly the data this app exists
 * to collect.
 *
 * The check is on the last message, not the last *user* message, and the
 * difference matters. Searching backwards for the most recent user message let a
 * caller append a trailing assistant turn after the real prompt — an
 * assistant-prefill, a well-known way to steer a model's answer. The prompt was
 * present, so the check passed, while the model's actual final input was the
 * injected text and the answer it produced still landed under the turn's prompt.
 * Requiring the conversation to end on the prompt closes that, and costs nothing:
 * a genuine turn always ends on the question being asked.
 *
 * Earlier messages are not checked and should not be. They are history the client
 * legitimately owns and replays — each model carries its own separate
 * conversation, so the server cannot reconstruct it — but the question being
 * asked right now is the turn's, and it has to be the last word.
 */
export const endsWithPrompt = (
  messages: readonly ChatMessage[],
  prompt: string,
): boolean => {
  const lastMessage = messages.at(-1);

  return lastMessage?.role === "user" && lastMessage.content === prompt;
};

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

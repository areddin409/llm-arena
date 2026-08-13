import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";

import { createCallTimer } from "@/features/chat/call-metrics";
import {
  chatRequestSchema,
  type ChatMessageMetadata,
  type ChatUIMessage,
} from "@/features/chat/chat-request";
import { chatModel } from "@/features/models/openrouter";
import {
  arcjetChat,
  CHAT_TOKENS_PER_CALL,
  refusalFor,
} from "@/features/security/arcjet";

/**
 * One model, one request, one stream.
 *
 * The arena sends three of these at once, in parallel, rather than asking the
 * server to fan out behind a single connection. That costs an extra round of
 * plumbing on the client and buys the thing the product depends on: one model
 * being slow, rate-limited, or down cannot touch the other two answers.
 *
 * Not here yet, on purpose:
 * - Persisting the answer and its metrics needs the data model, feature 3.
 * - PostHog events and LLM analytics land with feature 6.
 */

/** Streaming to a free-tier model can outlast a platform's stingier default. */
export const maxDuration = 60;

const plainly = (sentence: string, status: number): Response =>
  Response.json({ error: sentence }, { status });

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();

  if (userId === null) {
    return plainly("You need to be signed in to send a prompt.", 401);
  }

  // Before the body is even read, and long before OpenRouter is called. The
  // user id comes from Clerk on the server, never from the request, so the
  // rate limit cannot be sidestepped by sending a different header.
  const decision = await arcjetChat.protect(request, {
    userId,
    requested: CHAT_TOKENS_PER_CALL,
  });

  if (decision.isDenied()) {
    const refusal = refusalFor(decision);

    return plainly(refusal.sentence, refusal.status);
  }

  if (decision.isErrored()) {
    // Arcjet failed open. Log it and let the prompt through — the arena being
    // down because its rate limiter is down would be the worse outcome.
    console.error("[chat] arcjet could not decide", decision.reason);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return plainly("That request didn't look right. Try sending it again.", 400);
  }

  const { modelId, messages } = parsed.data;
  const timer = createCallTimer();

  const result = streamText({
    model: chatModel(modelId),
    messages: messages.map((message) => ({ ...message })),
    onChunk: ({ chunk }) => {
      // Reasoning deltas count. A reasoning model can think for seconds before
      // emitting a word, and those thinking tokens are billed and reported in
      // `outputTokens`. Starting the clock at the first *text* delta measured
      // the tokens/sec numerator over a window that excluded most of them, and
      // produced rates like 22,000 tokens/sec.
      if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") {
        timer.markContentChunk();
      }
    },
    onError: ({ error }) => {
      // The user gets a plain sentence; the detail belongs in the server log.
      console.error(`[chat] model ${modelId} failed`, error);
    },
  });

  return result.toUIMessageStreamResponse<ChatUIMessage>({
    messageMetadata: ({ part }): ChatMessageMetadata | undefined => {
      if (part.type === "start") {
        return { modelId };
      }

      if (part.type === "finish") {
        const metrics = timer.read(part.totalUsage.outputTokens);
        return {
          modelId,
          timeToFirstTokenMs: metrics.timeToFirstTokenMs,
          tokensPerSecond: metrics.tokensPerSecond,
          outputTokens: metrics.outputTokens,
          totalMs: metrics.totalMs,
        };
      }

      return undefined;
    },
    // Never leak a provider exception to the browser.
    onError: () => "That model didn't answer. You can try it again.",
  });
}

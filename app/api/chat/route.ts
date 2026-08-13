import { streamText } from "ai";

import { createCallTimer } from "@/features/chat/call-metrics";
import {
  chatRequestSchema,
  type ChatMessageMetadata,
  type ChatUIMessage,
} from "@/features/chat/chat-request";
import {
  claimResponse,
  completeResponse,
  failResponse,
  type ClaimFailure,
} from "@/features/chat/persist-response";
import { badRequest, plainly } from "@/features/http/plain-response";
import { chatModel } from "@/features/models/openrouter";
import { arcjetChat, CHAT_TOKENS_PER_CALL } from "@/features/security/arcjet";
import { guard } from "@/features/security/guard";

/**
 * One model, one request, one stream.
 *
 * The arena sends three of these at once, in parallel, rather than asking the
 * server to fan out behind a single connection. That costs an extra round of
 * plumbing on the client and buys the thing the product depends on: one model
 * being slow, rate-limited, or down cannot touch the other two answers.
 *
 * Each call is handed a `modelResponseId` that `POST /api/turns` already
 * created as PENDING, so three concurrent calls update three distinct rows and
 * never race to create the turn they share.
 *
 * Not here yet, on purpose: PostHog events and LLM analytics land with feature 6.
 */

/** Streaming to a free-tier model can outlast a platform's stingier default. */
export const maxDuration = 60;

const refusalFor = (failure: ClaimFailure): Response => {
  switch (failure.reason) {
    case "not-found":
      return plainly("That prompt doesn't exist.", 404);
    case "not-yours":
      return plainly("That conversation belongs to someone else.", 403);
    case "already-answered":
      return plainly("That model has already answered this prompt.", 409);
  }
};

export async function POST(request: Request): Promise<Response> {
  const guarded = await guard({
    request,
    client: arcjetChat,
    requested: CHAT_TOKENS_PER_CALL,
  });

  if (!guarded.ok) {
    return guarded.response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest();
  }

  const { modelResponseId, messages } = parsed.data;

  // Before the provider is called: the row must exist, belong to this caller's
  // conversation, and still be unanswered. Anything else and no money is spent.
  const claim = await claimResponse(guarded.userId, modelResponseId);

  if (!claim.ok) {
    return refusalFor(claim);
  }

  const { modelId } = claim;
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
    onFinish: async ({ text, totalUsage }) => {
      // The same numbers the stream reports to the browser, written down. If
      // this throws the user has already had their answer, so it is logged
      // rather than surfaced — a lost row is better than a broken stream.
      try {
        await completeResponse(
          modelResponseId,
          text,
          timer.read(totalUsage.outputTokens),
          {
            inputTokens: totalUsage.inputTokens,
            totalTokens: totalUsage.totalTokens,
          },
        );
      } catch (error) {
        console.error(
          `[chat] could not persist response ${modelResponseId}`,
          error,
        );
      }
    },
    onError: async ({ error }) => {
      // The user gets a plain sentence; the detail belongs in the server log.
      console.error(`[chat] model ${modelId} failed`, error);

      try {
        await failResponse(modelResponseId);
      } catch (persistError) {
        console.error(
          `[chat] could not mark response ${modelResponseId} failed`,
          persistError,
        );
      }
    },
  });

  return result.toUIMessageStreamResponse<ChatUIMessage>({
    messageMetadata: ({ part }): ChatMessageMetadata | undefined => {
      if (part.type === "start") {
        return { modelId, modelResponseId };
      }

      if (part.type === "finish") {
        const metrics = timer.read(part.totalUsage.outputTokens);
        return {
          modelId,
          modelResponseId,
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

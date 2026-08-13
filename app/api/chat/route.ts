import { streamText } from "ai";

import { createCallTimer } from "@/features/chat/call-metrics";
import {
  chatRequestSchema,
  type ChatMessageMetadata,
  type ChatUIMessage,
} from "@/features/chat/chat-request";
import { buildConversation } from "@/features/chat/conversation";
import {
  claimResponse,
  completeResponse,
  failResponse,
  releaseResponse,
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
    case "in-progress":
      return plainly("That model is already answering this prompt.", 409);
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

  const { modelResponseId } = parsed.data;

  // Before the provider is called: the row must exist, belong to this caller's
  // conversation, and be claimable. The claim reserves it atomically, so two
  // overlapping requests for the same row cannot both reach a model.
  const claim = await claimResponse(guarded.userId, modelResponseId);

  if (!claim.ok) {
    return refusalFor(claim);
  }

  const { modelId, startedAt } = claim;

  // Assembled from the thread, not from the request. What the model receives is
  // therefore exactly what the answer will be stored against, by construction
  // rather than by a check the next caller finds a way around.
  const messages = await buildConversation(
    claim.threadId,
    claim.turnIndex,
    modelId,
    claim.prompt,
  ).catch((error: unknown) => {
    console.error(
      `[chat] could not rebuild the conversation for ${modelResponseId}`,
      error,
    );

    return null;
  });

  if (messages === null) {
    // Hand the reservation straight back rather than letting it sit until the
    // 120s expiry. Nothing was attempted, and the person can retry now.
    await releaseResponse(modelResponseId, startedAt);

    return plainly("Something went wrong. You can try that again.", 500);
  }

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
        const written = await completeResponse(
          modelResponseId,
          startedAt,
          text,
          timer.read(totalUsage.outputTokens),
          {
            inputTokens: totalUsage.inputTokens,
            totalTokens: totalUsage.totalTokens,
          },
        );

        if (!written) {
          // Our reservation expired and someone else took the row over. Dropping
          // this write is the correct outcome; it is logged because it means a
          // call ran long enough to lose its lease, which is worth knowing.
          console.warn(
            `[chat] reservation lost, discarded answer for ${modelResponseId}`,
          );
        }
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
        await failResponse(modelResponseId, startedAt);
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

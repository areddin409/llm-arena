import "server-only";

import {
  isUniqueViolation,
  prisma,
  TRANSACTION_OPTIONS,
  type TransactionClient,
} from "@/features/database/prisma";
import type { TurnRequest } from "@/features/turns/turn-request";
import { upsertUser } from "@/features/users/upsert-user";

/**
 * Creating a turn is the whole answer to the race that feature 1 parked.
 *
 * One arena prompt is up to three parallel POSTs to `/api/chat`, and if each of
 * those tried to create the turn they share, they would race. So none of them
 * does: this runs first, alone, and creates the thread (if new), the turn, and
 * one PENDING response per model in a single transaction. The streaming calls
 * that follow only ever *update* a row that already exists, each holding an id
 * nobody else holds.
 *
 * Everything here is one transaction on purpose, the lazy user upsert included.
 * A half-created turn — a user row with no thread, a turn with no responses —
 * would be worse than a failed request, because nothing downstream would know
 * to clean it up.
 */

export type CreatedResponse = {
  readonly modelResponseId: string;
  readonly modelId: string;
};

export type CreateTurnSuccess = {
  readonly ok: true;
  readonly threadId: string;
  readonly turnId: string;
  readonly index: number;
  readonly responses: readonly CreatedResponse[];
};

export type CreateTurnFailure = {
  readonly ok: false;
  readonly reason: "thread-not-found" | "thread-not-yours" | "turn-conflict";
};

export type CreateTurnResult = CreateTurnSuccess | CreateTurnFailure;

/**
 * Resolves which thread the turn belongs to, creating one if the caller did not
 * name an existing thread.
 *
 * Threads are readable by anyone with the link (feature 8), so a thread that
 * exists but belongs to someone else is not a secret — it gets its own honest
 * answer rather than being disguised as missing.
 */
const resolveThread = async (
  tx: TransactionClient,
  userId: string,
  threadId: string | undefined,
): Promise<
  { readonly ok: true; readonly threadId: string } | CreateTurnFailure
> => {
  if (threadId === undefined) {
    const thread = await tx.thread.create({
      data: { userId },
      select: { id: true },
    });

    return { ok: true, threadId: thread.id };
  }

  const existing = await tx.thread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true },
  });

  if (existing === null) {
    return { ok: false, reason: "thread-not-found" };
  }

  if (existing.userId !== userId) {
    return { ok: false, reason: "thread-not-yours" };
  }

  return { ok: true, threadId: existing.id };
};

export const createTurn = async (
  clerkUserId: string,
  request: TurnRequest,
): Promise<CreateTurnResult> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const userId = await upsertUser(tx, clerkUserId);
      const thread = await resolveThread(tx, userId, request.threadId);

      if (!thread.ok) {
        return thread;
      }

      // Turns are numbered per thread so a model's own conversation can be
      // replayed in order. Counting inside the transaction is safe against
      // anything but the same person submitting two prompts to one thread at
      // the same instant, which the unique index catches below.
      const index = await tx.turn.count({
        where: { threadId: thread.threadId },
      });

      const turn = await tx.turn.create({
        data: { threadId: thread.threadId, index, prompt: request.prompt },
        select: { id: true },
      });

      const responses = await tx.modelResponse.createManyAndReturn({
        data: request.models.map((model) => ({
          turnId: turn.id,
          modelId: model.id,
          modelName: model.name,
        })),
        select: { id: true, modelId: true },
      });

      // Touching the thread keeps the sidebar's "newest first" ordering in
      // feature 7 honest — a long-running conversation should not sink just
      // because it was started a week ago.
      await tx.thread.update({
        where: { id: thread.threadId },
        data: { updatedAt: new Date() },
      });

      return {
        ok: true,
        threadId: thread.threadId,
        turnId: turn.id,
        index,
        responses: responses.map((response) => ({
          modelResponseId: response.id,
          modelId: response.modelId,
        })),
      };
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    // Two prompts submitted to the same thread at the same moment compute the
    // same index and one loses the race on @@unique([threadId, index]). That is
    // the index doing its job, not a server fault, so it reports as a conflict
    // the caller can simply retry.
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "turn-conflict" };
    }

    throw error;
  }
};

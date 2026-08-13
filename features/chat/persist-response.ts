import "server-only";

import type { CallMetrics } from "@/features/chat/call-metrics";
import { prisma, ResponseStatus } from "@/features/database/prisma";

/**
 * The database side of a streaming call: claim the row before the model is
 * called, then close it out when the stream ends one way or the other.
 *
 * The row already exists — `POST /api/turns` created it PENDING — so nothing
 * here creates anything, which is the entire reason three parallel calls can
 * run without racing.
 */

export type ClaimSuccess = {
  readonly ok: true;
  /**
   * Read from the row, never from the request. The turn is what decided which
   * model answers this slot, and it validated the id against the free-tier
   * shape when it did. Taking the caller's word for it a second time would let
   * a valid response id be pointed at a different model.
   */
  readonly modelId: string;
  readonly turnId: string;
};

export type ClaimFailure = {
  readonly ok: false;
  readonly reason: "not-found" | "not-yours" | "already-answered";
};

export type ClaimResult = ClaimSuccess | ClaimFailure;

/**
 * Confirms the caller owns the conversation this response belongs to and that
 * the slot is still unanswered.
 *
 * Reading a thread is open to everyone (feature 8); writing into one is not. A
 * response id is a cuid, so guessing one is not the threat — a shared link
 * handing someone else's turn ids to a signed-in stranger is, and that stranger
 * must not be able to spend this app's upstream budget filling them in.
 */
export const claimResponse = async (
  clerkUserId: string,
  modelResponseId: string,
): Promise<ClaimResult> => {
  const response = await prisma.modelResponse.findUnique({
    where: { id: modelResponseId },
    select: {
      modelId: true,
      status: true,
      turnId: true,
      turn: {
        select: {
          thread: { select: { user: { select: { clerkUserId: true } } } },
        },
      },
    },
  });

  if (response === null) {
    return { ok: false, reason: "not-found" };
  }

  if (response.turn.thread.user.clerkUserId !== clerkUserId) {
    return { ok: false, reason: "not-yours" };
  }

  // PENDING is the only claimable state. Without this a completed row could be
  // re-run indefinitely, each run costing an upstream call and overwriting a
  // real measurement with a new one.
  if (response.status !== ResponseStatus.PENDING) {
    return { ok: false, reason: "already-answered" };
  }

  return { ok: true, modelId: response.modelId, turnId: response.turnId };
};

export type CompletedUsage = {
  readonly inputTokens: number | undefined;
  readonly totalTokens: number | undefined;
};

/**
 * Writes the answer and its measured numbers. Token counts are recorded exactly
 * as the provider reported them — `totalTokens` is not recomputed from input
 * plus output, because reasoning and cached-input tokens land in a provider's
 * total differently and the arithmetic would quietly invent a number.
 *
 * `costUsd` is left at its zero default: every model here is free tier, so zero
 * is the honest measurement, not a placeholder for one.
 */
export const completeResponse = async (
  modelResponseId: string,
  content: string,
  metrics: CallMetrics,
  usage: CompletedUsage,
): Promise<void> => {
  await prisma.modelResponse.update({
    where: { id: modelResponseId },
    data: {
      status: ResponseStatus.COMPLETE,
      content,
      timeToFirstTokenMs: metrics.timeToFirstTokenMs,
      tokensPerSecond: metrics.tokensPerSecond,
      outputTokens: metrics.outputTokens,
      inputTokens: usage.inputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      totalMs: metrics.totalMs,
      completedAt: new Date(),
    },
  });
};

/**
 * Marks a call that never produced an answer. No column stores the provider's
 * error text: it goes to the server log, and keeping it out of a table the UI
 * reads is how it stays out of the UI.
 */
export const failResponse = async (modelResponseId: string): Promise<void> => {
  await prisma.modelResponse.update({
    where: { id: modelResponseId },
    data: { status: ResponseStatus.FAILED, completedAt: new Date() },
  });
};

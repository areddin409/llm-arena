import "server-only";

import type { CallMetrics } from "@/features/chat/call-metrics";
import { prisma, ResponseStatus } from "@/features/database/prisma";

/**
 * The database side of a streaming call: reserve the row before the model is
 * called, then close it out when the stream ends one way or the other.
 *
 * The row already exists — `POST /api/turns` created it PENDING — so nothing
 * here creates anything, which is the entire reason three parallel calls can
 * run without racing.
 */

/**
 * How long a reservation is honoured before another call may take it over.
 *
 * A stream can die without ever reaching `onFinish` or `onError`: the process is
 * killed, the platform times the function out, the socket drops. Without an
 * expiry that row would sit in STREAMING forever and could never be answered or
 * retried. This is comfortably longer than the route's own `maxDuration` of 60s,
 * so a slow-but-alive call is never stolen from underneath itself.
 */
export const RESERVATION_TTL_MS = 120_000;

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
  /** The turn's canonical prompt, for checking what the caller actually sent. */
  readonly prompt: string;
  /**
   * This reservation's identity. Terminal writes carry it back so a caller whose
   * lease expired cannot overwrite whoever reclaimed the row.
   */
  readonly startedAt: Date;
};

export type ClaimFailure = {
  readonly ok: false;
  readonly reason:
    "not-found" | "not-yours" | "already-answered" | "in-progress";
};

export type ClaimResult = ClaimSuccess | ClaimFailure;

/**
 * Reserves a response row for this caller, or explains why it cannot.
 *
 * The ownership and existence checks are an ordinary read, because their answers
 * cannot change underneath us — a row does not switch threads. The *status*
 * check cannot work that way. Reading PENDING and then calling the provider left
 * a window where two overlapping requests for the same id both read PENDING,
 * both spent an upstream call, and both wrote an answer, with the slower one
 * silently overwriting the faster one's content and metrics. So the status check
 * is not a check at all any more: it is a conditional update, and the row itself
 * decides the winner.
 *
 * Claimable means PENDING (never attempted), FAILED (a retry — a transient
 * provider error must not cost a model its slot in the turn permanently), or
 * STREAMING with an expired reservation. COMPLETE is never claimable; that is
 * what keeps a finished measurement from being overwritten, and what lets the
 * vote rule trust that its count of completed answers only ever rises.
 */
export const claimResponse = async (
  clerkUserId: string,
  modelResponseId: string,
): Promise<ClaimResult> => {
  const response = await prisma.modelResponse.findUnique({
    where: { id: modelResponseId },
    select: {
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

  const startedAt = new Date();
  const staleBefore = new Date(startedAt.getTime() - RESERVATION_TTL_MS);

  // The single atomic gate. Exactly one concurrent caller can match these
  // conditions and move the row, and `count` tells us whether we were that one.
  const claimed = await prisma.modelResponse.updateMany({
    where: {
      id: modelResponseId,
      OR: [
        { status: ResponseStatus.PENDING },
        { status: ResponseStatus.FAILED },
        {
          status: ResponseStatus.STREAMING,
          startedAt: { lt: staleBefore },
        },
      ],
    },
    data: { status: ResponseStatus.STREAMING, startedAt },
  });

  if (claimed.count === 0) {
    // We lost, or it was never claimable. Re-read only to give an honest reason.
    const current = await prisma.modelResponse.findUnique({
      where: { id: modelResponseId },
      select: { status: true },
    });

    return {
      ok: false,
      reason:
        current?.status === ResponseStatus.STREAMING
          ? "in-progress"
          : "already-answered",
    };
  }

  const claimedRow = await prisma.modelResponse.findUnique({
    where: { id: modelResponseId },
    select: { modelId: true, turnId: true, turn: { select: { prompt: true } } },
  });

  if (claimedRow === null) {
    // The turn was deleted between the update and this read. Vanishingly
    // unlikely, but reporting it as missing is truthful and costs nothing.
    return { ok: false, reason: "not-found" };
  }

  return {
    ok: true,
    modelId: claimedRow.modelId,
    turnId: claimedRow.turnId,
    prompt: claimedRow.turn.prompt,
    startedAt,
  };
};

export type CompletedUsage = {
  readonly inputTokens: number | undefined;
  readonly totalTokens: number | undefined;
};

/**
 * Every terminal write is conditioned on the reservation still being ours.
 *
 * `startedAt` is the lease's identity, so if this call's reservation expired and
 * another request reclaimed the row, `updateMany` matches nothing and this write
 * is dropped rather than clobbering the newer answer. Returns whether the write
 * actually landed, so a dropped one can be logged rather than assumed.
 */
const finishResponse = async (
  modelResponseId: string,
  startedAt: Date,
  data: Parameters<typeof prisma.modelResponse.updateMany>[0]["data"],
): Promise<boolean> => {
  const result = await prisma.modelResponse.updateMany({
    where: { id: modelResponseId, startedAt, status: ResponseStatus.STREAMING },
    data,
  });

  return result.count === 1;
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
  startedAt: Date,
  content: string,
  metrics: CallMetrics,
  usage: CompletedUsage,
): Promise<boolean> =>
  finishResponse(modelResponseId, startedAt, {
    status: ResponseStatus.COMPLETE,
    content,
    timeToFirstTokenMs: metrics.timeToFirstTokenMs,
    tokensPerSecond: metrics.tokensPerSecond,
    outputTokens: metrics.outputTokens,
    inputTokens: usage.inputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    totalMs: metrics.totalMs,
    completedAt: new Date(),
  });

/**
 * Hands a reservation back without recording an attempt, for a request rejected
 * after it was claimed but before any model was called.
 *
 * PENDING, not FAILED: nothing was tried and no model misbehaved, so the row
 * should look exactly as it did before — otherwise a malformed request would
 * leave a turn permanently showing a model that "failed".
 */
export const releaseResponse = async (
  modelResponseId: string,
  startedAt: Date,
): Promise<boolean> =>
  finishResponse(modelResponseId, startedAt, {
    status: ResponseStatus.PENDING,
    startedAt: null,
  });

/**
 * Marks a call that never produced an answer. No column stores the provider's
 * error text: it goes to the server log, and keeping it out of a table the UI
 * reads is how it stays out of the UI.
 *
 * FAILED is deliberately re-claimable. Free-tier models are rate-limited
 * upstream constantly, and a transient failure costing a model its place in the
 * turn permanently would make the arena's comparison less honest, not more.
 */
export const failResponse = async (
  modelResponseId: string,
  startedAt: Date,
): Promise<boolean> =>
  finishResponse(modelResponseId, startedAt, {
    status: ResponseStatus.FAILED,
    completedAt: new Date(),
  });

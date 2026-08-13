import "server-only";

import {
  isUniqueViolation,
  prisma,
  ResponseStatus,
  TRANSACTION_OPTIONS,
} from "@/features/database/prisma";
import { upsertUser } from "@/features/users/upsert-user";
import type { VoteRequest } from "@/features/votes/vote-request";

/**
 * "A vote only exists once two or more models actually answered."
 *
 * That rule is enforced in two places on purpose, and this file is one of them.
 * The database holds what it can state declaratively: one vote per person per
 * turn (`@@unique([turnId, userId])`), and a winner that genuinely belongs to
 * the turn being voted on (the composite foreign key from
 * `Vote(modelResponseId, turnId)` to `ModelResponse(id, turnId)`). Postgres
 * cannot express "two or more related rows are COMPLETE" in a CHECK without a
 * trigger or a denormalized counter, and neither earns its keep when the only
 * writer is this function.
 *
 * Counting here is safe for one specific reason, worth not rediscovering the
 * hard way: `ResponseStatus` only ever moves one way. A response goes PENDING →
 * COMPLETE or PENDING → FAILED once and never back, so the count of completed
 * responses rises and never falls. The usual check-then-write hazard therefore
 * cannot bite in the direction that matters — the worst case is refusing a vote
 * a few milliseconds before a second answer lands, on a turn whose UI has not
 * rendered that answer yet either. If a response could ever un-complete, this
 * would have to move into the database.
 */

/** A turn with fewer completed answers than this has nothing to compare. */
export const MIN_ANSWERS_FOR_VOTE = 2;

export type CastVoteSuccess = {
  readonly ok: true;
  readonly voteId: string;
  readonly turnId: string;
  readonly modelResponseId: string;
};

export type CastVoteFailure = {
  readonly ok: false;
  readonly reason:
    | "turn-not-found"
    | "not-enough-answers"
    | "response-not-in-turn"
    | "response-not-complete"
    | "already-voted";
};

export type CastVoteResult = CastVoteSuccess | CastVoteFailure;

export const castVote = async (
  clerkUserId: string,
  request: VoteRequest,
): Promise<CastVoteResult> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const userId = await upsertUser(tx, clerkUserId);

      const turn = await tx.turn.findUnique({
        where: { id: request.turnId },
        select: { id: true, responses: { select: { id: true, status: true } } },
      });

      if (turn === null) {
        return { ok: false, reason: "turn-not-found" };
      }

      const completed = turn.responses.filter(
        (response) => response.status === ResponseStatus.COMPLETE,
      );

      if (completed.length < MIN_ANSWERS_FOR_VOTE) {
        return { ok: false, reason: "not-enough-answers" };
      }

      const chosen = turn.responses.find(
        (response) => response.id === request.modelResponseId,
      );

      if (chosen === undefined) {
        return { ok: false, reason: "response-not-in-turn" };
      }

      // A model that failed, or is still streaming, cannot be the winner. The
      // composite foreign key would happily accept it — it only checks the
      // response belongs to this turn — so the status check has to live here.
      if (chosen.status !== ResponseStatus.COMPLETE) {
        return { ok: false, reason: "response-not-complete" };
      }

      const vote = await tx.vote.create({
        data: {
          turnId: turn.id,
          modelResponseId: chosen.id,
          userId,
        },
        select: { id: true },
      });

      return {
        ok: true,
        voteId: vote.id,
        turnId: turn.id,
        modelResponseId: chosen.id,
      };
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    // Two votes from one person racing each other: whichever loses hits
    // @@unique([turnId, userId]). The constraint is the real guarantee here —
    // no amount of checking first would close that window.
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "already-voted" };
    }

    throw error;
  }
};

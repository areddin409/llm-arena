import { badRequest, plainly } from "@/features/http/plain-response";
import { arcjetWrite } from "@/features/security/arcjet";
import { guard } from "@/features/security/guard";
import { castVote, type CastVoteFailure } from "@/features/votes/cast-vote";
import { voteRequestSchema } from "@/features/votes/vote-request";

/**
 * One person's pick of the best answer in a turn.
 *
 * Signing in is required to vote (feature 8 keeps reading a thread open to
 * everyone and writing to it closed), but owning the thread is not — the whole
 * point of a shareable arena link is that other people can weigh in on it.
 */

const refusalFor = (failure: CastVoteFailure): Response => {
  switch (failure.reason) {
    case "turn-not-found":
      return plainly("That prompt doesn't exist.", 404);
    case "not-enough-answers":
      return plainly(
        "You can only vote once at least two models have answered.",
        409,
      );
    case "response-not-in-turn":
      return plainly("That answer isn't part of this prompt.", 400);
    case "response-not-complete":
      return plainly("That model hasn't finished answering yet.", 409);
    case "already-voted":
      return plainly("You've already voted on this prompt.", 409);
  }
};

export async function POST(request: Request): Promise<Response> {
  const guarded = await guard({ request, client: arcjetWrite });

  if (!guarded.ok) {
    return guarded.response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = voteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest();
  }

  const result = await castVote(guarded.userId, parsed.data);

  if (!result.ok) {
    return refusalFor(result);
  }

  return Response.json(
    {
      voteId: result.voteId,
      turnId: result.turnId,
      modelResponseId: result.modelResponseId,
    },
    { status: 201 },
  );
}

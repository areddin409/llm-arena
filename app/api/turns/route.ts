import { badRequest, plainly } from "@/features/http/plain-response";
import { withdrawnModelIds } from "@/features/models/catalog";
import { arcjetWrite } from "@/features/security/arcjet";
import { guard } from "@/features/security/guard";
import {
  createTurn,
  type CreateTurnFailure,
} from "@/features/turns/create-turn";
import { turnRequestSchema } from "@/features/turns/turn-request";

/**
 * Creates the turn a prompt belongs to, and the PENDING response rows the
 * parallel `/api/chat` calls will fill in.
 *
 * This exists so those calls never race. Three streams that each tried to
 * create the turn they share would need distributed agreement in the hot path;
 * one small write before them needs none. It calls no model and spends nothing
 * upstream, which is why it carries no token-bucket cost — see `arcjetWrite`.
 */

const refusalFor = (failure: CreateTurnFailure): Response => {
  switch (failure.reason) {
    case "thread-not-found":
      return plainly("That conversation doesn't exist.", 404);
    case "thread-not-yours":
      return plainly("That conversation belongs to someone else.", 403);
    case "turn-conflict":
      // Two prompts hit one thread at the same instant and the unique index on
      // (threadId, index) refused the loser. Genuinely retryable.
      return plainly("That didn't go through. Send it again.", 409);
  }
};

export async function POST(request: Request): Promise<Response> {
  const guarded = await guard({ request, client: arcjetWrite });

  if (!guarded.ok) {
    return guarded.response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = turnRequestSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest();
  }

  // The schema above proves the id is well-formed and free-tier; this asks
  // whether it still exists. OpenRouter withdraws free models constantly, so an
  // id a browser tab has been holding for an hour may already be gone, and the
  // alternative to catching it here is three streams failing one by one with a
  // generic sentence. Silent when the catalog is unreachable — see
  // `withdrawnModelIds`.
  const withdrawn = await withdrawnModelIds(
    parsed.data.models.map((model) => model.id),
  );

  if (withdrawn.length > 0) {
    return plainly(
      withdrawn.length === 1
        ? "One of those models isn't available any more. Pick another one."
        : "Some of those models aren't available any more. Pick others.",
      400,
    );
  }

  const result = await createTurn(guarded.userId, parsed.data);

  if (!result.ok) {
    return refusalFor(result);
  }

  return Response.json(
    {
      threadId: result.threadId,
      turnId: result.turnId,
      index: result.index,
      responses: result.responses,
    },
    { status: 201 },
  );
}

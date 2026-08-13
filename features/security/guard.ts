import "server-only";

import { auth } from "@clerk/nextjs/server";
import type { ArcjetNext } from "@arcjet/next";

import { plainly } from "@/features/http/plain-response";
import { refusalFor } from "@/features/security/arcjet";

/**
 * The same three steps stand in front of every route that writes or spends:
 * require a Clerk session, ask Arcjet, and hand back a user id the route can
 * trust. Written once because three routes agreeing by memory is how one of
 * them eventually stops agreeing.
 *
 * Order matters and is not incidental. Clerk comes first so an anonymous caller
 * costs nothing to refuse and never reaches a rule. Arcjet comes before the
 * body is parsed, let alone acted on. The user id is resolved on the server and
 * never read from the request, which is what makes a per-user rate limit
 * impossible to sidestep with a header.
 */

export type Guarded =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly response: Response };

export type GuardOptions = {
  readonly request: Request;
  readonly client: ArcjetNext<{ userId: string; requested: number }>;
  /** Token-bucket spend. Routes with no bucket in their rules pass nothing. */
  readonly requested?: number;
};

export const guard = async ({
  request,
  client,
  requested = 0,
}: GuardOptions): Promise<Guarded> => {
  const { userId } = await auth();

  if (userId === null) {
    return {
      ok: false,
      response: plainly("You need to be signed in to do that.", 401),
    };
  }

  const decision = await client.protect(request, { userId, requested });

  if (decision.isDenied()) {
    const refusal = refusalFor(decision);

    return { ok: false, response: plainly(refusal.sentence, refusal.status) };
  }

  if (decision.isErrored()) {
    // Failing open, on purpose. The arena going down because its rate limiter
    // went down would be the worse outcome — but it gets logged, loudly.
    console.error("[guard] arcjet could not decide", decision.reason);
  }

  return { ok: true, userId };
};

import { plainly } from "@/features/http/plain-response";
import { fetchCatalog } from "@/features/models/catalog";
import { arcjetPublic, refusalFor } from "@/features/security/arcjet";

/**
 * The model catalog, trimmed to what a screen needs.
 *
 * This exists so the picker does not have to be handed 400 models as props on
 * every arena page load. `/` and `/t/[threadId]` render a composer whose popover
 * most visits never open; serializing the whole catalog into those payloads
 * would cost every visitor for a list only some of them ask for. A route is
 * fetched once, on first open, and cached by the browser after that.
 *
 * Public, and deliberately so — feature 8's rule is that only sending a prompt
 * and voting need a session, and the `/models` page shows anyone the same list.
 * That is why it uses `arcjetPublic` directly instead of `guard`, which exists
 * to require a Clerk session.
 */

export async function GET(request: Request): Promise<Response> {
  const decision = await arcjetPublic.protect(request);

  if (decision.isDenied()) {
    const refusal = refusalFor(decision);
    return plainly(refusal.sentence, refusal.status);
  }

  if (decision.isErrored()) {
    // Failing open, as `guard` does, and for the same reason: the arena should
    // not go dark because its rate limiter did.
    console.error("[models] arcjet could not decide", decision.reason);
  }

  const catalog = await fetchCatalog();

  if (!catalog.ok) {
    // 503 rather than 500: nothing here is broken, an upstream list is briefly
    // unavailable, and the picker's retry is the right response to that.
    return plainly(
      "The model list is unavailable right now. Try again in a moment.",
      503,
    );
  }

  return Response.json({ models: catalog.models });
}

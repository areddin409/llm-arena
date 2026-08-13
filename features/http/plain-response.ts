/**
 * Every refusal this app sends is a plain sentence a person can read, never a
 * provider exception, a rule name, or a stack. There is one shape for it so
 * that stays true by construction rather than by three routes remembering to
 * agree with each other.
 */
export const plainly = (sentence: string, status: number): Response =>
  Response.json({ error: sentence }, { status });

/** The sentence for a body that failed validation, wherever that happens. */
export const BAD_REQUEST_SENTENCE =
  "That request didn't look right. Try sending it again.";

export const badRequest = (): Response => plainly(BAD_REQUEST_SENTENCE, 400);

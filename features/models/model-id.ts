import { z } from "zod";

/**
 * OpenRouter names a model `author/slug`, and marks the free-tier variant of it
 * with a `:free` suffix — `google/gemma-4-31b-it:free`. That suffix is the only
 * thing separating a call this app's credits do not pay for from one they do.
 *
 * Nothing but a nonempty string used to be required here, which meant a signed-in
 * caller could post any paid id straight through to the provider and spend the
 * app's balance. Every model in this arena is free tier, so the suffix is a real
 * requirement, not a formatting preference, and it belongs on the boundary where
 * the id arrives rather than somewhere further in.
 *
 * This is a shape check, not a catalog check. It cannot know whether a
 * well-formed id exists — the live free-tier list is feature 5, and once that
 * lands the id should be checked against it too. Until then this closes the part
 * that costs money, and an unknown-but-free id still fails at call time as a
 * handled provider error.
 */
export const FREE_MODEL_ID_SUFFIX = ":free" as const;

const FREE_MODEL_ID_PATTERN = /^[\w.-]+\/[\w.-]+:free$/;

export const freeModelIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(FREE_MODEL_ID_PATTERN);

export type FreeModelId = z.infer<typeof freeModelIdSchema>;

/**
 * The author segment of an id, lowercased — `google/gemma-4-31b-it:free` →
 * `google`. It lives beside the schema because both are statements about the
 * same format, and a second file guessing at where the slash is would be a
 * second, quieter definition of it.
 *
 * An id with no slash yields an empty string rather than throwing. This reads
 * ids so a screen can draw a provider mark; a malformed one should render a
 * plain mark, not take the page down. Refusing a bad id stays
 * `freeModelIdSchema`'s job, on the request boundary where money is at stake.
 */
export function modelAuthor(modelId: string): string {
  const [author = ""] = modelId.split("/");
  return author.toLowerCase();
}

/** The one-letter stand-in shown when no provider mark is vendored. */
export function modelAuthorLetter(modelId: string): string {
  return modelAuthor(modelId).slice(0, 1).toUpperCase();
}

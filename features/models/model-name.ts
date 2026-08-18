/**
 * OpenRouter's `name` field is written `Vendor: Model` —
 * `NVIDIA: Nemotron 3.5 Lightning`. That prefix is worth keeping wherever there
 * is room for it, and worth dropping wherever the provider mark is already
 * saying the same thing in a space too tight for both.
 */

/**
 * The model half of an OpenRouter display name, or the whole string when there
 * is no vendor prefix to drop.
 *
 * Only the first colon splits, because a model's own name may contain one and
 * the vendor's never does. A name that starts with a colon, or has nothing
 * after it, is returned untouched rather than reduced to an empty label — an
 * unlabelled chip is worse than a redundant one.
 */
export function modelShortName(modelName: string): string {
  const separator = modelName.indexOf(": ");
  if (separator <= 0) return modelName;

  const short = modelName.slice(separator + 2).trim();
  return short.length > 0 ? short : modelName;
}

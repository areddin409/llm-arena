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

/**
 * OpenRouter's name for a free variant ends in ` (free)` —
 * `NVIDIA: Nemotron 3.5 Lightning (free)`. Every surface that shows a model
 * already says whether it is free, as a group heading or a price, so carrying
 * the word in the label too is repetition that costs the room a long name needs.
 *
 * Applied once, where the catalog is built, so nothing downstream has to
 * remember. A name that is only the suffix is left alone rather than emptied,
 * for the same reason `modelShortName` refuses to return nothing.
 */
export function stripFreeSuffix(modelName: string): string {
  const suffix = " (free)";
  if (!modelName.endsWith(suffix)) return modelName;

  const stripped = modelName.slice(0, -suffix.length).trim();
  return stripped.length > 0 ? stripped : modelName;
}

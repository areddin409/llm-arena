/**
 * The provider marks the arena draws instead of a single letter.
 *
 * Every path below is copied from simple-icons (CC0-1.0, no attribution
 * required — it is recorded here because knowing where artwork came from is
 * worth more than the licence demands). The package itself is not a dependency:
 * it carries some three thousand marks and this app renders four, so the four
 * are vendored and the rest are not shipped. Refresh one from
 * `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/<slug>.svg`.
 *
 * The names and marks are the providers' trademarks. They appear here to
 * identify whose model produced an answer, which is what a trademark is for.
 *
 * Two rules this file exists to keep:
 *
 * - **Every path is drawn in `currentColor`, never a brand color.** Google's
 *   blue and Meta's blue would put the one hue docs/scope.md's design rules
 *   forbid outright straight into the chrome, and a full-color logo beside a
 *   rust button makes decoration louder than the accent reserved for things you
 *   can actually click. The Spartan helmet settled this same question for the
 *   app's own logo; a borrowed mark does not get a broader licence than ours.
 * - **Anything missing is not a failure.** The lookup returns `undefined` and
 *   `ModelMark` falls back to the author's letter — today for InclusionAI, which
 *   simple-icons does not carry, and tomorrow for most of the list once feature
 *   5 reads OpenRouter live and feature 10 widens it past the free tier. The
 *   fallback is the common path, not the edge case.
 *
 * Keyed by the author segment of an OpenRouter id (`google/gemma-4-31b-it:free`
 * → `google`) rather than a display name, because that segment is what the API
 * really returns and it is already the thing `model-id.ts` validates.
 */

import { modelAuthor } from "@/features/models/model-id";

export type ModelGlyph = {
  /** The provider as it is written by the provider. */
  readonly title: string;
  /** A single path, drawn against a `0 0 24 24` viewBox. */
  readonly path: string;
};

const GLYPHS: Readonly<Record<string, ModelGlyph>> = {
  google: {
    title: "Google",
    path: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
  },
  mistralai: {
    title: "Mistral AI",
    path: "M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z",
  },
  nvidia: {
    title: "NVIDIA",
    path: "M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z",
  },
  qwen: {
    title: "Qwen",
    path: "M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z",
  },
};

/** The provider mark for a model id, or `undefined` if none is vendored. */
export function findModelGlyph(modelId: string): ModelGlyph | undefined {
  return GLYPHS[modelAuthor(modelId)];
}

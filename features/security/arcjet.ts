import "server-only";

import arcjet, {
  detectBot,
  shield,
  tokenBucket,
  type ArcjetDecision,
} from "@arcjet/next";

import { env } from "@/env";

/**
 * Everything that stands in front of `/api/chat`, in one place.
 *
 * The endpoint spends real money on someone else's GPUs, so it gets checked
 * before a model is ever called, not after. The three rules cover three
 * different problems and none of them substitutes for another:
 *
 * - `shield` is the WAF. Zero config, no per-request cost, catches the ordinary
 *   SQLi/XSS probing every public endpoint gets. There is no reason not to.
 * - `detectBot` stops scripted clients before they reach OpenRouter. Every bot
 *   denied here is an upstream call that never happens.
 * - `tokenBucket` is the one that actually bounds spend, keyed to the signed-in
 *   person rather than their IP. See below.
 *
 * Deliberately absent: `detectPromptInjection`. It reads like an obvious fit for
 * an LLM endpoint and it is not one here. This app has no agent, no tools, and
 * no privileged context a prompt could hijack — the text goes straight to a
 * model the user picked, and comparing how models handle a jailbreak attempt is
 * a legitimate thing to want the arena for. Blocking that would refuse exactly
 * the prompts people most want compared. If tool calls are ever added, that
 * calculus changes and the rule comes back at the tool call site as a guard.
 */

/**
 * Keyed by the Clerk user id, not by IP. Two reasons, both load-bearing.
 *
 * One prompt in the arena is up to three parallel POSTs, one per model, by
 * design — that independence is what keeps a single slow model from taking the
 * other two answers down. An IP-keyed limit would count one prompt as three
 * unrelated hits and would punish everyone behind a shared network. Keying by
 * the authenticated user is what makes this "a limit on how much one person can
 * use across all three models at once" rather than a limit on the endpoint.
 *
 * The bucket is therefore sized in model calls, not prompts. 30 capacity is ten
 * three-model prompts fired back to back; 15 per minute sustains five.
 */
export const arcjetChat = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    // curl and Postman stay allowed on purpose: this project has no test runner
    // and hand-verification through them is the agreed way anything gets
    // checked. Denying them would break the only test path there is. The route
    // requires a Clerk session anyway, so an anonymous scraper never reaches
    // this rule — it gets a 401 first.
    detectBot({ mode: "LIVE", allow: ["CURL", "POSTMAN"] }),
    tokenBucket({
      mode: "LIVE",
      characteristics: ["userId"],
      refillRate: 15,
      interval: "60s",
      capacity: 30,
    }),
  ],
});

/** One model call spends one token. */
export const CHAT_TOKENS_PER_CALL = 1;

/**
 * For `/api/turns` and `/api/votes` — the database writes that bracket a prompt.
 *
 * Shield and bot detection, and deliberately **no token bucket**. The bucket
 * above is sized in model calls, because that is what actually costs money and
 * what feature 6 wrote down as the limit. Charging a turn or a vote against that
 * same bucket would quietly change what the number means: thirty would stop
 * being ten three-model prompts and become something nobody could state. These
 * two routes write rows and call nobody, so they get the free protections and
 * are bounded in practice by the chat bucket standing between them.
 */
export const arcjetWrite = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: ["CURL", "POSTMAN"] }),
  ],
});

/**
 * For `GET /api/models` — the catalog the picker reads.
 *
 * Shield and bot detection only, and **no `userId` characteristic**, because
 * this is the one route in the app that does not require a session. Feature 8's
 * rule is that only sending a prompt and voting need sign-in, and a catalog is
 * neither; the `/models` page renders the same list to anyone. Arcjet falls back
 * to its own client fingerprint here, which is the right key for a route with no
 * user to key on.
 *
 * No token bucket, for the reason `arcjetWrite` gives: the bucket is denominated
 * in model calls and this route calls no model. It reads a value Next has cached
 * for an hour, so a burst against it costs one upstream fetch at most.
 */
export const arcjetPublic = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: "LIVE", allow: ["CURL", "POSTMAN"] }),
  ],
});

export type Refusal = {
  readonly sentence: string;
  readonly status: number;
};

/**
 * `reset` is seconds-until-reset and is always populated; `resetTime` is an
 * optional Date that a token bucket decision does not actually carry, which is
 * how the first version of this ended up with no number in the sentence.
 */
const secondsUntilReset = (reset: number): number | null =>
  Number.isFinite(reset) && reset > 0 ? Math.ceil(reset) : null;

/**
 * A denied decision turned into something a person can read. Never the Arcjet
 * reason object, never a rule name — the user gets a sentence and, where it
 * exists, a real number of seconds to wait.
 */
export const refusalFor = (decision: ArcjetDecision): Refusal => {
  if (decision.reason.isRateLimit()) {
    const seconds = secondsUntilReset(decision.reason.reset);

    return {
      sentence:
        seconds === null
          ? "You've sent a lot of prompts in a short time. Give it a minute and try again."
          : `You've sent a lot of prompts in a short time. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
      status: 429,
    };
  }

  // Bot and shield denials share the default. Splitting them would tell an
  // attacker which rule caught them and tells a real user nothing.
  return {
    sentence: "That request was blocked. If you think that's wrong, try again.",
    status: 403,
  };
};

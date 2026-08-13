import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { env } from "@/env";

/**
 * Every model in this app is reached through OpenRouter, which is why there is
 * exactly one provider instance and no per-model configuration. `appName` and
 * `appUrl` set the attribution headers OpenRouter uses on its dashboard, so
 * traffic from this app is identifiable rather than anonymous.
 */
const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
  compatibility: "strict",
  appName: "LLM Arena",
  appUrl: "https://github.com/areddin/llm_arena",
});

/**
 * A model id is whatever OpenRouter calls it, e.g.
 * `google/gemma-4-31b-it:free`. Callers are expected to have run the id through
 * `freeModelIdSchema` first — that is what keeps a paid model from being billed
 * to this app. The live free-tier catalog is feature 5; nothing here validates
 * the id against that list, so an unknown free id fails at call time with a
 * provider error.
 */
export const chatModel = (modelId: string) => openrouter.chat(modelId);

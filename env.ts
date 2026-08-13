import "server-only";

import { z } from "zod";

/**
 * Server-only environment. Parsed once, at import time, so a missing variable
 * kills the process at startup instead of surfacing as a confusing runtime
 * failure on someone's first prompt. `instrumentation.ts` imports this to make
 * that happen on boot rather than on the first request that needs it.
 *
 * Only variables the code actually reads today belong here. This grows as
 * features land.
 */
const serverEnvSchema = z.object({
  // Postgres, via Prisma. Checked for a postgres scheme rather than just
  // non-empty because the common mistake is pasting the dashboard URL or a
  // console link instead of the connection string, and that fails much later
  // with a far less obvious error.
  DATABASE_URL: z
    .string()
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      "must be a Postgres connection string starting with postgres:// or postgresql://",
    ),
  OPENROUTER_API_KEY: z
    .string()
    .min(1, "required to call any model — create one at openrouter.ai/keys"),
  // Without this, Arcjet cannot evaluate a single rule, and the endpoint that
  // spends real money upstream would run wide open. Better to refuse to boot.
  ARCJET_KEY: z
    .string()
    .startsWith(
      "ajkey_",
      "must be a site key from app.arcjet.com, which starts with ajkey_",
    ),
  CLERK_SECRET_KEY: z.string().min(1, "required by Clerk on the server"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "required by Clerk in the browser"),
  NEXT_PUBLIC_POSTHOG_KEY: z
    .string()
    .startsWith(
      "phc_",
      "must be the project API key from PostHog's Settings → Project, not a personal key",
    ),
  // The ingestion host, which is not the dashboard host. Pointing this at
  // us.posthog.com instead of us.i.posthog.com drops every event silently —
  // the kind of failure you only notice days later staring at an empty
  // dashboard, so it is rejected on boot instead.
  NEXT_PUBLIC_POSTHOG_HOST: z
    .url()
    .refine(
      (value) => !/^https:\/\/(us|eu)\.posthog\.com/.test(value),
      "that is the dashboard host — use the ingestion host, https://us.i.posthog.com or https://eu.i.posthog.com",
    ),
});

export type ServerEnv = Readonly<z.infer<typeof serverEnvSchema>>;

const describeIssues = (issues: readonly z.core.$ZodIssue[]): string =>
  issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

const parseServerEnv = (source: NodeJS.ProcessEnv): ServerEnv => {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    // Every problem at once. Fixing one variable per restart is miserable.
    throw new Error(
      `Environment is not usable. Fix these in .env.local, then restart:\n${describeIssues(
        result.error.issues,
      )}`,
    );
  }

  return Object.freeze(result.data);
};

export const env: ServerEnv = parseServerEnv(process.env);

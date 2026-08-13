import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import {
  Prisma,
  PrismaClient,
  ResponseStatus,
} from "@/prisma/generated/client";

/**
 * Re-exported here because this is the one file allowed to reach into the
 * generated client — every other feature imports these from `@/features/database`
 * instead, which is what keeps the generated-client lint rule enforceable.
 *
 * `TransactionClient` is what a `$transaction(async (tx) => …)` callback hands
 * you: the same client minus the methods you cannot call inside a transaction.
 * Functions that must run as part of a caller's transaction take it as their
 * first argument rather than reaching for `prisma` themselves.
 */
export { Prisma, ResponseStatus };
export type TransactionClient = Prisma.TransactionClient;

/** Postgres' unique-violation code, as Prisma reports it. */
export const UNIQUE_VIOLATION = "P2002" as const;

export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === UNIQUE_VIOLATION;

/**
 * Options for every interactive `$transaction` in the app.
 *
 * `maxWait` is how long Prisma will wait to *acquire* a connection before
 * giving up, and its 2s default is too short here. This app talks to a remote
 * pooled Postgres, and the first transaction after a cold start has to pay for
 * a TCP connect and a TLS handshake across the internet before it can begin.
 * Found the hard way: on a freshly started server the very first
 * `POST /api/turns` returned 500 with "Unable to start a transaction in the
 * given time", and the identical request a moment later succeeded. Left alone,
 * that would be a 500 on the first prompt after every deploy and every
 * serverless cold start — the worst possible moment for one.
 *
 * `timeout` is the separate budget for the transaction body once it has begun.
 * Both of these transactions are a handful of small writes, so this is generous
 * for what they do; it is sized for a slow network, not slow queries.
 */
export const TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 20_000,
} as const;

/**
 * The single Prisma client for the app. Import this, never construct a client
 * anywhere else.
 *
 * Prisma 7 dropped the Rust query engine, so a driver adapter is no longer
 * optional — `PrismaPg` is what actually talks to Postgres. The connection
 * string comes from `env.ts`, which has already validated it at boot, so there
 * is no `!` or fallback string here.
 */
const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

/**
 * Next.js hot-reloads server modules on every edit in development, and a fresh
 * client per reload leaks a connection pool each time until Postgres refuses
 * new connections. Stashing it on `globalThis` — which survives the reload —
 * is the standard fix. Production gets exactly one client anyway, so it skips
 * the cache entirely.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/env";
import { PrismaClient } from "@/prisma/generated/client";

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

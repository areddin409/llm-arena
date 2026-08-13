import { config as loadEnvFile } from "dotenv";
import { defineConfig, env } from "prisma/config";

/**
 * Read by the Prisma CLI only — never by application code, which gets its
 * connection string from `env.ts` like everything else.
 *
 * Prisma 7 stopped loading .env files on its own, and this project keeps its
 * secrets in .env.local (Next.js's convention) rather than .env, so the load is
 * explicit and points at the right file. Without this the CLI would report a
 * missing DATABASE_URL even though the dev server starts fine.
 */
loadEnvFile({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

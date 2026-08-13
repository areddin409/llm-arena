/**
 * Runs once, before the server accepts its first request. Importing the env
 * module here is the whole point: a missing variable throws on boot instead of
 * halfway through someone's first prompt.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./env");

    // Open the first database connection now rather than inside someone's first
    // request. The connect plus TLS handshake to the remote pooled Postgres
    // costs around eleven seconds cold, against half a second warm, and paying
    // it here means no user ever waits for it — the alternative is a raised
    // transaction timeout that merely makes the first prompt slow instead of
    // broken. `TRANSACTION_OPTIONS` still carries that raised timeout as a
    // backstop for the case where this warm-up itself was too slow or failed.
    //
    // Deliberately not fatal. A database that is briefly unreachable at boot
    // should not stop the server from starting and serving the pages that do
    // not need it; the next query will try again and report honestly.
    const { prisma } = await import("./features/database/prisma");

    await prisma.$connect().catch((error: unknown) => {
      console.error("[boot] could not pre-connect to the database", error);
    });
  }
}

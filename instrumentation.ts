/**
 * Runs once, before the server accepts its first request. Importing the env
 * module here is the whole point: a missing variable throws on boot instead of
 * halfway through someone's first prompt.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./env");
  }
}

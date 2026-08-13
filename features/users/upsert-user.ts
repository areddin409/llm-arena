import "server-only";

import type { TransactionClient } from "@/features/database/prisma";

/**
 * Turns a Clerk user id into a local `User` row id, creating the row the first
 * time that person writes anything.
 *
 * Clerk stays the source of truth for who someone is; this table exists so
 * threads and votes have real referential integrity. There is deliberately no
 * Clerk webhook syncing it — that would need signature verification, a backfill
 * for everyone who signed up before it existed, and would still race a thread
 * write arriving before `user.created` does.
 *
 * It takes a transaction client rather than importing `prisma` itself, so the
 * user row and whatever it was created for either both land or neither does. A
 * failed turn must not leave an orphan user behind.
 *
 * The `clerkUserId` must come from `auth()` on the server, never from a request
 * body — this function cannot tell the difference, so its callers have to.
 */
export const upsertUser = async (
  tx: TransactionClient,
  clerkUserId: string,
): Promise<string> => {
  const user = await tx.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId },
    update: {},
    select: { id: true },
  });

  return user.id;
};

import "server-only";

import { prisma, ResponseStatus } from "@/features/database/prisma";

/**
 * Rebuilds one model's own conversation from the database.
 *
 * The history is not sent by the client and never was necessary from it. A
 * thread's turns carry their prompts in `index` order, and each turn holds one
 * response per model with its text — which is precisely a per-model transcript.
 * The client was being trusted to replay something the server already knew.
 *
 * That trust was the bug. Anything the caller sends reaches the model, so
 * fabricated history — invented earlier questions, invented earlier answers,
 * instructions dressed up as an assistant turn — would shape the answer while
 * the result was stored against the turn's canonical prompt. Validating the
 * replay against the real transcript would have been the same query as building
 * it, so there is no reason to accept the replay at all.
 *
 * A model that failed or was never selected in an earlier turn contributes
 * nothing to its own history, which is what "each model carries its own separate
 * conversation" actually means: three models in one thread can have three
 * different-length transcripts, and a model that missed turn 2 simply never saw
 * it.
 */

export type ConversationMessage = {
  readonly role: "user" | "assistant";
  readonly content: string;
};

export const buildConversation = async (
  threadId: string,
  turnIndex: number,
  modelId: string,
  prompt: string,
): Promise<readonly ConversationMessage[]> => {
  const priorTurns = await prisma.turn.findMany({
    where: { threadId, index: { lt: turnIndex } },
    orderBy: { index: "asc" },
    select: {
      prompt: true,
      responses: {
        // Only this model's answers, and only ones that actually finished. A
        // PENDING sibling from a turn still in flight is not history yet.
        where: { modelId, status: ResponseStatus.COMPLETE },
        select: { content: true },
      },
    },
  });

  const history = priorTurns.flatMap((turn) => {
    const answer = turn.responses[0];

    return answer === undefined
      ? []
      : [
          { role: "user" as const, content: turn.prompt },
          { role: "assistant" as const, content: answer.content },
        ];
  });

  return [...history, { role: "user", content: prompt }];
};

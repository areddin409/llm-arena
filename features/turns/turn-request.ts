import { z } from "zod";

import { freeModelIdSchema } from "@/features/models/model-id";

/** Up to three models per turn, as the arena is designed around. */
export const MAX_MODELS_PER_TURN = 3;

/**
 * One prompt, one turn, up to three models.
 *
 * `name` is the model's display name as the caller's catalog knows it. The
 * server has no catalog of its own — that is feature 5, and it lives in the
 * browser — so the name arrives from the client. It is only ever displayed and
 * never used for logic, which is why a length cap is the whole of its
 * validation. The `id` beside it is held to the free-tier shape, exactly as
 * `/api/chat` holds it, so a paid model cannot be smuggled in through the turn
 * that precedes the call.
 */
const turnModelSchema = z.object({
  id: freeModelIdSchema,
  name: z.string().min(1).max(200),
});

export const turnRequestSchema = z.object({
  /** Absent starts a new thread; present continues one the caller owns. */
  threadId: z.string().min(1).max(64).optional(),
  prompt: z.string().min(1).max(20_000),
  models: z
    .array(turnModelSchema)
    .min(1)
    .max(MAX_MODELS_PER_TURN)
    // A turn holds one response per model — the database says so with
    // @@unique([turnId, modelId]). Catching a repeated id here turns what would
    // be a unique-violation 500 into the plain 400 it actually is.
    .refine(
      (models) =>
        new Set(models.map((model) => model.id)).size === models.length,
      { message: "the same model was listed twice" },
    ),
});

export type TurnRequest = Readonly<z.infer<typeof turnRequestSchema>>;

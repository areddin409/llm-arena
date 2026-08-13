import { z } from "zod";

/**
 * Both ids are required. The turn is what the vote is scoped to — one per person
 * per turn — and the response is which answer won. The database checks the two
 * agree with each other through the composite foreign key on `Vote`, so a
 * mismatched pair cannot be written even if this schema passes it through.
 */
export const voteRequestSchema = z.object({
  turnId: z.string().min(1).max(64),
  modelResponseId: z.string().min(1).max(64),
});

export type VoteRequest = Readonly<z.infer<typeof voteRequestSchema>>;

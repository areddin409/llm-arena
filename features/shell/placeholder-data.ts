/**
 * Every stand-in value the shell renders, in one file so it is obvious what is
 * real and what is not, and so each screen's placeholders can be deleted in one
 * piece as its feature lands.
 *
 * - `PLACEHOLDER_THREADS` goes when feature 7 reads real threads.
 * - `PLACEHOLDER_TURN` goes when feature 6 streams real answers.
 * - `PLACEHOLDER_RANKINGS` goes when feature 9 queries real votes.
 * - `PLACEHOLDER_CATALOG` goes when feature 5 pulls OpenRouter's live list.
 *
 * Nothing here is invented from nowhere: the model ids, speeds and token counts
 * are the real measurements recorded in this file's sibling, docs/scope.md.
 * They are still placeholders — no screen below is reading a database.
 */

export type PlaceholderThread = {
  readonly id: string;
  readonly title: string;
  readonly when: string;
};

export const PLACEHOLDER_THREADS: readonly PlaceholderThread[] = [
  {
    id: "thr_8f2k9a0001",
    title: "Explain quicksort to a five-year-old",
    when: "Today",
  },
  {
    id: "thr_8f2k9a0002",
    title: "Rewrite this changelog entry",
    when: "Today",
  },
  {
    id: "thr_8f2k9a0003",
    title: "What is my favourite colour?",
    when: "Yesterday",
  },
  {
    id: "thr_8f2k9a0004",
    title: "Summarise the Arcjet rate-limit run",
    when: "Tuesday",
  },
];

/**
 * A made-up or deleted thread has to show a plain not-found page, which means
 * something has to be able to say "no such thread" — feature 8's rule, and the
 * one piece of it that is cheap enough to honour while the data is still a
 * stand-in. Feature 7 replaces this with a real query.
 */
export function findPlaceholderThread(
  id: string,
): PlaceholderThread | undefined {
  return PLACEHOLDER_THREADS.find((thread) => thread.id === id);
}

export type PlaceholderResponse = {
  readonly modelId: string;
  readonly modelName: string;
  /** Displayed in the top bar's per-model chips. */
  readonly initial: string;
  readonly content: string;
  readonly ttftMs: number | null;
  readonly tokensPerSecond: number | null;
  readonly outputTokens: number | null;
  readonly totalMs: number | null;
  readonly state: "streaming" | "complete" | "winner" | "failed";
  readonly winsThisThread: number;
};

export type PlaceholderTurn = {
  readonly prompt: string;
  /** The slowest response sets the axis every timing rail is drawn against. */
  readonly axisMs: number;
  readonly turnsInThread: number;
  readonly responses: readonly PlaceholderResponse[];
};

export const PLACEHOLDER_TURN: PlaceholderTurn = {
  prompt: "Explain quicksort to a five-year-old.",
  axisMs: 6657,
  turnsInThread: 2,
  responses: [
    {
      modelId: "inclusionai/ling-3.0-tiny:free",
      modelName: "InclusionAI: Ling 3.0 Tiny",
      initial: "L",
      content:
        "Imagine a big pile of toy blocks, all mixed up. You pick one block and call it the picker. Every block smaller than the picker goes in a pile on the left, every bigger one goes on the right. Now you have two smaller piles, and you do the very same thing to each of them, again and again, until every pile is just one block. Put the piles back in a line and they are magically in order.",
      ttftMs: 1314,
      tokensPerSecond: 421.2,
      outputTokens: 342,
      totalMs: 2126,
      state: "winner",
      winsThisThread: 1,
    },
    {
      modelId: "nvidia/nemotron-3.5-lightning:free",
      modelName: "NVIDIA: Nemotron 3.5 Lightning",
      initial: "N",
      content:
        "Quicksort is like tidying a shelf of books. You grab one book and hold it up. Any book that comes before it goes to the left of the shelf; any book that comes after it goes to the right. The book you are holding is now in exactly the right spot forever. Then you tidy the left side the same way, and the right side the same way, and you keep going until each little group has only one book in it.",
      ttftMs: 678,
      tokensPerSecond: 134.5,
      outputTokens: 804,
      totalMs: 6657,
      state: "complete",
      winsThisThread: 0,
    },
    {
      modelId: "google/gemma-4-26b-a4b-it:free",
      modelName: "Google: Gemma 4 26B",
      initial: "G",
      content: "",
      ttftMs: null,
      tokensPerSecond: null,
      outputTokens: null,
      totalMs: null,
      state: "failed",
      winsThisThread: 0,
    },
  ],
};

export type PlaceholderRanking = {
  readonly modelId: string;
  readonly modelName: string;
  readonly initial: string;
  readonly wins: number;
  readonly votes: number;
  readonly avgTtftMs: number;
  readonly avgTokensPerSecond: number;
};

export const PLACEHOLDER_RANKINGS: readonly PlaceholderRanking[] = [
  {
    modelId: "nvidia/nemotron-3.5-lightning:free",
    modelName: "NVIDIA: Nemotron 3.5 Lightning",
    initial: "N",
    wins: 507,
    votes: 700,
    avgTtftMs: 1186,
    avgTokensPerSecond: 57,
  },
  {
    modelId: "inclusionai/ling-3.0-tiny:free",
    modelName: "InclusionAI: Ling 3.0 Tiny",
    initial: "L",
    wins: 288,
    votes: 512,
    avgTtftMs: 894,
    avgTokensPerSecond: 421,
  },
  {
    modelId: "google/gemma-4-26b-a4b-it:free",
    modelName: "Google: Gemma 4 26B",
    initial: "G",
    wins: 141,
    votes: 402,
    avgTtftMs: 1533,
    avgTokensPerSecond: 34,
  },
  {
    modelId: "google/gemma-4-31b-it:free",
    modelName: "Google: Gemma 4 31B",
    initial: "G",
    wins: 96,
    votes: 388,
    avgTtftMs: 1702,
    avgTokensPerSecond: 29,
  },
];

export type PlaceholderCatalogEntry = {
  readonly modelId: string;
  readonly modelName: string;
  readonly initial: string;
  readonly author: string;
  readonly contextWindow: number;
};

export const PLACEHOLDER_CATALOG: readonly PlaceholderCatalogEntry[] = [
  {
    modelId: "nvidia/nemotron-3.5-lightning:free",
    modelName: "Nemotron 3.5 Lightning",
    initial: "N",
    author: "NVIDIA",
    contextWindow: 262144,
  },
  {
    modelId: "inclusionai/ling-3.0-tiny:free",
    modelName: "Ling 3.0 Tiny",
    initial: "L",
    author: "InclusionAI",
    contextWindow: 131072,
  },
  {
    modelId: "google/gemma-4-26b-a4b-it:free",
    modelName: "Gemma 4 26B",
    initial: "G",
    author: "Google",
    contextWindow: 131072,
  },
  {
    modelId: "google/gemma-4-31b-it:free",
    modelName: "Gemma 4 31B",
    initial: "G",
    author: "Google",
    contextWindow: 65536,
  },
  {
    modelId: "qwen/qwen3-8b:free",
    modelName: "Qwen3 8B",
    initial: "Q",
    author: "Qwen",
    contextWindow: 40960,
  },
  {
    modelId: "mistralai/mistral-small-3.2:free",
    modelName: "Mistral Small 3.2",
    initial: "M",
    author: "Mistral",
    contextWindow: 32768,
  },
];

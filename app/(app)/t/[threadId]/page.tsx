import { ArenaScreen } from "@/features/arena/arena-screen";
import {
  CATALOG_CONVENIENCE_BUDGET_MS,
  fetchCatalogWithin,
} from "@/features/models/catalog";
import { defaultSelection } from "@/features/models/default-selection";
import {
  findPlaceholderThread,
  PLACEHOLDER_TURN,
} from "@/features/shell/placeholder-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/t/[threadId]">): Promise<Metadata> {
  const { threadId } = await params;
  const thread = findPlaceholderThread(threadId);

  return {
    title: thread ? `${thread.title} · LLM Arena` : "Thread not found",
  };
}

/**
 * One thread. The URL is short and owns no user in its path on purpose: feature
 * 8 makes this link readable by anyone it is pasted to, with no account, and a
 * made-up or deleted id shows a plain not-found page rather than an error.
 */
export default async function ThreadPage({
  params,
}: PageProps<"/t/[threadId]">) {
  const { threadId } = await params;

  if (!findPlaceholderThread(threadId)) notFound();

  // A continuing thread should open with the models it has been using, which is
  // its previous turn's models — a better answer than any global preference and
  // one the database already holds. That query is feature 7's, so this falls
  // back to the catalog default until the thread is real.
  //
  // Budgeted like the empty arena, and more so: a thread already has answers
  // worth reading on it, so holding them back to decide which chips to
  // pre-select would be trading the page's actual content for a convenience.
  const catalog = await fetchCatalogWithin(CATALOG_CONVENIENCE_BUDGET_MS);

  return (
    <ArenaScreen
      turn={PLACEHOLDER_TURN}
      initialModels={catalog.ok ? defaultSelection(catalog.models) : []}
    />
  );
}

import { ArenaScreen } from "@/features/arena/arena-screen";
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

  return <ArenaScreen turn={PLACEHOLDER_TURN} />;
}

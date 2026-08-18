import { LeaderboardScreen } from "@/features/leaderboard/leaderboard-screen";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard · LLM Arena",
  description:
    "Every model's real record, from actual head-to-head votes cast in the arena.",
};

export default function LeaderboardPage() {
  return <LeaderboardScreen />;
}

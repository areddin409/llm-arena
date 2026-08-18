import { ModelCatalog } from "@/features/models/model-catalog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Models · LLM Arena",
  description:
    "Every free-tier model the arena can call, with its context window and pricing.",
};

export default function ModelsPage() {
  return <ModelCatalog />;
}

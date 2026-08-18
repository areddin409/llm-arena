import { Button } from "@/features/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/features/ui/empty";
import { SearchXIcon } from "lucide-react";
import Link from "next/link";

/**
 * Shown for a thread id that does not exist, and for anything else missing
 * inside the shell. Deliberately plain: a thread someone deleted and a thread
 * someone mistyped look identical, which is what feature 8 asks for.
 */
export default function NotFound() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle className="type-display text-2xl">
          There&apos;s nothing here
        </EmptyTitle>
        <EmptyDescription>
          This thread doesn&apos;t exist, or it was deleted. Start a new one and
          ask your question again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/">Start a new thread</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

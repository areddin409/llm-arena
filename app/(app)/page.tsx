import { ArenaScreen } from "@/features/arena/arena-screen";

/**
 * A fresh arena, with no thread behind it yet. The first prompt creates the
 * thread and moves the browser to `/t/[threadId]` — feature 6's job, since
 * `POST /api/turns` is what mints the id.
 */
export default function ArenaPage() {
  return <ArenaScreen turn={null} />;
}

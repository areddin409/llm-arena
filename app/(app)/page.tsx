import { ArenaScreen } from "@/features/arena/arena-screen";
import { fetchCatalog } from "@/features/models/catalog";
import { defaultSelection } from "@/features/models/default-selection";

/**
 * A fresh arena, with no thread behind it yet. The first prompt creates the
 * thread and moves the browser to `/t/[threadId]` — feature 6's job, since
 * `POST /api/turns` is what mints the id.
 *
 * The catalog is read here so the composer opens with models already chosen.
 * Only the three of them cross into the page payload; the other four hundred
 * stay behind `/api/models` and are fetched if and when the picker is opened.
 * A catalog that cannot be reached yields no chips and the composer says so,
 * rather than the page failing.
 */
export default async function ArenaPage() {
  const catalog = await fetchCatalog();

  return (
    <ArenaScreen
      turn={null}
      initialModels={catalog.ok ? defaultSelection(catalog.models) : []}
    />
  );
}

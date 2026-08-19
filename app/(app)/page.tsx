import { ArenaScreen } from "@/features/arena/arena-screen";
import {
  CATALOG_CONVENIENCE_BUDGET_MS,
  fetchCatalogWithin,
} from "@/features/models/catalog";
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
 *
 * **On a budget, because this page does not need the catalog to exist.** The
 * arena is a prompt box and a send button; which chips are pre-selected is a
 * convenience on top. Waiting `fetchCatalog`'s full timeout would hold the whole
 * screen blank for eight seconds during an upstream stall, so the wait is capped
 * and the fallback is simply no chips — which the composer already handles,
 * since it is the same state as removing every model by hand.
 */
export default async function ArenaPage() {
  const catalog = await fetchCatalogWithin(CATALOG_CONVENIENCE_BUDGET_MS);

  return (
    <ArenaScreen
      turn={null}
      initialModels={catalog.ok ? defaultSelection(catalog.models) : []}
    />
  );
}

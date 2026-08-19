import type { CatalogModel } from "@/features/models/catalog-model";
import { modelAuthor } from "@/features/models/model-id";
import { MAX_MODELS_PER_TURN } from "@/features/turns/turn-request";

/**
 * The three models an arena starts with, derived from the live catalog on every
 * visit rather than stored anywhere.
 *
 * Nothing is persisted on purpose. OpenRouter's free tier turns over fast enough
 * that a remembered selection is dead within about a week — three of the six ids
 * written into this repo days before this was built had already been withdrawn —
 * so a saved list would need reconciling against the catalog on every load:
 * dropping ids that vanished, topping the rest back up from a default. Deriving
 * has none of that, because it cannot go stale.
 *
 * **One model per author, and that rule is not tidiness.** Free models sorted by
 * context window currently open with two NVIDIA entries, so the obvious "take
 * the first three" gives an arena whose first impression is one provider against
 * itself. Feature 4 already fought the same collision in the provider mark.
 *
 * Authors are only enforced while there are enough of them. If fewer than three
 * authors offer a free model, a second entry from an author already used is
 * better than an arena with two columns.
 */
export function defaultSelection(
  models: readonly CatalogModel[],
): readonly CatalogModel[] {
  const free = models.filter((model) => model.free);

  const distinct = free.reduce<readonly CatalogModel[]>(
    (chosen, model) =>
      chosen.length >= MAX_MODELS_PER_TURN ||
      chosen.some((seen) => modelAuthor(seen.id) === modelAuthor(model.id))
        ? chosen
        : [...chosen, model],
    [],
  );

  if (distinct.length >= MAX_MODELS_PER_TURN) return distinct;

  return free
    .reduce<readonly CatalogModel[]>(
      (chosen, model) =>
        chosen.length >= MAX_MODELS_PER_TURN || chosen.includes(model)
          ? chosen
          : [...chosen, model],
      distinct,
    )
    .slice(0, MAX_MODELS_PER_TURN);
}

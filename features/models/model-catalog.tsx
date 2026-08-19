import { fetchCatalog } from "@/features/models/catalog";
import { ModelCatalogTable } from "@/features/models/model-catalog-table";
import { Alert, AlertDescription, AlertTitle } from "@/features/ui/alert";
import { TriangleAlertIcon } from "lucide-react";

/**
 * Every model the arena can reach, browsable without opening the picker.
 *
 * The catalog is fetched here, on the server, and handed to a client table as
 * data. Feature 5 planned to render the rows here as well, on the argument that
 * a server component keeps the catalog out of the browser entirely — see
 * `ModelCatalogTable` for the measurement that reversed it.
 */
export async function ModelCatalog() {
  const catalog = await fetchCatalog();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="type-display text-3xl">Models</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Every model the arena can call, live from OpenRouter and sorted by
        context window. A price of $0.00 is a genuine zero — the cheapest model
        that charges anything is a cent per million tokens, so nothing here
        rounds down to free.
      </p>

      {catalog.ok ? (
        <ModelCatalogTable models={catalog.models} />
      ) : (
        <Alert className="mt-8">
          <TriangleAlertIcon />
          <AlertTitle>The model list is unavailable right now.</AlertTitle>
          <AlertDescription>
            Reload the page to try again. Nothing is cached in its place,
            because a saved copy of this list goes out of date within days.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";

import type { CatalogModel } from "@/features/models/catalog-model";

/**
 * The catalog, loaded from `/api/models` the first time the picker is opened.
 *
 * On open rather than on mount, deliberately. The composer renders on every
 * arena page and most visits never open the picker, so fetching 400 models at
 * mount would spend a request on the majority to save a moment for the minority.
 * Once loaded it stays loaded — the list changes at most daily and the route is
 * cached for an hour behind that.
 *
 * Loading is kicked off from the open handler rather than from an effect, which
 * keeps this a plain state machine with no `setState` during render.
 */

export type CatalogState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly models: readonly CatalogModel[] }
  | { readonly status: "failed" };

type ModelsResponse = { readonly models: readonly CatalogModel[] };

export function useCatalog() {
  const [state, setState] = useState<CatalogState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/models");

      if (!response.ok) {
        // The route already answered with a plain sentence; the picker shows its
        // own, so nothing from the body is read or displayed here.
        setState({ status: "failed" });
        return;
      }

      const body = (await response.json()) as ModelsResponse;
      setState({ status: "ready", models: body.models });
    } catch {
      setState({ status: "failed" });
    }
  }, []);

  /**
   * Called when the picker opens. A list already in hand is not re-fetched, and
   * a load already in flight is not doubled.
   *
   * The check reads `state` directly rather than happening inside a `setState`
   * updater: an updater has to be pure, and React calls it twice in development
   * to prove it, which would fire two requests.
   */
  const loadOnce = useCallback(() => {
    if (state.status === "idle") {
      void load();
    }
  }, [state.status, load]);

  return { state, loadOnce, retry: load } as const;
}

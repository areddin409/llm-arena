"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import type { CatalogModel } from "@/features/models/catalog-model";
import { ModelPickerList } from "@/features/models/model-picker-list";
import { useCatalog } from "@/features/models/use-catalog";
import { Button } from "@/features/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/features/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/features/ui/sheet";
import { useIsMobile } from "@/features/ui/use-mobile";
import { MAX_MODELS_PER_TURN } from "@/features/turns/turn-request";

/**
 * "Add model", and the catalog behind it.
 *
 * A popover on desktop and a bottom sheet on mobile, because a 26rem list
 * anchored to a button at the bottom of a phone screen has nowhere to go. Both
 * render the same `ModelPickerList`, so there is one picker with two frames
 * rather than two pickers. Sheet rather than adding a Drawer dependency: it is
 * already vendored here, already doing the sidebar's mobile panel, and already
 * focus-trapped.
 */

type ModelPickerProps = {
  readonly selected: readonly CatalogModel[];
  readonly onToggle: (model: CatalogModel) => void;
};

export function ModelPicker({ selected, onToggle }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { state, loadOnce, retry } = useCatalog();

  // The label has to be true in both states. At the cap "Add model" invites
  // something the picker will refuse, so it says what is actually on offer.
  const label =
    selected.length >= MAX_MODELS_PER_TURN ? "Change models" : "Add model";

  const openChanged = (next: boolean) => {
    setOpen(next);
    if (next) loadOnce();
  };

  /**
   * Choosing the last free slot closes the picker.
   *
   * At the cap there is nothing left it can do — every unchosen row is inert and
   * the only remaining move is to remove something — so staying open asks the
   * person to dismiss a panel that has already finished its job. Closing on the
   * third pick is the difference between the flow ending and the flow stopping.
   *
   * Only an *addition* that fills the last slot closes it. Removing never does,
   * which is what keeps the swap flow working: open at 3, take one off, put
   * another on, and it closes on that second action rather than the first.
   *
   * `selected` is this render's array, so `length + 1` is the count the toggle
   * is about to produce. No effect watching the selection, and therefore no
   * frame where the panel is open against a full list.
   */
  const toggleAndMaybeClose = (model: CatalogModel) => {
    const isAdding = !selected.some((chosen) => chosen.id === model.id);

    onToggle(model);

    if (isAdding && selected.length + 1 >= MAX_MODELS_PER_TURN) {
      setOpen(false);
    }
  };

  // No `data-icon` on the icon: this project's `buttonVariants` never selects on
  // it, so the attribute the shadcn skill docs recommend does nothing here. The
  // 2026-08-18 review flagged the copy of it already in the composer.
  const trigger = (
    <Button variant="outline" size="xs">
      <PlusIcon />
      {label}
    </Button>
  );

  const list = (
    <ModelPickerList
      state={state}
      selected={selected}
      onToggle={toggleAndMaybeClose}
      onRetry={retry}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={openChanged}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] gap-0 p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="type-display text-lg">
              Choose models
            </SheetTitle>
            <SheetDescription>
              Up to {MAX_MODELS_PER_TURN} models answer each prompt, side by
              side.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1">{list}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={openChanged}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-88 p-0 sm:w-104">
        {list}
      </PopoverContent>
    </Popover>
  );
}

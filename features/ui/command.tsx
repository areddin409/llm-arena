"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import { cn } from "@/features/ui/utils";

/*
 * Vendored from shadcn, then edited in two places against this project's
 * palette. The reasons are written beside each change, in the house style — see
 * the equivalent notes in `button.tsx` and `badge.tsx`.
 *
 * `CommandDialog` was removed rather than left unused. It was the only reason
 * this file pulled in `dialog.tsx`, which shipped a `focus:ring-*` close button
 * that disagrees with the global `:focus-visible` baseline. The picker uses
 * Popover on desktop and the already-vendored Sheet on mobile, so nothing here
 * needed a Dialog, and vendoring a component with a defect nobody uses is a trap
 * left for whoever reaches for it next.
 */

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/*
 * **The keyboard-active row was invisible on this palette, and that is the whole
 * reason this component is edited rather than used as shipped.**
 *
 * Upstream marks it with `bg-accent` alone. shadcn's own palette separates
 * `--accent` from `--popover` enough for that to read; ours does not, because
 * feature 4 set the dark `--accent` to the same warm brown as `--muted`.
 * Measured, not eyeballed: `#2e211c` on `#241a16` is **1.09:1** in dark and
 * `#efe4d8` on `#fffbf6` is **1.22:1** in light. A keyboard user arrowing
 * through 400 models would have had no idea which row they were on.
 *
 * The fix is a 2px rust rule down the leading edge — 5.00:1 dark, 5.12:1 light
 * against the popover. Rust is reserved for things you interact with, and the
 * row you are about to choose is exactly that, so this is the accent doing its
 * job rather than decoration. The `bg-accent` fill stays as a second, quieter
 * cue for anyone who can see it.
 *
 * `data-[disabled=true]:opacity-50` is replaced by an explicit
 * `text-muted-foreground` for the same reason four vendored components have
 * already been corrected here: half-opacity text is how contrast quietly fails.
 * At 6.52:1 a disabled row is still readable, which matters — a paid model is
 * disabled and its name is the thing you are reading it for.
 */
function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm border-l-2 border-l-transparent px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:text-muted-foreground data-[selected=true]:border-l-primary data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};

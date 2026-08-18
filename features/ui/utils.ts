import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names and resolves Tailwind conflicts, so a component's own
 * classes can always be overridden by a caller's without specificity games.
 * shadcn components expect this to exist at this path — see components.json.
 */
export function cn(...inputs: readonly ClassValue[]) {
  return twMerge(clsx(inputs));
}

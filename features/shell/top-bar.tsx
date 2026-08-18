"use client";

import { AuthControls } from "@/features/auth/auth-controls";
import {
  findPlaceholderThread,
  PLACEHOLDER_TURN,
} from "@/features/shell/placeholder-data";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import { Badge } from "@/features/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/features/ui/breadcrumb";
import { ModelMark } from "@/features/ui/model-mark";
import { Separator } from "@/features/ui/separator";
import { SidebarTrigger } from "@/features/ui/sidebar";
import { useParams, usePathname } from "next/navigation";
import { Fragment } from "react";

const STATIC_CRUMBS: Readonly<Record<string, readonly string[]>> = {
  "/": ["Arena"],
  "/leaderboard": ["Leaderboard"],
  "/models": ["Models"],
};

/**
 * The breadcrumb is derived from the route rather than passed down, so a new
 * screen gets one by existing.
 *
 * A thread's name is looked up here for now. That is placeholder-shaped: once
 * feature 7 loads a real thread it should come down as a prop from the route
 * that already fetched it, rather than being fetched twice.
 */
export function TopBar() {
  const pathname = usePathname();
  const params = useParams<{ threadId?: string }>();

  const thread = params.threadId
    ? findPlaceholderThread(params.threadId)
    : undefined;

  const crumbs = thread
    ? ["Arena", thread.title]
    : (STATIC_CRUMBS[pathname] ?? ["Arena"]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={crumb}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {index === crumbs.length - 1 ? (
                  <BreadcrumbPage className="truncate">{crumb}</BreadcrumbPage>
                ) : (
                  <span className="truncate">{crumb}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/*
        Each model's record in this thread, so it only appears once a thread
        exists. It shrinks to the mark and the number on a narrow screen, which
        is the crowding case the sketch calls out, rather than wrapping onto a
        second line.
      */}
      {thread ? (
        <ul className="hidden items-center gap-1.5 sm:flex">
          {PLACEHOLDER_TURN.responses.map((response) => (
            <li key={response.modelId}>
              <Badge variant="outline" className="gap-1.5 py-0.5 pr-2 pl-0.5">
                <ModelMark initial={response.initial} size="sm" />
                <span className="type-metric">
                  <span className="sr-only">{response.modelName} has won </span>
                  {response.winsThisThread}/{PLACEHOLDER_TURN.turnsInThread}
                  <span className="sr-only"> turns in this thread</span>
                </span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        Account and theme live here rather than in the sidebar's foot, so that
        collapsing the sidebar cannot take them with it — there would otherwise
        be no way to reach either without reopening the panel.
      */}
      <Separator orientation="vertical" className="ml-1 h-4" />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <AuthControls />
      </div>
    </header>
  );
}

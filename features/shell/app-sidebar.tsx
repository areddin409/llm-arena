"use client";

import { PLACEHOLDER_THREADS } from "@/features/shell/placeholder-data";
import { BrandMark } from "@/features/ui/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/features/ui/sidebar";
import {
  LayersIcon,
  MessagesSquareIcon,
  PlusIcon,
  SwordsIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Arena", icon: SwordsIcon },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  { href: "/models", label: "Models", icon: LayersIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state, setOpen, isMobile } = useSidebar();

  // The rail only exists on a wide screen; below `lg` the panel is a sheet that
  // is either fully open or fully gone, so there is nothing to substitute for.
  const isCollapsed = state === "collapsed" && !isMobile;

  return (
    // Collapses to an icon rail rather than off-canvas, so navigation survives
    // the collapse instead of disappearing with the panel.
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* `size="lg"` is what gives the mark room: it drops the button's
                padding in the collapsed rail, so a 32px logo fills the icon box
                exactly instead of being squeezed into 16px of content area. */}
            <SidebarMenuButton asChild size="lg" tooltip="LLM Arena">
              <Link href="/">
                {/* Wrapped in a span deliberately. The button styles a direct
                    svg child with `[&>svg]:size-4`, which outranks a size class
                    on the element itself and would pin the logo to 16px — the
                    size where its interior detail stops reading. */}
                <span className="flex shrink-0">
                  <BrandMark className="size-8" />
                </span>
                <span className="type-display text-base">LLM Arena</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* shadcn's SidebarContent is `overflow-auto`, which is both axes. A
          sidebar has no business scrolling sideways at any width, so the x-axis
          is clamped rather than left to whichever child happens to overhang —
          the rail's `-right-4` and the group action's `after:-inset-2` both
          render outside their parent's box by design. */}
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                // A thread lives at /t/[threadId] rather than under /arena, so
                // Arena has to claim those routes explicitly — otherwise
                // opening a thread lights up nothing in the nav.
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname.startsWith("/t/")
                    : pathname === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/*
          On the rail, threads collapse to one button that reopens the panel.
          Rendering them as icons there does not work — a thread has no icon,
          so four of them would be four identical blank squares, and switching
          thread is the main thing the sidebar is for. One button that gets the
          list back is honest about what it does.
        */}
        {isCollapsed ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Your threads"
                    onClick={() => setOpen(true)}
                  >
                    <MessagesSquareIcon />
                    <span>Your threads</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="type-eyebrow">
            Your threads
          </SidebarGroupLabel>

          <SidebarGroupAction asChild>
            <Link href="/">
              <PlusIcon />
              <span className="sr-only">Start a new thread</span>
            </Link>
          </SidebarGroupAction>

          <SidebarGroupContent>
            <SidebarMenu>
              {PLACEHOLDER_THREADS.map((thread) => {
                const href = `/t/${thread.id}`;

                return (
                  <SidebarMenuItem key={thread.id}>
                    <SidebarMenuButton asChild isActive={pathname === href}>
                      <Link href={href}>
                        <span>{thread.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

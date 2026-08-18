import { AppSidebar } from "@/features/shell/app-sidebar";
import { TopBar } from "@/features/shell/top-bar";
import { SidebarInset, SidebarProvider } from "@/features/ui/sidebar";
import { cookies } from "next/headers";
import { type ReactNode } from "react";

/** shadcn's Sidebar writes this itself; we only read it back. */
const SIDEBAR_STATE_COOKIE = "sidebar_state";

/**
 * The frame every screen sits inside: a sidebar and a top bar that stay put
 * while the screen itself scrolls.
 *
 * The collapsed state is read from its cookie here, on the server, so a reload
 * paints the sidebar in the state it was left in rather than flicking open and
 * then shut. That is what makes this a server component, and it is why the
 * screens inside are rendered on demand instead of prerendered — a real cost,
 * paid deliberately, and one the app takes anyway as soon as a thread is loaded
 * for a signed-in person.
 */
export async function AppShell({ children }: { readonly children: ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get(SIDEBAR_STATE_COOKIE)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />

      {/* `min-w-0` is load-bearing: without it this flex child refuses to
          shrink below its content's intrinsic width, and a wide response grid
          pushes the whole page into a horizontal scrollbar. */}
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <TopBar />
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

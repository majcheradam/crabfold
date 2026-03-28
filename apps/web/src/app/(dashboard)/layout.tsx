import { env } from "@crabfold/env/web";
import { Separator } from "@crabfold/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@crabfold/ui/components/sidebar";
import { cookies } from "next/headers";

import { AppSidebar } from "@/components/app-sidebar";
import { getSession } from "@/lib/auth-server";

interface SidebarAgent {
  slug: string;
  name: string;
}

async function fetchSidebarAgents(userId: string): Promise<SidebarAgent[]> {
  const cookieStore = await cookies();
  const res = await fetch(
    `${env.NEXT_PUBLIC_SERVER_URL}/api/agents?userId=${userId}`,
    {
      cache: "no-store",
      headers: { cookie: cookieStore.toString() },
    }
  );
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return (data.agents ?? []).map((a: { slug: string; name: string }) => ({
    name: a.name,
    slug: a.slug,
  }));
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const user = session?.user ?? null;
  const agents = user ? await fetchSidebarAgents(user.id) : [];

  return (
    <SidebarProvider>
      <AppSidebar user={user} agents={agents} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

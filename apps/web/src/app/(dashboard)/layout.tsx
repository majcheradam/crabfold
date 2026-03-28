import { SidebarInset, SidebarProvider } from "@crabfold/ui/components/sidebar";

import { AppSidebar } from "@/components/app-sidebar";
import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

interface SidebarAgent {
  slug: string;
  name: string;
}

async function fetchSidebarAgents(userId: string): Promise<SidebarAgent[]> {
  const api = await apiServer();
  const { data, status } = await api.api.agents.get({ query: { userId } });
  if (status !== 200 || !data || "error" in data) {
    return [];
  }
  return data.agents.map((a) => ({
    name: a.name,
    slug: a.slug,
  }));
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let agents: SidebarAgent[] = [];

  try {
    const session = await getSession();
    user = session?.user ?? null;
    agents = user ? await fetchSidebarAgents(user.id) : [];
  } catch {
    // Backend unavailable — render with empty state
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} agents={agents} />
      <SidebarInset>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

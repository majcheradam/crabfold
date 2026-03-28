"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@crabfold/ui/components/sidebar";
import { ActivityIcon, BotIcon, PlusIcon, TerminalIcon } from "lucide-react";
import Link from "next/link";

import { SpoolIcon } from "@/components/icons/spool";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  agents: { slug: string; name: string }[];
}

export function AppSidebar({ user, agents, ...props }: AppSidebarProps) {
  const username = user?.name ?? "";

  const navMain = [
    {
      icon: <BotIcon />,
      isActive: true,
      items: agents.map((a) => ({
        title: a.slug,
        url: `/${username}/${a.slug}`,
      })),
      title: "Agents",
      url: `/${username}`,
    },
  ];

  const navSingle = [
    {
      icon: <ActivityIcon />,
      matchPattern: "/metrics",
      title: "Observability",
      url: "/metrics",
    },
    {
      icon: <SpoolIcon />,
      matchPattern: "/threads",
      title: "Sessions",
      url: "/threads",
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          href={username ? `/${username}` : "/"}
          className="flex items-center gap-2 px-2 py-1"
        >
          <TerminalIcon className="size-4 text-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-foreground group-data-[collapsible=icon]:hidden">
            crabfold
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pt-4">
          <Link
            href="/new"
            className="flex size-8 items-center justify-center border border-border text-xs font-medium text-foreground transition-[width,height,padding] hover:bg-foreground/5 group-data-[collapsible=icon]:size-8 group-not-data-[collapsible=icon]:h-auto group-not-data-[collapsible=icon]:w-full group-not-data-[collapsible=icon]:justify-start group-not-data-[collapsible=icon]:gap-2 group-not-data-[collapsible=icon]:px-3 group-not-data-[collapsible=icon]:py-2"
          >
            <PlusIcon className="size-3.5 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">
              New Agent
            </span>
          </Link>
        </div>
        <NavMain items={navMain} extraItems={navSingle} />
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: user.image ?? "",
              email: user.email,
              name: user.name,
            }}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

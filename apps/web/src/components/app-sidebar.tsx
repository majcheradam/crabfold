"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@crabfold/ui/components/sidebar";
import { TerminalIcon, PlusIcon, BotIcon, ActivityIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";

const data = {
  navMain: [
    {
      icon: <BotIcon />,
      isActive: true,
      items: [
        {
          title: "github-issue-triager",
          url: "/demo/github-issue-triager",
        },
        {
          title: "slack-standup-bot",
          url: "/demo/slack-standup-bot",
        },
      ],
      title: "Agents",
      url: "/demo",
    },
  ],
  navSingle: [
    {
      icon: <ActivityIcon />,
      matchPattern: "/metrics",
      title: "Observability",
      url: "/metrics",
    },
  ],
  user: {
    avatar: "",
    email: "demo@crabfold.ai",
    name: "demo",
  },
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/demo" className="flex items-center gap-2 px-2 py-1">
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
        <NavMain items={data.navMain} extraItems={data.navSingle} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

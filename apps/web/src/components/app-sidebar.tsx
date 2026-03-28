"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@crabfold/ui/components/sidebar";
import { TerminalIcon, PlusIcon, BotIcon } from "lucide-react";
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
        <Link href="/" className="flex items-center gap-2 px-2 py-1">
          <TerminalIcon className="size-4 text-foreground" />
          <span className="text-xs font-medium uppercase tracking-widest text-foreground group-data-[collapsible=icon]:hidden">
            crabfold
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-4 pt-4">
          <Link
            href="/new"
            className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
          >
            <PlusIcon className="size-3.5 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">
              New Agent
            </span>
          </Link>
        </div>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

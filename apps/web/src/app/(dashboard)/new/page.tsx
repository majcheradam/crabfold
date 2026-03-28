import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";

import { NewAgentClient } from "./new-agent-client";

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { prompt } = await searchParams;

  return <NewAgentClient prompt={prompt ?? ""} username={session.user.name} />;
}

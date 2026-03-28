import { notFound, redirect } from "next/navigation";

import { apiServer } from "@/lib/api-server";
import { getSession } from "@/lib/auth-server";

import { EditorClient } from "./editor-client";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ username: string; agentSlug: string }>;
}) {
  const { username, agentSlug } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const api = await apiServer();
  const { data, status } = await api.api.agents["by-slug"][agentSlug].get();

  if (status !== 200 || !data || "error" in data) {
    notFound();
  }

  return <EditorClient agent={data} username={username} />;
}

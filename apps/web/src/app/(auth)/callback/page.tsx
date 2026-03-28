import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";

export default async function CallbackPage() {
  const session = await getSession();

  if (session?.user) {
    redirect(`/${session.user.name}`);
  }

  redirect("/login");
}

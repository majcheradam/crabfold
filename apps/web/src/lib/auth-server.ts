import "server-only";
import { env } from "@crabfold/env/web";
import { cookies } from "next/headers";

interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  session: {
    id: string;
    token: string;
    expiresAt: string;
  };
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();

  const res = await fetch(
    `${env.NEXT_PUBLIC_SERVER_URL}/api/auth/get-session`,
    {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    }
  );

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  if (!data?.user) {
    return null;
  }

  return data as Session;
}

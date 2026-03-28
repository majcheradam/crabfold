"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentWorking } from "@/components/landing/agent-working";
import { Hero } from "@/components/landing/hero";

export default function NewAgentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";

  const [state, setState] = useState<"idle" | "working">(
    initialPrompt ? "working" : "idle"
  );
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    if (initialPrompt) {
      const timer = setTimeout(() => {
        router.push("/demo");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, router]);

  const handleSubmit = (value: string) => {
    setPrompt(value);
    setState("working");

    setTimeout(() => {
      router.push("/demo");
    }, 4000);
  };

  return (
    <>
      {state === "idle" && <Hero onSubmit={handleSubmit} />}
      {state === "working" && <AgentWorking prompt={prompt} />}
    </>
  );
}

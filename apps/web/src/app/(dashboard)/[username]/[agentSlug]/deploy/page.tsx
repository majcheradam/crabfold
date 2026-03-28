"use client";

import { Button } from "@crabfold/ui/components/button";
import { Rocket } from "lucide-react";

export default function DeployPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <Rocket className="size-8 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Deploy to Railway
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Connect your Railway account to deploy this agent. Crabfold will
          create a GitHub repo, provision infrastructure, and deploy
          automatically.
        </p>
      </div>
      <Button size="lg" className="gap-1.5">
        <Rocket className="size-3.5" />
        Connect Railway &amp; Deploy
      </Button>
    </div>
  );
}

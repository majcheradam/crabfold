"use client";

import { env } from "@crabfold/env/web";
import { Button } from "@crabfold/ui/components/button";
import { AlertTriangle, Loader2, Rocket, Train } from "lucide-react";
import { useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

type DeployState =
  | { status: "idle" }
  | { status: "deploying" }
  | { status: "railway_required" }
  | { status: "error"; message: string }
  | { status: "complete" };

interface DeployEvent {
  step?: string;
  label?: string;
}

interface DeployClientProps {
  agentId: string | null;
  username: string;
  agentSlug: string;
  autoRetry: boolean;
}

export function DeployClient({
  agentId,
  username,
  agentSlug,
  autoRetry,
}: DeployClientProps) {
  const [state, setState] = useState<DeployState>(
    autoRetry && agentId ? { status: "deploying" } : { status: "idle" }
  );
  const [events, setEvents] = useState<DeployEvent[]>([]);
  const deployStarted = useRef(false);

  async function startDeploy(id: string) {
    setState({ status: "deploying" });

    const { data, status } = await api.api.agents({ id }).deploy.post({});

    if (status === 403) {
      setState({ status: "railway_required" });
      return;
    }

    if (!data || !("jobId" in data)) {
      setState({ message: "Failed to start deployment", status: "error" });
      return;
    }

    const jobId = data.jobId as string;

    const evtSource = new EventSource(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/jobs/${jobId}/stream`,
      { withCredentials: true }
    );

    evtSource.addEventListener("progress", (e) => {
      const event = JSON.parse(e.data) as DeployEvent;
      setEvents((prev) => [...prev, event]);
    });

    evtSource.addEventListener("complete", () => {
      setState({ status: "complete" });
      evtSource.close();
    });

    evtSource.addEventListener("error", () => {
      if (evtSource.readyState === EventSource.CLOSED) {
        return;
      }
      setState({ message: "Deploy stream interrupted", status: "error" });
      evtSource.close();
    });
  }

  // Auto-retry on mount via initial state + lazy start
  if (autoRetry && agentId && !deployStarted.current) {
    deployStarted.current = true;
    startDeploy(agentId);
  }

  function handleDeploy() {
    if (!agentId) {
      return;
    }
    startDeploy(agentId);
  }

  function handleConnectRailway() {
    const callbackURL = `/${username}/${agentSlug}/deploy?autoRetry=true`;
    authClient.signIn.social({
      callbackURL,
      provider: "railway",
    });
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      {/* Idle state */}
      {state.status === "idle" && (
        <>
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
          <Button
            size="lg"
            className="gap-1.5"
            onClick={handleDeploy}
            disabled={!agentId}
          >
            <Rocket className="size-3.5" />
            Deploy
          </Button>
        </>
      )}

      {/* Railway not connected */}
      {state.status === "railway_required" && (
        <div className="flex w-full max-w-md flex-col gap-5 border border-border bg-card p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <Train className="size-8 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Connect Railway
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Crabfold needs access to your Railway account to deploy agents.
              You&apos;ll be redirected to Railway to authorize, then brought
              back here to continue.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleConnectRailway}
          >
            <Train className="size-3.5" />
            Authorize Railway
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setState({ status: "idle" })}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Deploying — SSE progress */}
      {state.status === "deploying" && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Deploying...
            </span>
          </div>
          <div className="flex flex-col gap-2 border border-border p-4">
            {events.length === 0 && (
              <span className="text-xs text-muted-foreground">
                Starting deploy pipeline...
              </span>
            )}
            {events.map((evt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="size-1.5 rounded-full bg-green-500" />
                <span className="text-muted-foreground">
                  {evt.label ?? evt.step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complete */}
      {state.status === "complete" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center border border-green-500/20 bg-green-500/10">
            <Rocket className="size-5 text-green-500" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Agent deployed
          </h2>
          <p className="text-xs text-muted-foreground">
            Your agent is now live on Railway.
          </p>
        </div>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">
            Deploy failed
          </h2>
          <p className="text-xs text-muted-foreground">{state.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setState({ status: "idle" })}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

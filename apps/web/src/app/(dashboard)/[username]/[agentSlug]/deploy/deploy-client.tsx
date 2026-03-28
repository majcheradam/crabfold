"use client";

import { env } from "@crabfold/env/web";
import { Button } from "@crabfold/ui/components/button";
import { AlertTriangle, Check, Loader2, Rocket } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

type DeployState =
  | { status: "idle" }
  | { status: "deploying"; jobId?: string }
  | { status: "error"; message: string }
  | { status: "complete"; url?: string };

interface DeployEvent {
  step?: string;
  label?: string;
  status?: string;
  data?: { domain?: string; buildStatus?: string };
}

interface DeployClientProps {
  agentId: string | null;
  username: string;
  agentSlug: string;
  connections: { railway: boolean; github: boolean };
}

function IdleView({
  connections,
  onConnectRailway,
  onDeploy,
  canDeploy,
}: {
  connections: { railway: boolean; github: boolean };
  onConnectRailway: () => void;
  onDeploy: () => void;
  canDeploy: boolean;
}) {
  if (!connections.railway) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Rocket className="size-8 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Connect Railway
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          To deploy your agent, connect your Railway account first. You will be
          redirected to Railway to authorize access.
        </p>
        <Button size="lg" className="gap-1.5" onClick={onConnectRailway}>
          <Rocket className="size-3.5" />
          Connect Railway
        </Button>
      </div>
    );
  }

  if (!connections.github) {
    return (
      <div className="flex w-full max-w-md flex-col gap-5 border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            GitHub token missing
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your GitHub account is connected but the access token is missing.
            Try signing out and signing in again with GitHub.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <Rocket className="size-8 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Deploy to Railway
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Crabfold will create a GitHub repo, provision Railway infrastructure,
          and deploy your agent automatically.
        </p>
      </div>
      <Button
        size="lg"
        className="gap-1.5"
        onClick={onDeploy}
        disabled={!canDeploy}
      >
        <Rocket className="size-3.5" />
        Deploy
      </Button>
    </>
  );
}

export function DeployClient({
  agentId,
  username,
  agentSlug,
  connections,
}: DeployClientProps) {
  const canAutoDeploy = !!agentId && connections.railway && connections.github;
  const [state, setState] = useState<DeployState>(
    canAutoDeploy ? { status: "deploying" } : { status: "idle" }
  );
  const [events, setEvents] = useState<DeployEvent[]>([]);
  const deployStarted = useRef(false);

  function connectRailway() {
    const callbackURL = `${window.location.origin}/${username}/${agentSlug}/deploy?autoRetry=true`;
    authClient.linkSocial({
      callbackURL,
      provider: "railway" as "github",
    });
  }

  const retryCount = useRef(0);
  const MAX_RETRIES = 5;

  function connectToStream(jobId: string) {
    const evtSource = new EventSource(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/jobs/${jobId}/stream`,
      { withCredentials: true }
    );

    evtSource.addEventListener("message", (e) => {
      retryCount.current = 0;
      const event = JSON.parse(e.data) as DeployEvent;
      if (event.step) {
        setEvents((prev) => {
          const idx = prev.findIndex((ev) => ev.step === event.step);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = event;
            return next;
          }
          return [...prev, event];
        });
      }
    });

    evtSource.addEventListener("complete", (e) => {
      evtSource.close();
      const event = JSON.parse(e.data);
      setState({ status: "complete", url: event.data?.url });
    });

    evtSource.addEventListener("error", (e) => {
      evtSource.close();

      // Check if this is a real error event with data (server-sent error)
      if (e instanceof MessageEvent && e.data) {
        try {
          const parsed = JSON.parse(e.data);
          setState({
            message: parsed.data?.message ?? "Deploy failed",
            status: "error",
          });
          return;
        } catch {
          // not JSON, treat as stream interruption
        }
      }

      // Stream interrupted — reconnect if under retry limit
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current += 1;
        setTimeout(() => connectToStream(jobId), 2000);
      } else {
        setState({
          message:
            "Lost connection to deploy stream. The deploy may still be running — check Railway.",
          status: "error",
        });
      }
    });
  }

  async function startDeploy(id: string) {
    setState({ status: "deploying" });
    setEvents([]);
    retryCount.current = 0;

    const res = await api.api.agents({ id }).deploy.post({});

    if (res.status === 403) {
      const body = res.data ?? res.error;
      const code =
        body && typeof body === "object" && "code" in body
          ? (body as { code: string }).code
          : null;
      if (code === "RAILWAY_NOT_CONNECTED") {
        connectRailway();
        return;
      }
      if (code === "GITHUB_NOT_CONNECTED") {
        setState({
          message:
            "GitHub token missing. Try signing out and back in with GitHub.",
          status: "error",
        });
        return;
      }
      setState({ message: "Forbidden", status: "error" });
      return;
    }

    if (res.status !== 200 || !res.data || !("jobId" in res.data)) {
      setState({ message: "Failed to start deployment", status: "error" });
      return;
    }

    const jobId = res.data.jobId as string;
    setState({ jobId, status: "deploying" });
    connectToStream(jobId);
  }

  // Auto-deploy when connections are ready
  if (canAutoDeploy && !deployStarted.current) {
    deployStarted.current = true;
    startDeploy(agentId);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      {state.status === "idle" && (
        <IdleView
          connections={connections}
          onConnectRailway={connectRailway}
          onDeploy={() => agentId && startDeploy(agentId)}
          canDeploy={!!agentId}
        />
      )}

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
            {events.map((evt) => (
              <div key={evt.step} className="flex items-center gap-2 text-xs">
                {evt.status === "done" ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  {evt.label ?? evt.step}
                </span>
                {evt.data?.buildStatus && evt.status !== "done" && (
                  <span className="text-[10px] text-muted-foreground/60">
                    ({evt.data.buildStatus.toLowerCase()})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {state.status === "complete" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-10 items-center justify-center border border-green-500/20 bg-green-500/10">
            <Rocket className="size-5 text-green-500" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">
            Agent deployed
          </h2>
          <p className="text-xs text-muted-foreground">
            Your agent is now live on Railway.
          </p>
          {state.url && (
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground underline underline-offset-2"
            >
              {state.url}
            </a>
          )}
          <Link href={`/${username}/${agentSlug}`}>
            <Button variant="outline" size="sm">
              Go to agent
            </Button>
          </Link>
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">
            Deploy failed
          </h2>
          <p className="max-w-sm text-xs text-muted-foreground">
            {state.message}
          </p>
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

"use client";

import { Button } from "@crabfold/ui/components/button";
import {
  AlertTriangle,
  Check,
  Link2,
  Loader2,
  MessageSquare,
  Plug,
  RefreshCw,
  Unplug,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { api } from "@/lib/api-client";

interface Channel {
  id: string;
  label: string;
  recommended?: boolean;
}

interface ChannelStatus {
  id: string;
  label: string;
  connected: boolean;
  connecting?: boolean;
  error?: string;
  qrCode?: string;
  pairingUrl?: string;
}

interface ChannelsClientProps {
  agentId: string;
  agentName: string;
  agentStatus: string;
  channels: Channel[];
  deploymentUrl: string | null;
  username: string;
  agentSlug: string;
}

type GatewayStatus =
  | "checking"
  | "online"
  | "unreachable"
  | "crashing"
  | "not_deployed";

function gatewayStatusDotColor(status: GatewayStatus): string {
  if (status === "online") {
    return "bg-green-500";
  }
  if (status === "crashing") {
    return "bg-amber-500";
  }
  if (status === "unreachable") {
    return "bg-red-500";
  }
  return "bg-muted-foreground/30";
}

function gatewayStatusLabel(status: GatewayStatus, checked: boolean): string {
  if (status === "checking" && !checked) {
    return "Click Check Status to probe";
  }
  if (status === "checking") {
    return "Checking...";
  }
  if (status === "online") {
    return "Online";
  }
  if (status === "crashing") {
    return "Crashing (502) — check Railway logs";
  }
  return "Unreachable";
}

const CHANNEL_ICONS: Record<string, string> = {
  discord: "Discord",
  msteams: "MS Teams",
  signal: "Signal",
  slack: "Slack",
  telegram: "Telegram",
  webchat: "WebChat",
  whatsapp: "WhatsApp",
};

export function ChannelsClient({
  agentId,
  agentName,
  agentStatus,
  channels,
  deploymentUrl,
  username,
  agentSlug,
}: ChannelsClientProps) {
  const [statuses, setStatuses] = useState<ChannelStatus[]>(
    channels.map((ch) => ({
      connected: false,
      id: ch.id,
      label: ch.label,
    }))
  );
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>("checking");
  const [checked, setChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function checkStatus() {
    setGatewayStatus("checking");
    try {
      const res = await api.api.agents({ id: agentId }).channels.get();
      if (res.status === 200 && res.data && "channels" in res.data) {
        const data = res.data as {
          channels: { id: string; label: string; connected: boolean }[];
          gatewayStatus: string;
        };
        setStatuses(
          data.channels.map((ch) => ({
            connected: ch.connected,
            id: ch.id,
            label: ch.label,
          }))
        );
        if (data.gatewayStatus === "online") {
          setGatewayStatus("online");
        } else if (data.gatewayStatus === "crashing") {
          setGatewayStatus("crashing");
        } else {
          setGatewayStatus("unreachable");
        }
      } else {
        setGatewayStatus("unreachable");
      }
    } catch {
      setGatewayStatus("unreachable");
    }
    setChecked(true);
  }

  async function refreshUrl() {
    setRefreshing(true);
    try {
      const res = await api.api.agents({ id: agentId })["refresh-url"].post({});

      if (res.status === 200 && res.data && "deploymentUrl" in res.data) {
        // Re-check status with the updated URL
        await checkStatus();
      }
    } catch {
      // ignore
    }
    setRefreshing(false);
  }

  async function connectChannel(channelId: string) {
    setStatuses((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, connecting: true, error: undefined } : ch
      )
    );

    try {
      const res = await api.api
        .agents({ id: agentId })
        .channels({ channelId })
        .connect.post({});

      const body = res.data as Record<string, unknown> | null;

      if (res.status === 200 && body) {
        setStatuses((prev) =>
          prev.map((ch) =>
            ch.id === channelId
              ? {
                  ...ch,
                  connected: !body.qrCode && !body.pairingUrl,
                  connecting: false,
                  pairingUrl: body.pairingUrl as string | undefined,
                  qrCode: body.qrCode as string | undefined,
                }
              : ch
          )
        );
      } else {
        const errorBody = (res.data ?? res.error) as Record<
          string,
          unknown
        > | null;
        setStatuses((prev) =>
          prev.map((ch) =>
            ch.id === channelId
              ? {
                  ...ch,
                  connecting: false,
                  error:
                    (errorBody?.message as string) ??
                    (errorBody?.error as string) ??
                    "Connection failed",
                }
              : ch
          )
        );
      }
    } catch {
      setStatuses((prev) =>
        prev.map((ch) =>
          ch.id === channelId
            ? { ...ch, connecting: false, error: "Failed to reach gateway" }
            : ch
        )
      );
    }
  }

  async function disconnectChannel(channelId: string) {
    setStatuses((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, connecting: true, error: undefined } : ch
      )
    );

    try {
      await api.api
        .agents({ id: agentId })
        .channels({ channelId })
        .disconnect.post({});

      setStatuses((prev) =>
        prev.map((ch) =>
          ch.id === channelId
            ? { ...ch, connected: false, connecting: false }
            : ch
        )
      );
    } catch {
      setStatuses((prev) =>
        prev.map((ch) =>
          ch.id === channelId
            ? { ...ch, connecting: false, error: "Disconnect failed" }
            : ch
        )
      );
    }
  }

  // Not deployed state
  if (agentStatus !== "live" || !deploymentUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <WifiOff className="size-8 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Deploy your agent first
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Channel connections require a running agent. Deploy to Railway first,
          then come back to connect your channels.
        </p>
        <Link href={`/${username}/${agentSlug}/deploy`}>
          <Button size="sm" className="gap-1.5">
            <Plug className="size-3" />
            Go to Deploy
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-sm font-semibold text-foreground">Channels</h1>
            <p className="text-xs text-muted-foreground">
              Connect messaging channels to {agentName}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={checkStatus}
            disabled={gatewayStatus === "checking" && checked}
          >
            {gatewayStatus === "checking" && checked ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Wifi className="size-3" />
            )}
            Check Status
          </Button>
        </div>

        {/* Gateway status */}
        <div className="flex items-center gap-2 border border-border px-4 py-3">
          <span
            className={`size-2 rounded-full ${gatewayStatusDotColor(gatewayStatus)}`}
          />
          <span className="text-xs text-muted-foreground">
            Gateway: {gatewayStatusLabel(gatewayStatus, checked)}
          </span>
          {(gatewayStatus === "unreachable" || gatewayStatus === "crashing") &&
            checked && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[10px]"
                onClick={refreshUrl}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Refresh URL
              </Button>
            )}
          {deploymentUrl && (
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground"
            >
              <Link2 className="size-3" />
              {deploymentUrl.replace("https://", "")}
            </a>
          )}
        </div>

        {/* Channel grid */}
        {statuses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageSquare className="size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              No channels configured. Edit your agent to add channels.
            </p>
            <Link href={`/${username}/${agentSlug}/editor`}>
              <Button variant="outline" size="sm">
                Configure Channels
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {statuses.map((ch) => (
              <div
                key={ch.id}
                className="flex flex-col gap-3 border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {CHANNEL_ICONS[ch.id] ?? ch.label}
                    </span>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-[10px] ${
                      ch.connected ? "text-green-500" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        ch.connected ? "bg-green-500" : "bg-muted-foreground/30"
                      }`}
                    />
                    {ch.connected ? "Connected" : "Not connected"}
                  </span>
                </div>

                {/* QR code display */}
                {ch.qrCode && (
                  <div className="flex flex-col items-center gap-2 border border-border bg-white p-4">
                    <img
                      src={ch.qrCode}
                      alt={`Scan to connect ${ch.label}`}
                      className="size-48"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Scan with {ch.label} to pair
                    </span>
                  </div>
                )}

                {/* Pairing URL */}
                {ch.pairingUrl && (
                  <a
                    href={ch.pairingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-foreground underline underline-offset-2"
                  >
                    Open pairing link
                  </a>
                )}

                {/* Error */}
                {ch.error && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertTriangle className="size-3" />
                    {ch.error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {ch.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={ch.connecting}
                      onClick={() => disconnectChannel(ch.id)}
                    >
                      {ch.connecting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Unplug className="size-3" />
                      )}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={ch.connecting || gatewayStatus !== "online"}
                      onClick={() => connectChannel(ch.id)}
                    >
                      {ch.connecting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

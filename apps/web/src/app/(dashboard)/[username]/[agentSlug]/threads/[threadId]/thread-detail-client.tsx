"use client";

import { Button } from "@crabfold/ui/components/button";
import { Input } from "@crabfold/ui/components/input";
import {
  ArrowLeft,
  BotIcon,
  Pause,
  Play,
  Send,
  Square,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { api } from "@/lib/api-client";

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
}

const avatarClass = (role: Message["role"]) => {
  if (role === "assistant") {
    return "border-border text-muted-foreground";
  }
  if (role === "user") {
    return "border-foreground bg-foreground text-background";
  }
  return "border-border text-muted-foreground/50";
};

const bubbleClass = (role: Message["role"]) => {
  if (role === "system") {
    return "italic text-muted-foreground/60";
  }
  if (role === "user") {
    return "border border-foreground bg-foreground/5 p-3 text-foreground";
  }
  return "border border-border p-3 text-foreground";
};

export function ThreadDetailClient({
  agentId,
  agentSlug,
  username,
  threadId,
  title,
  initialMessages,
}: {
  agentId: string;
  agentSlug: string;
  username: string;
  threadId: string;
  title: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [paused, setPaused] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim() || sending) {
      return;
    }

    const text = input.trim();
    const userMsg: Message = {
      content: text,
      id: `user_${Date.now()}`,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      await api.api.agents[agentId].threads[threadId].inject.post({
        message: text,
      });
    } catch {
      // Message was already added to UI optimistically
    } finally {
      setSending(false);
    }
  };

  const handleControl = async (action: "pause" | "resume") => {
    try {
      const { data, status } = await api.api.agents[agentId].control.post({
        action,
      });
      if (status === 200 && data && "status" in data) {
        setPaused(data.status === "paused");
      }
    } catch {
      // Ignore control errors
    }
  };

  return (
    <div className="-m-6 flex h-[calc(100svh-3rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/${username}/${agentSlug}/threads`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-3" />
              Back
            </Button>
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">{title}</span>
            <span className="text-[10px] text-muted-foreground">
              {agentSlug}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => handleControl(paused ? "resume" : "pause")}
          >
            {paused ? (
              <Play className="size-3" />
            ) : (
              <Pause className="size-3" />
            )}
          </Button>
          <Button variant="outline" size="icon-xs">
            <Square className="size-3" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex size-6 shrink-0 items-center justify-center border ${avatarClass(msg.role)}`}
            >
              {msg.role === "assistant" && <BotIcon className="size-3" />}
              {msg.role === "user" && <User className="size-3" />}
              {(msg.role === "system" || msg.role === "tool") && (
                <span className="text-[8px]">SYS</span>
              )}
            </div>
            <div
              className={`flex max-w-[75%] flex-col gap-1 ${
                msg.role === "user" ? "items-end" : ""
              }`}
            >
              <div
                className={`text-xs leading-relaxed ${bubbleClass(msg.role)}`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-muted-foreground/40">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input — inject message */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message to the agent..."
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || sending}
            className="gap-1.5"
          >
            <Send className="size-3" />
            Send
          </Button>
        </form>
        {paused && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Agent is paused. Messages will be queued.
          </p>
        )}
      </div>
    </div>
  );
}

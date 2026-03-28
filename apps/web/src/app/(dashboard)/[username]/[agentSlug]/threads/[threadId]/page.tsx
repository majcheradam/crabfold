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
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

interface Message {
  id: string;
  role: "agent" | "human" | "system";
  content: string;
  timestamp: string;
}

const MOCK_MESSAGES: Record<string, Message[]> = {
  t_1: [
    {
      content: "New issue opened: Memory leak in auth service (#142)",
      id: "1",
      role: "system",
      timestamp: "10:32 AM",
    },
    {
      content:
        'Analyzing issue #142. The title mentions "memory leak" and "auth service". Checking body for additional context...',
      id: "2",
      role: "agent",
      timestamp: "10:32 AM",
    },
    {
      content:
        "Classification: **bug**, Priority: **high**\nAffected area: authentication service\nApplying labels: `bug`, `priority/high`, `auth`",
      id: "3",
      role: "agent",
      timestamp: "10:32 AM",
    },
    {
      content:
        "Based on team expertise, @alice handles frontend/React but this is a backend auth issue. Assigning to @bob (backend, Go).",
      id: "4",
      role: "agent",
      timestamp: "10:33 AM",
    },
    {
      content:
        "Actually, reassign this to @carol — she handled the last auth service incident",
      id: "5",
      role: "human",
      timestamp: "10:35 AM",
    },
    {
      content:
        "Understood. Reassigning issue #142 from @bob to @carol. Updated assignment.",
      id: "6",
      role: "agent",
      timestamp: "10:35 AM",
    },
    {
      content: "Posted triage summary to #triage channel in Slack.",
      id: "7",
      role: "agent",
      timestamp: "10:35 AM",
    },
    {
      content:
        "Triage complete for issue #142. Summary:\n- Type: bug\n- Priority: high\n- Labels: bug, priority/high, auth\n- Assignee: @carol",
      id: "8",
      role: "agent",
      timestamp: "10:36 AM",
    },
  ],
  t_2: [
    {
      content: "New issue opened: Add dark mode support (#143)",
      id: "1",
      role: "system",
      timestamp: "9:15 AM",
    },
    {
      content:
        "Analyzing issue #143. This is a feature request for dark mode support.",
      id: "2",
      role: "agent",
      timestamp: "9:15 AM",
    },
    {
      content:
        "Classification: **feature**, Priority: **medium**\nApplying labels: `enhancement`, `priority/medium`, `frontend`",
      id: "3",
      role: "agent",
      timestamp: "9:15 AM",
    },
    {
      content: "Assigning to @alice (frontend, React) — this is a UI feature.",
      id: "4",
      role: "agent",
      timestamp: "9:16 AM",
    },
  ],
  t_3: [
    {
      content: "New issue opened: CI pipeline failing on main (#144)",
      id: "1",
      role: "system",
      timestamp: "8:00 AM",
    },
    {
      content:
        "Analyzing issue #144. CI pipeline failure on main branch — checking recent commits and build logs.",
      id: "2",
      role: "agent",
      timestamp: "8:00 AM",
    },
  ],
};

const avatarClass = (role: Message["role"]) => {
  if (role === "agent") {return "border-border text-muted-foreground";}
  if (role === "human")
    {return "border-foreground bg-foreground text-background";}
  return "border-border text-muted-foreground/50";
};

const bubbleClass = (role: Message["role"]) => {
  if (role === "system") {return "italic text-muted-foreground/60";}
  if (role === "human")
    {return "border border-foreground bg-foreground/5 p-3 text-foreground";}
  return "border border-border p-3 text-foreground";
};

export default function ThreadDetailPage() {
  const params = useParams<{
    agentSlug: string;
    threadId: string;
    username: string;
  }>();
  const [messages, setMessages] = useState<Message[]>(
    MOCK_MESSAGES[params.threadId] ?? MOCK_MESSAGES.t_1 ?? []
  );
  const [input, setInput] = useState("");
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim()) {
      return;
    }

    const userMsg: Message = {
      content: input.trim(),
      id: `user_${Date.now()}`,
      role: "human",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Mock agent response
    setTimeout(() => {
      const agentMsg: Message = {
        content: `Acknowledged. Processing your instruction: "${userMsg.content}"`,
        id: `agent_${Date.now()}`,
        role: "agent",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, agentMsg]);
    }, 1000);
  };

  return (
    <div className="-m-6 flex h-[calc(100svh-3rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/${params.username}/${params.agentSlug}/threads`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-3" />
              Back
            </Button>
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">
              {params.threadId}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {params.agentSlug}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setPaused(!paused)}
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
            className={`flex gap-3 ${msg.role === "human" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex size-6 shrink-0 items-center justify-center border ${avatarClass(msg.role)}`}
            >
              {msg.role === "agent" && <BotIcon className="size-3" />}
              {msg.role === "human" && <User className="size-3" />}
              {msg.role === "system" && <span className="text-[8px]">SYS</span>}
            </div>
            <div
              className={`flex max-w-[75%] flex-col gap-1 ${
                msg.role === "human" ? "items-end" : ""
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
            disabled={!input.trim()}
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

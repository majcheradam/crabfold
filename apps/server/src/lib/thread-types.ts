export interface ThreadToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  toolCalls?: ThreadToolCall[];
  source?: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  updatedAt: string;
}

export interface ThreadHistory {
  id: string;
  title: string;
  messages: ThreadMessage[];
}

export type ControlAction = "pause" | "resume";

export interface ControlRequest {
  action: ControlAction;
}

export interface ControlResponse {
  status: "paused" | "running";
  pausedAt?: string;
}

export interface InjectRequest {
  message: string;
}

export interface InjectResponse {
  injected: boolean;
  messageId: string;
}

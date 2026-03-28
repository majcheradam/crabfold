export type DeployStep =
  | "prepare"
  | "repo"
  | "project"
  | "service"
  | "env_vars"
  | "storage"
  | "deploying";

export type DeployStepStatus = "pending" | "running" | "done" | "error";

export interface DeployEvent {
  step: DeployStep;
  status: DeployStepStatus;
  message?: string;
  domain?: string;
  buildStatus?: string;
}

export interface DeployCompleteEvent {
  event: "complete";
  railwayProjectId: string;
  url: string;
}

export interface DeployErrorEvent {
  event: "error";
  message: string;
  step: DeployStep;
}

export type DeploySSEEvent =
  | DeployEvent
  | DeployCompleteEvent
  | DeployErrorEvent;

export interface DeployConfig {
  agentId: string;
  agentName: string;
  agentSlug: string;
  envVars: Record<string, string>;
  files: AgentFileInput[];
  fork: "openclaw" | "nanobot" | "ironclaw";
  skills: string[];
}

export interface AgentFileInput {
  content: string;
  path: string;
}

export interface DeployTokens {
  githubToken: string;
  railwayToken: string;
}

export type EmitFn = (event: DeploySSEEvent) => void;

export interface DeployJob {
  agentId: string;
  createdAt: Date;
  events: DeploySSEEvent[];
  id: string;
  listeners: Set<(event: DeploySSEEvent) => void>;
  status: "running" | "complete" | "error";
}

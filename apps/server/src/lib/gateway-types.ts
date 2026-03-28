// ── Gateway types ───────────────────────────────────────────────

export interface GatewayChatRequest {
  message: string;
  api_key?: string;
}

export interface GatewayChatError {
  error: string;
  message?: string;
  retryAfterMs?: number;
}

export interface GatewayProxyHeaders {
  "X-Gateway-Latency": string;
  "X-RateLimit-Remaining": string;
  "Retry-After"?: string;
}

// ── Connector types ─────────────────────────────────────────────

export interface SkillSearchResult {
  slug: string;
  displayName: string;
  summary: string | null;
  author?: string;
  downloads?: number;
  version?: string;
  installed: boolean;
  enabledOn: string[];
}

export interface SkillInstallRequest {
  agentId: string;
  skillId: string;
}

export interface SkillInstallResponse {
  installed: boolean;
  tools: string[];
  message?: string;
}

export interface SkillUninstallRequest {
  agentId: string;
  skillId: string;
}

export interface SkillUninstallResponse {
  uninstalled: boolean;
}

export interface McpConnectRequest {
  agentId: string;
  url: string;
  name: string;
}

export interface McpConnectResponse {
  mcp: {
    id: string;
    name: string;
    status: "connected";
    tools: string[];
  };
}

// ── Observability types ─────────────────────────────────────────

export interface AgentMetrics {
  agentId: string;
  range: string;
  totalTokens: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  costUsd: number;
  errorCount: number;
  successRate: number;
  totalRequests: number;
}

export interface TraceEntry {
  traceId: string;
  name: string;
  durationMs: number;
  status: "ok" | "error";
  tokenCount: number;
  timestamp: string;
}

export interface SpanNode {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  attributes: Record<string, string | number>;
  children: SpanNode[];
}

export interface TraceSpanTree {
  traceId: string;
  rootSpan: SpanNode;
  totalDuration: number;
  totalTokens: number;
}

export interface LiveMetricUpdate {
  type: string;
  agentId?: string;
  tokens?: number;
  costUsd?: number;
  latencyMs?: number;
  timestamp?: string;
}

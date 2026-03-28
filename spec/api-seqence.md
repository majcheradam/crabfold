# Crabfold — Sequence Diagrams (Vercel-style routes)

## Feature 1a: Sign in with GitHub (better-auth)

```mermaid
sequenceDiagram
    participant U as Next.js /login
    participant API as Elysia + better-auth
    participant GH as GitHub OAuth
    participant DB as Database

    U->>API: authClient.signIn.social({ provider: "github" })
    API->>GH: Redirect to GitHub consent screen
    GH-->>U: User approves → redirect to /callback?code=xxx
    U->>API: GET /api/auth/callback/github?code=xxx
    API->>GH: Exchange code for access_token
    GH-->>API: { access_token, user profile }
    API->>DB: user.upsert({ email, name, avatar, githubId })
    API->>DB: account.create(userId, "github", { token })
    API->>DB: session.create(userId)
    DB-->>API: { userId, sessionId }
    API-->>U: Set-Cookie: better-auth.session_token
    U->>U: Redirect to /{username} (dashboard)
    Note over U,DB: User is authenticated with GitHub only.<br/>No Railway token yet — deploy button will trigger OAuth later.
```

## Feature 1b: Lazy Railway OAuth (on first deploy)

```mermaid
sequenceDiagram
    participant U as Next.js /{u}/{a}/deploy
    participant API as Elysia + better-auth
    participant RW as Railway OAuth
    participant DB as Database

    U->>API: POST /api/agents/:id/deploy
    API->>DB: accounts.findByProvider(userId, "railway")
    DB-->>API: null (not connected)
    API-->>U: 403 { code: "RAILWAY_NOT_CONNECTED" }

    U->>U: Show <RailwayConnectModal>
    Note over U: Modal explains: "Crabfold needs access<br/>to your Railway account to deploy agents."

    U->>API: authClient.signIn.social({ provider: "railway", callbackURL: "/{u}/{a}/deploy?autoRetry=true" })
    API->>RW: OAuth redirect + PKCE challenge + scope: offline_access
    RW-->>U: Railway consent screen (shows requested permissions)
    U->>RW: User clicks "Authorize Crabfold"
    RW-->>U: Redirect to /callback?code=xxx&state=yyy

    U->>API: GET /api/auth/callback/railway?code=xxx
    API->>RW: Exchange code + PKCE verifier for tokens
    RW-->>API: { access_token (1h), refresh_token }
    API->>DB: account.create(userId, "railway", { encryptedTokens })
    DB-->>API: ok
    API-->>U: Redirect to /{u}/{a}/deploy?autoRetry=true

    Note over U: Page detects autoRetry=true param

    U->>API: POST /api/agents/:id/deploy (auto-retry)
    API->>DB: accounts.findByProvider(userId, "railway")
    DB-->>API: { accessToken, refreshToken }
    API->>API: Validate token expiry, refresh if needed
    API-->>U: { jobId }
    U->>API: GET /api/jobs/:jobId/stream (SSE)
    API-->>U: SSE: deploy pipeline begins...
```

## Feature 2: Scaffold Agent (live progress at /new)

```mermaid
sequenceDiagram
    participant U as Next.js /new
    participant API as Elysia API
    participant GM as Gemini (AI SDK)
    participant CH as Clawhub.ai
    participant DB as Database

    U->>API: POST /api/agents/create { prompt, userId }
    API-->>U: { jobId }
    U->>API: GET /api/jobs/:jobId/stream (SSE)

    par A: Fork Selection
        API->>GM: generateObject(prompt, ForkSchema)
        API-->>U: SSE: { step: "fork", status: "running", label: "Analyzing request..." }
        GM-->>API: { fork: "ironclaw", reasoning: "Complex multi-step agent" }
        API-->>U: SSE: { step: "fork", status: "done", label: "Selected ironclaw" }
    and B: Skill Search
        API->>CH: GET /api/skills?q=extracted_keywords
        API-->>U: SSE: { step: "skills", status: "running", label: "Searching skills..." }
        CH-->>API: Skill[] (e.g. web-search, github-api, email)
        API-->>U: SSE: { step: "skills", status: "done", label: "Found 5 skills" }
    and C: Generate SOUL.md (streaming)
        API->>GM: streamText(prompt, forkType)
        API-->>U: SSE: { step: "soul", status: "running", label: "Generating personality..." }
        loop Token by token
            GM-->>API: text chunk
            API-->>U: SSE: { event: "soul_chunk", text: "..." }
        end
        API-->>U: SSE: { step: "soul", status: "done" }
    end

    API->>API: Merge fork + skills + soul → AgentConfig
    API-->>U: SSE: { step: "assemble", status: "running" }
    API->>API: forkAdapter.generateFiles(config)
    API-->>U: SSE: { step: "files", status: "done", label: "12 files generated" }

    API->>DB: agents.insert({ userId, slug, config, files, status: "draft" })
    DB-->>API: { agentId, slug: "email-bot" }
    API-->>U: SSE: { event: "complete", agentId, slug: "email-bot" }

    U->>U: Show buttons: "Edit" → /{username}/email-bot/editor | "Deploy" → /{username}/email-bot/deploy
```

## Feature 3: Visual Editor (/{u}/{a}/editor)

```mermaid
sequenceDiagram
    participant U as Next.js /{u}/{a}/editor
    participant API as Elysia API
    participant DB as Database
    participant AG as Agent (Railway)

    U->>API: GET /api/agents/:id
    API->>DB: agents.get(id)
    DB-->>API: { config, soul, skills[], fork, status, deploymentUrl }
    API-->>U: Full agent config
    U->>U: Render: CodeMirror (SOUL.md) + SkillToggleList + ForkSelector

    Note over U: User edits SOUL.md content

    Note over U: User toggles skills

    U->>API: PATCH /api/agents/:id/skills { enable: ["web-search"], disable: ["email"] }
    API->>DB: Update skill manifest
    DB-->>API: ok
    API-->>U: { skills: updated[] }

    Note over U: User selects different fork

    U->>API: POST /api/agents/:id/fork { from: "nanobot", to: "ironclaw" }
    API->>API: Regenerate files via IronclawAdapter
    API->>DB: Update agent config, fork, files
    DB-->>API: ok
    API-->>U: { newFiles[], warnings: ["Ironclaw needs Postgres — will provision on deploy"] }
    U->>U: Show migration warnings

    Note over U: User clicks "Save"

    U->>API: PATCH /api/agents/:id { soul: "updated content...", envVars: {...} }
    API->>DB: agents.update(id, changes)
    DB-->>API: ok

    alt Agent is deployed (status = "live")
        API->>AG: POST /api/config/reload { soul, skills }
        AG->>AG: Hot-reload config without restart
        AG-->>API: { reloaded: true }
        API-->>U: SSE: { event: "config_applied", reloaded: true }
        U->>U: Show "Changes applied to live agent" toast
    else Agent is draft
        API-->>U: { saved: true, status: "draft" }
        U->>U: Show "Saved" toast
    end
```

## Feature 4: Deploy to Railway (/{u}/{a}/deploy)

```mermaid
sequenceDiagram
    participant U as Next.js /{u}/{a}/deploy
    participant API as Elysia API
    participant DS as Deploy Service
    participant GH as GitHub API
    participant RW as Railway GraphQL

    U->>API: POST /api/agents/:id/deploy
    API->>API: Check Railway token (see Feature 1b if missing)
    API-->>U: { jobId }
    U->>API: GET /api/jobs/:jobId/stream (SSE)
    API->>DS: deployToRailway(config, railwayToken, emit)

    DS->>DS: Inject OTel config + control API into agent files
    DS-->>U: SSE: { step: "prepare", status: "done" }

    DS->>GH: octokit.repos.create({ name: "crabfold-{slug}" }) + push files
    GH-->>DS: { repoUrl, fullName }
    DS-->>U: SSE: { step: "repo", status: "done" }

    DS->>RW: mutation projectCreate { name: "crabfold-{slug}" }
    RW-->>DS: { projectId, environmentId }
    DS-->>U: SSE: { step: "project", status: "done" }

    DS->>RW: mutation serviceCreate { projectId, source: { repo } }
    RW-->>DS: { serviceId }
    DS-->>U: SSE: { step: "service", status: "done" }

    DS->>RW: mutation variableCollectionUpsert { envVars + OTEL_ENDPOINT }
    RW-->>DS: ok
    DS-->>U: SSE: { step: "env_vars", status: "done" }

    alt Fork = openclaw | nanobot (file-based threads)
        DS->>RW: mutation volumeCreate { mountPath: "/data", sizeMb: 1024 }
        RW-->>DS: { volumeId }
    else Fork = ironclaw (DB-backed threads)
        DS->>RW: mutation serviceCreate { source: { image: "postgres:16-alpine" } }
        RW-->>DS: { dbServiceId }
    end
    DS-->>U: SSE: { step: "storage", status: "done" }

    DS->>RW: mutation serviceInstanceDeployV2 { serviceId, environmentId }
    RW-->>DS: { deploymentId }
    DS->>RW: mutation serviceDomainCreate { serviceId }
    RW-->>DS: { domain: "{slug}-production.up.railway.app" }
    DS-->>U: SSE: { step: "deploying", domain }

    loop Poll deployment status
        DS->>RW: query deployments(serviceId) { status }
        RW-->>DS: { status }
        DS-->>U: SSE: { step: "deploying", buildStatus }
    end

    DS->>API: db.agents.update(id, { status: "live", deploymentUrl, railwayProjectId })
    DS-->>U: SSE: { event: "complete", url: "https://{slug}-production.up.railway.app" }

    U->>U: Show live URL + "Open Agent" link + "View Metrics" link
```

## Feature 5: Dashboard (/{username})

```mermaid
sequenceDiagram
    participant U as Next.js /{username}
    participant API as Elysia API
    participant DB as Database
    participant AG as Deployed Agents (Railway)

    U->>API: GET /api/agents?userId=xxx
    API->>DB: agents.findByUser(userId)
    DB-->>API: Agent[] { id, slug, name, fork, status, deploymentUrl, updatedAt }

    par Health check deployed agents
        loop For each agent where status = "live"
            API->>AG: GET {deploymentUrl}/health
            AG-->>API: { status: "healthy", uptime, activeThreads }
        end
    end

    API-->>U: { agents: [{ slug, name, fork, status, health, threadCount, lastActive }] }

    U->>U: Render <AgentGrid>
    Note over U: Each <AgentCard> shows:<br/>• Agent name + fork badge<br/>• Status dot (green/yellow/red)<br/>• Active thread count<br/>• Last active timestamp<br/>• Click → /{username}/{slug}

    loop StatusPoller — every 30 seconds
        U->>API: GET /api/agents/status
        API->>AG: Health check all deployed agents
        API-->>U: { statuses: { [agentId]: "healthy" | "degraded" | "down" } }
        U->>U: Update status dots on cards
    end

    Note over U: User clicks "New Agent" button
    U->>U: Navigate to /new

    Note over U: User clicks agent card
    U->>U: Navigate to /{username}/{slug}
```

## Feature 6: Threads + Interrupt (/{u}/{a}/threads)

```mermaid
sequenceDiagram
    participant U as Next.js /{u}/{a}/threads
    participant API as Elysia API
    participant TS as Thread Store (fork adapter)
    participant AG as Agent (Railway)

    U->>API: GET /api/agents/:id/threads?limit=20&sort=recent
    API->>TS: adapter.listThreads()
    Note over TS: Openclaw: glob threads/*.md, parse frontmatter<br/>Nanobot: read memory/threads.json<br/>Ironclaw: SELECT * FROM threads ORDER BY updated_at DESC
    TS-->>API: Thread[] { id, title, lastMessage, messageCount, updatedAt }
    API-->>U: Thread list
    U->>U: Render <ThreadList> with previews

    Note over U: User clicks a thread → /{u}/{a}/threads/{tid}

    U->>API: GET /api/agents/:id/threads/:tid?limit=100
    API->>TS: adapter.getHistory(tid)
    TS-->>API: Message[] { role, content, timestamp, toolCalls[], source }
    API-->>U: Full chat history
    U->>U: Render <ThreadView> — chat bubbles with tool call badges

    U->>API: GET /api/agents/:id/threads/:tid/live (SSE)
    API->>AG: WebSocket subscribe({ threadId: tid })
    AG-->>API: Connected

    loop Agent is actively working on this thread
        AG-->>API: { type: "message", role: "assistant", content, toolCalls }
        API-->>U: SSE: { event: "message_added", message }
        U->>U: Append message bubble to <ThreadView>

        AG-->>API: { type: "tool_result", tool: "web-search", result }
        API-->>U: SSE: { event: "tool_result", tool, result }
        U->>U: Show tool result card in thread
    end

    Note over U: User types interrupt in <InjectInput>

    U->>API: POST /api/agents/:id/threads/:tid/inject { message: "Stop — focus on the budget section instead" }
    API->>API: Validate: user owns agent, thread exists
    API->>AG: POST /api/interrupt { threadId: tid, message, source: "crabfold-dashboard" }
    AG->>AG: Inject human message into reasoning loop
    AG->>TS: Persist human message to thread
    AG->>AG: Re-evaluate with new instruction
    AG-->>API: { type: "message", role: "assistant", content: "Got it, switching focus..." }
    API-->>U: SSE: { event: "agent_response", message }
    U->>U: Show agent's response to interrupt

    Note over U: User clicks Pause button in <AgentControls>

    U->>API: POST /api/agents/:id/control { action: "pause" }
    API->>AG: POST /api/control { action: "pause" }
    AG->>AG: Pause reasoning loop after current step
    AG-->>API: { status: "paused", pausedAt: "step 3 of 5" }
    API-->>U: SSE: { event: "agent_paused", pausedAt }
    U->>U: Show "Paused at step 3" badge + "Resume" button

    Note over U: User clicks Resume

    U->>API: POST /api/agents/:id/control { action: "resume" }
    API->>AG: POST /api/control { action: "resume" }
    AG-->>API: { status: "running" }
    API-->>U: SSE: { event: "agent_resumed" }
    U->>U: Resume live message stream
```

## Feature 7: Observability (/{u}/{a}/metrics)

```mermaid
sequenceDiagram
    participant U as Next.js /{u}/{a}/metrics
    participant API as Elysia API
    participant OT as OTel Collector
    participant AG as Agent (Railway)

    Note over AG,OT: Background: continuous telemetry emission

    loop Agents emit spans continuously
        AG->>OT: OTLP/HTTP spans: LLM calls, tool invocations, errors
        Note right of AG: Attributes: agent.id, agent.fork,<br/>gen_ai.request.model, gen_ai.usage.input_tokens
    end

    loop Elysia API emits spans too
        API->>OT: AI SDK telemetry (experimental_telemetry: true)
        Note right of API: Spans: ai.generateText, ai.generateObject,<br/>ai.streamText, ai.toolCall
    end

    U->>API: GET /api/agents/:id/metrics?range=24h
    API->>OT: Query: spans WHERE agent.id = :id AND timestamp > 24h ago
    OT-->>API: Aggregated: { totalTokens, avgLatency, p99Latency, costUsd, errorCount, successRate }
    API-->>U: Metrics summary
    U->>U: Render <MetricsDashboard> — stat cards + line charts (recharts)

    U->>API: GET /api/agents/:id/traces?limit=20&sort=recent
    API->>OT: Query recent root spans for agent
    OT-->>API: Trace[] { traceId, name, duration, status, tokenCount, timestamp }
    API-->>U: Trace list
    U->>U: Render trace table with duration bars

    Note over U: User clicks a trace row

    U->>API: GET /api/agents/:id/traces/:traceId
    API->>OT: Fetch full span tree for trace
    OT-->>API: { rootSpan, children[], totalDuration, totalTokens }
    API-->>U: Nested span tree
    U->>U: Render <TraceWaterfall> — horizontal bars showing timing

    U->>API: GET /api/agents/:id/metrics/live (SSE)

    loop Real-time metric updates
        OT-->>API: New span completed for agent
        API->>API: Aggregate incrementally
        API-->>U: SSE: { event: "metric_update", tokens: +150, cost: +$0.002, latency: 1.2s }
        U->>U: Update <CostTicker> + spark line charts
    end
```

## Feature 8: Gateway + Connectors (/gateway, /connectors)

```mermaid
sequenceDiagram
    participant EX as External Client
    participant GW as Gateway /gateway/:agentId/*
    participant AG as Agent (Railway)
    participant U as Next.js /connectors
    participant API as Elysia API
    participant CH as Clawhub.ai

    Note over EX,AG: Gateway — proxy external API consumers to deployed agents

    EX->>GW: POST /gateway/:agentId/chat { message, api_key }
    GW->>GW: Validate API key from api_keys table
    GW->>GW: Rate limit check (token bucket)
    GW->>GW: Resolve agent deploymentUrl from cache/DB
    GW->>AG: Proxy: POST {deploymentUrl}/api/chat { message }
    Note over GW,AG: Stream passthrough — no buffering
    AG-->>GW: Streamed response (chunked transfer)
    GW-->>EX: Proxied stream
    GW->>GW: Log to OTel: gateway.proxy span { agentId, latency, tokens }

    Note over U,CH: Connectors — skill marketplace at /connectors

    U->>API: GET /api/connectors/skills?q=web+search&category=tools
    API->>CH: GET clawhub.ai/api/skills?q=web+search
    CH-->>API: Skill[] { id, name, description, author, downloads, version }
    API->>API: Merge with user's installed skills status per agent
    API-->>U: Skills[] with { installed: bool, enabledOn: agentId[] }
    U->>U: Render <SkillMarketplace> — grid of <SkillCard>

    Note over U: User clicks "Install" on a skill

    U->>API: POST /api/connectors/install { agentId, skillId: "web-search" }
    API->>CH: GET clawhub.ai/api/skills/web-search/download
    CH-->>API: Skill package (files + manifest.json)
    API->>API: Validate skill, add to agent config
    API->>AG: POST /api/skills/install { skillId, files }
    AG->>AG: Load skill into runtime
    AG-->>API: { loaded: true, tools: ["search_web", "fetch_url"] }
    API-->>U: { installed: true, tools[] }
    U->>U: Update <SkillCard> to show "Installed ✓"

    Note over U: User removes a skill

    U->>API: DELETE /api/connectors/uninstall { agentId, skillId: "email" }
    API->>API: Remove from agent config
    API->>AG: POST /api/skills/uninstall { skillId: "email" }
    AG-->>API: { unloaded: true }
    API-->>U: { uninstalled: true }

    Note over U: MCP connections at /connectors/mcp

    U->>API: POST /api/connectors/mcp { agentId, url: "https://mcp.stripe.com/sse", name: "stripe" }
    API->>API: Validate MCP server URL (health check)
    API->>API: Add MCP config to agent settings
    API->>AG: POST /api/mcp/connect { url, name }
    AG->>AG: Connect to MCP server, discover tools
    AG-->>API: { connected: true, tools: ["create_invoice", "list_payments", "refund"] }
    API-->>U: { mcp: { name: "stripe", tools[], status: "connected" } }
    U->>U: Show connected MCP server with tool list
```

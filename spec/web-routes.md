      # Crabfold — Next.js App Routes (Vercel-style pattern)

## URL Pattern

```
crabfold.ai/new                                → Scaffold wizard
crabfold.ai/new/import                         → Import existing agent
crabfold.ai/{username}                         → Agent dashboard
crabfold.ai/{username}/{agent-slug}            → Agent overview
crabfold.ai/{username}/{agent-slug}/editor     → Visual editor
crabfold.ai/{username}/{agent-slug}/threads    → Thread list
crabfold.ai/{username}/{agent-slug}/threads/{tid} → Live thread + interrupt
crabfold.ai/{username}/{agent-slug}/metrics    → Observability
crabfold.ai/{username}/{agent-slug}/deploy     → Deploy flow
crabfold.ai/{username}/{agent-slug}/settings   → Agent settings
crabfold.ai/connectors                         → Skill marketplace
crabfold.ai/connectors/mcp                     → MCP server manager
crabfold.ai/settings                           → User profile
crabfold.ai/settings/keys                      → API keys
crabfold.ai/settings/connections               → GitHub + Railway status
```

## Reserved Slugs (cannot be usernames)

```
new, login, callback, connectors, settings, gateway, api, docs, blog, pricing, about
```

## Route Tree

```
apps/web/app/
├── layout.tsx                                  # Root: AuthProvider, theme, fonts, Toaster
├── page.tsx                                    # Landing / marketing page (public)
│
├── (auth)/                                     # Auth group — centered card, no sidebar
│   ├── layout.tsx                              # Centered card layout
│   ├── login/
│   │   └── page.tsx                            # "Sign in with GitHub" button
│   └── callback/
│       └── page.tsx                            # OAuth callback (GitHub + Railway)
│
├── new/                                        # Global create — no agent context yet
│   ├── layout.tsx                              # Minimal layout (topbar only, no sidebar)
│   ├── page.tsx                                # Scaffold wizard: prompt → live progress
│   └── import/
│       └── page.tsx                            # Import agent from GitHub repo or config
│
├── connectors/                                 # Global marketplace — not agent-scoped
│   ├── layout.tsx                              # Dashboard shell (sidebar + topbar)
│   ├── page.tsx                                # Clawhub skill marketplace: browse + install
│   └── mcp/
│       └── page.tsx                            # MCP server connections: add/remove/test
│
├── settings/                                   # Global user settings
│   ├── layout.tsx                              # Dashboard shell + settings sidebar
│   ├── page.tsx                                # Profile: name, avatar, email
│   ├── keys/
│   │   └── page.tsx                            # API keys: Gemini key, gateway API keys
│   └── connections/
│       └── page.tsx                            # Connected accounts: GitHub ✓, Railway ✗ + connect
│
├── [username]/                                 # User namespace — dynamic
│   ├── layout.tsx                              # Dashboard shell (sidebar with agent list)
│   ├── page.tsx                                # Agent grid: cards with status badges + "New Agent" CTA
│   │
│   └── [agentSlug]/                            # Single agent context
│       ├── layout.tsx                          # Agent detail: tabs (Overview, Editor, Threads, Metrics, Deploy, Settings)
│       ├── page.tsx                            # Overview: status, fork, URL, quick stats, recent threads
│       │
│       ├── editor/
│       │   └── page.tsx                        # SOUL.md editor + skill toggles + fork selector
│       │
│       ├── threads/
│       │   ├── page.tsx                        # Thread list with search + filters
│       │   └── [threadId]/
│       │       └── page.tsx                    # Live chat UI + inject input + pause/resume/stop
│       │
│       ├── metrics/
│       │   └── page.tsx                        # Token usage, latency, cost, trace waterfall
│       │
│       ├── deploy/
│       │   └── page.tsx                        # Railway connect modal → deploy progress
│       │
│       └── settings/
│           └── page.tsx                        # Agent env vars, redeploy, transfer, delete
│
└── gateway/                                    # Public API proxy — no auth UI
    └── [...slug]/
        └── route.ts                            # Catch-all: proxy to deployed agent
```

## Page Details

### (auth) — unauthenticated

| Route    | URL         | Purpose                                   | Data                |
| -------- | ----------- | ----------------------------------------- | ------------------- |
| Login    | `/login`    | "Sign in with GitHub" button              | None                |
| Callback | `/callback` | OAuth redirect handler (GitHub + Railway) | `?code=`, `?state=` |

### /new — global create

| Route    | URL           | Purpose                                                 | Data                                                    |
| -------- | ------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Scaffold | `/new`        | Prompt → fork selection → skill search → SOUL.md stream | `POST /api/agents/create` → `SSE /api/jobs/:jid/stream` |
| Import   | `/new/import` | Paste GitHub URL or upload config to import agent       | `POST /api/agents/import`                               |

### /connectors — global marketplace

| Route  | URL               | Purpose                                   | Data                           |
| ------ | ----------------- | ----------------------------------------- | ------------------------------ |
| Skills | `/connectors`     | Browse + install Clawhub skills to agents | `GET /api/connectors/skills`   |
| MCP    | `/connectors/mcp` | Manage MCP server connections             | `GET/POST /api/connectors/mcp` |

### /settings — global user

| Route       | URL                     | Purpose                                  | Data                          |
| ----------- | ----------------------- | ---------------------------------------- | ----------------------------- |
| Profile     | `/settings`             | Name, avatar, email                      | `GET /api/user`               |
| Keys        | `/settings/keys`        | Gemini key, gateway API keys             | `GET/POST /api/settings/keys` |
| Connections | `/settings/connections` | GitHub ✓, Railway ✗ + connect/disconnect | `GET /api/user/accounts`      |

### /[username] — user dashboard

| Route     | URL Example | Purpose                        | Data                        |
| --------- | ----------- | ------------------------------ | --------------------------- |
| Dashboard | `/adam`     | Agent cards grid + live status | `GET /api/agents` + polling |

### /[username]/[agentSlug] — agent detail

| Route         | URL Example                     | Purpose                               | Data                                |
| ------------- | ------------------------------- | ------------------------------------- | ----------------------------------- |
| Overview      | `/adam/email-bot`               | Status, fork, deploy URL, quick stats | `GET /api/agents/:id`               |
| Editor        | `/adam/email-bot/editor`        | SOUL.md + skills + fork               | `GET/PATCH /api/agents/:id`         |
| Threads       | `/adam/email-bot/threads`       | Thread list with previews             | `GET /api/agents/:id/threads`       |
| Thread Detail | `/adam/email-bot/threads/t_abc` | Live chat + inject + control          | `SSE + POST /inject + /control`     |
| Metrics       | `/adam/email-bot/metrics`       | Tokens, latency, cost, traces         | `GET /api/agents/:id/metrics` + SSE |
| Deploy        | `/adam/email-bot/deploy`        | Railway modal → deploy progress       | `POST /deploy` → SSE                |
| Settings      | `/adam/email-bot/settings`      | Env vars, redeploy, delete            | `PATCH/DELETE /api/agents/:id`      |

## Layouts (4 total)

```
Root layout.tsx
│  AuthProvider, ThemeProvider, Toaster
│
├── (auth)/layout.tsx
│   Centered card, dark bg, no navigation
│
├── /new/layout.tsx
│   Topbar only (logo + user menu), no sidebar
│   Full-width content area for wizard stepper
│
├── Dashboard shell (shared by /[username], /connectors, /settings)
│   ├── Sidebar
│   │   ├── Logo + link to /{username}
│   │   ├── "New Agent" button → /new
│   │   ├── Agent list (live status dots)
│   │   ├── Connectors link
│   │   └── Settings link
│   ├── Topbar
│   │   ├── Breadcrumbs (username / agent-slug / tab)
│   │   ├── Cmd+K search
│   │   └── User menu (avatar, sign out)
│   │
│   └── /[username]/[agentSlug]/layout.tsx
│       Tab bar: Overview · Editor · Threads · Metrics · Deploy · Settings
│       Agent name + fork badge + status pill in header
```

## Key Components

### Global

| Component        | Used In         | Purpose                           |
| ---------------- | --------------- | --------------------------------- |
| `<AuthProvider>` | Root layout     | better-auth session context       |
| `<Sidebar>`      | Dashboard shell | Nav with live agent list          |
| `<CmdKSearch>`   | Topbar          | Quick switch between agents/pages |
| `<UserMenu>`     | Topbar          | Avatar, settings link, sign out   |
| `<Breadcrumbs>`  | Topbar          | `adam / email-bot / threads`      |

### /new (scaffold)

| Component            | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `<PromptInput>`      | Textarea with submit for agent description             |
| `<ScaffoldStepper>`  | SSE-driven step indicators (fork, skills, soul, files) |
| `<SoulPreview>`      | Live-streaming SOUL.md content with typing cursor      |
| `<ScaffoldComplete>` | Shows "Edit" + "Deploy" buttons with agent URL         |

### /[username] (dashboard)

| Component        | Purpose                                                 |
| ---------------- | ------------------------------------------------------- |
| `<AgentCard>`    | Name, fork badge, status dot, thread count, last active |
| `<AgentGrid>`    | CSS grid of AgentCards with empty state                 |
| `<StatusPoller>` | 30s interval health check, updates status dots          |

### /[username]/[agentSlug] (agent detail)

| Component               | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `<AgentTabs>`           | Tab navigation (Overview through Settings)                |
| `<AgentHeader>`         | Agent name, fork badge, status pill, deploy URL           |
| `<SoulEditor>`          | CodeMirror editor for SOUL.md                             |
| `<SkillToggleList>`     | Checkbox list of skills with enable/disable               |
| `<ForkSelector>`        | Dropdown to swap fork (with migration warning)            |
| `<ThreadList>`          | Thread cards with last message + timestamp                |
| `<ThreadView>`          | Live chat bubbles via SSE                                 |
| `<InjectInput>`         | Text input to send human interrupt to agent               |
| `<AgentControls>`       | Pause / Resume / Stop buttons                             |
| `<MetricsDashboard>`    | Recharts: token usage, latency, cost over time            |
| `<TraceWaterfall>`      | Span tree visualization for individual traces             |
| `<CostTicker>`          | Live SSE-driven cost counter                              |
| `<DeployProgress>`      | SSE-driven deploy steps (repo → project → service → live) |
| `<RailwayConnectModal>` | Lazy OAuth modal when Railway not connected               |
| `<EnvVarEditor>`        | Key-value editor for agent environment variables          |
| `<DangerZone>`          | Delete agent, force redeploy                              |

### /connectors

| Component            | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `<SkillMarketplace>` | Browse Clawhub skills with search + filters             |
| `<SkillCard>`        | Skill name, description, install button, agent selector |
| `<McpManager>`       | List MCP servers, add URL, test connection, view tools  |

## SSE Subscriptions

| Page          | URL                      | SSE Endpoint                            | Events                                                             |
| ------------- | ------------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| `/new`        | `/new`                   | `GET /api/jobs/:jobId/stream`           | `step`, `soul_chunk`, `complete`, `error`                          |
| Deploy        | `/{u}/{a}/deploy`        | `GET /api/jobs/:jobId/stream`           | `step` (repo/project/service/storage/deploying), `complete`        |
| Thread Detail | `/{u}/{a}/threads/{tid}` | `GET /api/agents/:id/threads/:tid/live` | `message_added`, `agent_response`, `agent_paused`, `agent_resumed` |
| Metrics       | `/{u}/{a}/metrics`       | `GET /api/agents/:id/metrics/live`      | `metric_update` (tokens, cost, latency)                            |

## Navigation Flows

```
Landing (/)
  └── Login (/login)
        └── GitHub OAuth → Callback (/callback)
              └── Dashboard (/{username})
                    ├── New Agent (/new)
                    │     └── Scaffold complete → /{username}/{new-agent-slug}
                    │
                    ├── Click agent card → /{username}/{agent-slug}
                    │     ├── Editor tab → /{username}/{agent-slug}/editor
                    │     ├── Threads tab → /{username}/{agent-slug}/threads
                    │     │     └── Click thread → /{username}/{agent-slug}/threads/{tid}
                    │     ├── Metrics tab → /{username}/{agent-slug}/metrics
                    │     ├── Deploy tab → /{username}/{agent-slug}/deploy
                    │     │     └── Railway not connected? → Modal → Railway OAuth → auto-retry deploy
                    │     └── Settings tab → /{username}/{agent-slug}/settings
                    │
                    ├── Connectors → /connectors
                    │     └── MCP → /connectors/mcp
                    │
                    └── Settings → /settings
                          ├── Keys → /settings/keys
                          └── Connections → /settings/connections
```

## Feature → Route Mapping

| Feature                   | Primary Route        | Secondary Routes                     |
| ------------------------- | -------------------- | ------------------------------------ |
| F1a: GitHub Auth          | `/login`             | `/callback`                          |
| F1b: Railway OAuth (lazy) | `/{u}/{a}/deploy`    | `/callback`, `/settings/connections` |
| F2: Scaffold Pipeline     | `/new`               | `/new/import`                        |
| F3: Visual Editor         | `/{u}/{a}/editor`    | —                                    |
| F4: Deploy to Railway     | `/{u}/{a}/deploy`    | —                                    |
| F5: Dashboard             | `/{username}`        | `/{u}/{a}` (overview)                |
| F6: Threads + Interrupt   | `/{u}/{a}/threads`   | `/{u}/{a}/threads/{tid}`             |
| F7: Observability         | `/{u}/{a}/metrics`   | —                                    |
| F8: Gateway + Connectors  | `/gateway/[...slug]` | `/connectors`, `/connectors/mcp`     |

# cc-haha Architecture Document

> **Project**: cc-haha (Claude Code Haha)
> **Version**: 0.2.4 (desktop), 999.0.0-local (CLI)
> **Commit**: `ae7e33c` (main branch HEAD at analysis time)
> **Tech Stack**: TypeScript / Bun / React (Ink + Web) / Tauri (Rust)
> **Last Updated**: 2026-05-11
> **Repository**: NanmiCoder/cc-haha

---

## 1. Overview

cc-haha is a community-driven desktop workstation for Claude Code, built from the leaked Claude Code source (2026-03-31). It unifies terminal-based AI coding sessions, multi-project management, branch/Worktree workflows, code diff visualization, permission gating, model provider configuration, Computer Use, H5 remote access, IM integrations, and scheduled tasks into a single macOS/Windows desktop application.

The architecture is a **multi-runtime hybrid**:
- **CLI core**: Bun-based terminal UI using React/Ink
- **Desktop app**: Vite + React 18 web frontend inside a Tauri 2 native shell
- **Local server**: Bun HTTP/WebSocket server bridging desktop UI to CLI runtime
- **IM adapters**: Standalone Bun microservices for Feishu, DingTalk, Telegram, and WeChat

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interfaces                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│   │  Terminal    │  │   Desktop    │  │     H5 Mobile Access     │  │
│   │  (Ink TUI)   │  │  (Tauri App) │  │   (WebSocket bridge)     │  │
│   └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │
└──────────┼─────────────────┼──────────────────────┼─────────────────┘
           │                 │                      │
           ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CLI Runtime (Bun / src/)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Commands    │  │   Tools      │  │   Services   │              │
│  │  (112 impl)  │  │  (59 impl)   │  │  (40+ impl)  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         └─────────────────┼──────────────────┘                      │
│                           ▼                                         │
│              ┌──────────────────────────────┐                       │
│              │   Core Runtime Layer          │                       │
│              │  - API client (Anthropic/     │                       │
│              │    Bedrock/Vertex/OAuth)      │                       │
│              │  - Session state (Zustand-     │                       │
│              │    like custom store)          │                       │
│              │  - Permissions / Policy        │                       │
│              │  - MCP / LSP integration       │                       │
│              │  - Bridge (Remote session)     │                       │
│              │  - Analytics (optional)        │                       │
│              │  - Cost tracking               │                       │
│              └──────────────────────────────┘                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────┐ ┌─────────────────┐
    │   Local Server   │ │  Native  │ │   IM Adapters   │
    │  (src/server/)   │ │ (Tauri)  │ │  (adapters/)    │
    │  REST + WS API   │ │  Rust    │ │  Feishu/DingTalk│
    └─────────────────┘ └──────────┘ │  Telegram/WeChat│
                                     └─────────────────┘
```

---

## 3. Module Breakdown

### 3.1 Entrypoints (`src/entrypoints/`)

| File | Purpose |
|------|---------|
| `cli.tsx` | Main CLI bootstrap with Ink TUI. Handles fast paths, feature flags, dynamic imports. |
| `init.ts` | Initialization sequence (auth, config, plugin loading). |
| `mcp.ts` | MCP (Model Context Protocol) server entrypoint. |
| `sandboxTypes.ts` | Sandbox runtime type definitions. |
| `sdk/` | SDK type exports for external consumers. |

### 3.2 Commands (`src/commands/`)

**112 self-contained slash command implementations**, each in its own directory.

**Notable commands:**
- `login`, `logout` — Authentication
- `config`, `settings` — Configuration management
- `doctor` — Health checks
- `skills` — Skill management
- `mcp` — MCP server management
- `bridge` — Remote bridge control
- `tasks` — Background task management
- `plan` — Plan mode
- `review` — Code review
- `voice` — Voice mode
- `chrome` — Chrome extension integration
- `buddy` — Companion sprite

**Registration pattern:**
```typescript
// src/commands.ts
export default function registerCommands(app: App) {
  app.register('/login', loginCommand);
  app.register('/skills', skillsCommand);
  // ...
}
```

### 3.3 Tools (`src/tools/`)

**59 agent-invokable tools**, each self-contained with schema definition and execution logic.

**Core tools:**
- `BashTool` / `PowerShellTool` — Shell execution
- `FileReadTool`, `FileWriteTool`, `FileEditTool` — File operations
- `GlobTool`, `GrepTool` — Search
- `MCPTool`, `McpAuthTool`, `ListMcpResourcesTool` — MCP proxy
- `TaskCreateTool`, `TaskUpdateTool`, `TaskListTool`, `TaskGetTool`, `TaskStopTool` — Task management
- `WebFetchTool`, `WebSearchTool`, `WebBrowserTool` — Web access
- `SkillTool`, `DiscoverSkillsTool` — Skill invocation
- `AskUserQuestionTool` — User interaction
- `NotebookEditTool` — Jupyter notebook editing
- `RemoteTriggerTool` — Remote trigger API
- `ScheduleCronTool` — Cron scheduling
- `TeamCreateTool`, `TeamDeleteTool` — Team management
- `SleepTool`, `SnipTool`, `TungstenTool` — Utilities

### 3.4 Bridge (`src/bridge/`)

Remote session bridge for cloud execution, multi-device support, and H5 mobile access.

| Module | Purpose |
|--------|---------|
| `bridgeMain.ts` | Bridge lifecycle management |
| `bridgeApi.ts` | API client for bridge service |
| `bridgeConfig.ts` | Bridge configuration |
| `sessionRunner.ts` | Session spawning & management |
| `jwtUtils.ts` | Token refresh scheduling |
| `workSecret.ts` | Worker registration & secrets |
| `replBridge.ts` | REPL bridge transport |
| `remoteBridgeCore.ts` | Core remote bridge logic |
| `flushGate.ts` | Message flush coordination |
| `webhookSanitizer.ts` | Webhook security |

### 3.5 Services (`src/services/`)

Business logic layer organized by domain.

| Service | Purpose |
|---------|---------|
| `api/` | LLM API client (Anthropic SDK, Bedrock, Vertex, Azure OpenAI) |
| `analytics/` | Telemetry / event logging (optional, GrowthBook feature-gated) |
| `mcp/` | MCP server lifecycle |
| `lsp/` | Language Server Protocol integration |
| `plugins/` | Plugin registry & loading |
| `oauth/` | OAuth token management (Claude.ai, OpenAI) |
| `compact/` | Session compaction / summarization |
| `tools/` | Tool orchestration helpers |
| `SessionMemory/` | Session memory management |
| `voice.ts` | Voice mode support |
| `autoDream/` | Auto-dream / proactive suggestions |
| `teamMemorySync/` | Team memory synchronization |
| `policyLimits/` | Rate limiting & policy enforcement |

### 3.6 State Management (`src/state/`)

React-based state management using a custom store pattern (Zustand-like).

| File | Purpose |
|------|---------|
| `AppState.tsx` | React provider component |
| `AppStateStore.ts` | Core state shape & reducers |
| `store.ts` | Store factory |
| `selectors.ts` | State selectors |

### 3.7 UI Layer — CLI (`src/components/`, `src/screens/`)

Built with **Ink** (React for terminals).

**Key components:**
- `PromptInput` — Command input
- `messages/` — Message rendering
- `diff/` — Diff viewer
- `sandbox/` — Sandbox UI
- `skills/` — Skill UI
- `mcp/` — MCP UI
- `AgentProgressLine.tsx` — Agent progress indicator
- `AutoModeOptInDialog.tsx` — Auto-mode onboarding
- `BridgeDialog.tsx` — Bridge connection UI
- `CostThresholdDialog.tsx` — Cost limit warnings

### 3.8 Context (`src/context/`)

React context providers for cross-cutting concerns:
- `mailbox.tsx` — Message queue
- `notifications.tsx` — Notifications
- `voice.tsx` — Voice state
- `stats.tsx` — Stats overlay
- `fpsMetrics.tsx` — Performance metrics
- `overlayContext.tsx` — Modal/overlay management

### 3.9 Buddy System (`src/buddy/`)

Companion sprite overlay for the terminal UI.
- `companion.ts` — Companion logic
- `CompanionSprite.tsx` — Sprite renderer
- `sprites.ts` — Sprite definitions
- `observer.ts` — Activity observer

### 3.10 Native Modules (`src/native-ts/`)

Optional native TypeScript modules:
- `file-index/` — Fast file indexing
- `color-diff/` — Color diff rendering
- `yoga-layout/` — Layout engine

---

## 4. Desktop App (`desktop/`)

### 4.1 Frontend (`desktop/src/`)

| Layer | Tech | Purpose |
|-------|------|---------|
| Build tool | Vite 8 | Dev server & production bundle |
| Framework | React 18 | UI component tree |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| State | Zustand 5 | Global state management |
| Terminal | xterm.js | In-app terminal emulator |
| Diff | react-diff-viewer | Code diff visualization |
| Syntax | shiki + react-shiki | Code highlighting |
| Icons | lucide-react | Icon set |
| Markdown | marked | Markdown rendering |
| Diagrams | mermaid | Mermaid chart rendering |
| Testing | Vitest + Testing Library | Unit & component tests |

**Key frontend modules:**
- `components/chat/` — Chat UI (messages, input, diff viewer, tool calls, permissions)
- `components/layout/` — App shell, sidebar, tab bar, status bar
- `components/settings/` — Settings panels
- `components/workspace/` — File changes, worktree panel
- `pages/` — Route-level page components
- `stores/` — Zustand stores
- `api/` — Desktop API clients (REST + WebSocket)

### 4.2 Native Shell (`desktop/src-tauri/`)

Tauri 2 (Rust) provides the native desktop window, menu bar, system tray, and OS integrations.

| File | Purpose |
|------|---------|
| `src/main.rs` | Tauri app entrypoint |
| `src/lib.rs` | Native library exports |
| `Cargo.toml` | Rust dependencies |
| `tauri.conf.json` | Tauri configuration |

**Rust dependencies:**
- `tauri` 2.10.3 — Core framework
- `portable-pty` 0.9.0 — Pseudoterminal for embedded terminal
- Plugins: shell, dialog, process, updater, notification, single-instance

### 4.3 Desktop ↔ CLI Bridge

The desktop app spawns the CLI as a child process and communicates via:
1. **WebSocket** — Real-time bidirectional messaging
2. **HTTP API** — The local server (`src/server/`) exposes REST endpoints
3. **Sidecars** (`desktop/sidecars/`) — Auxiliary processes managed by Tauri

---

## 5. Local Server (`src/server/`)

Bun-based HTTP/WebSocket server that acts as the bridge between the desktop UI and the CLI runtime.

| Module | Purpose |
|--------|---------|
| `index.ts` | Server bootstrap |
| `server.ts` | HTTP server setup |
| `router.ts` | Route registration |
| `api/` | API route handlers (~20 endpoints) |
| `services/` | Business logic services (~20 services) |
| `middleware/` | Auth, CORS, error handling |
| `proxy/` | LLM provider proxy & streaming transform |

**Key API areas:**
- `conversations.ts` — Chat session management
- `sessions.ts` — Session CRUD
- `providers.ts` — Model provider configuration
- `mcp.ts` — MCP server management
- `tasks.ts` — Background tasks
- `teams.ts` — Team management
- `computer-use.ts` — Computer Use API
- `h5-access.ts` — H5 remote access
- `filesystem.ts` — File system operations
- `adapters.ts` — IM adapter sessions

**Key services:**
- `conversationService.ts` — Conversation orchestration
- `sessionService.ts` — Session lifecycle
- `providerService.ts` — Provider routing
- `taskService.ts` — Task management
- `cronScheduler.ts` / `cronService.ts` — Scheduled tasks
- `doctorService.ts` — Health diagnostics
- `h5AccessService.ts` — Mobile access control
- `pluginService.ts` — Plugin lifecycle

---

## 6. IM Adapters (`adapters/`)

Standalone Bun package connecting the AI assistant to enterprise IM platforms.

| Adapter | Protocol | Key Files |
|---------|----------|-----------|
| **Feishu** | Lark (飞书) | `feishu/index.ts`, `cardkit.ts`, `streaming-card.ts`, `media.ts` |
| **DingTalk** | DingTalk Stream | `dingtalk/index.ts`, `ai-card.ts`, `permission-card.ts`, `stream-state.ts` |
| **Telegram** | Bot API (grammy) | `telegram/index.ts`, `media.ts` |
| **WeChat** | Custom protocol | `wechat/index.ts`, `protocol.ts`, `typing.ts`, `media.ts` |

**Common infrastructure** (`adapters/common/`):
- `ws-bridge.ts` — WebSocket bridge to local server
- `session-store.ts` — Adapter session persistence
- `message-buffer.ts` / `message-dedup.ts` — Message ordering & deduplication
- `permission.ts` — Permission gating for IM channels
- `pairing.ts` — User pairing / auth
- `format.ts` — Message formatting
- `http-client.ts` — Shared HTTP client
- `chat-queue.ts` — Chat request queuing

---

## 7. Data Flow

### 7.1 Conversation Turn Loop (CLI)

```
User Input (Terminal or Desktop)
    │
    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Parse     │───▶│   Route     │───▶│   Execute   │
│  (/command  │    │  (command   │    │  (LLM call  │
│   or query) │    │   or tool)  │    │   + tools)  │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                              ▼              ▼              ▼
                         ┌────────┐   ┌──────────┐   ┌──────────┐
                         │ Bash   │   │ FileOps  │   │  Search  │
                         │ Output │   │ Result   │   │  Result  │
                         └───┬────┘   └────┬─────┘   └────┬─────┘
                             │             │              │
                             └─────────────┴──────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  Render to  │
                                    │   Terminal  │
                                    └─────────────┘
```

### 7.2 Desktop → Server → CLI Flow

```
Desktop UI (React)
    │
    ▼
┌─────────────────┐
│  WebSocket API  │  (desktop/src/api/websocket.ts)
│  REST API       │  (desktop/src/api/*.ts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Local Server   │  (src/server/)
│  Bun HTTP + WS  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CLI Runtime    │  (src/entrypoints/cli.tsx)
│  Ink TUI + Core │
└─────────────────┘
```

### 7.3 IM Adapter Flow

```
IM Platform (Feishu/DingTalk/Telegram/WeChat)
    │
    ▼
┌─────────────────┐
│  Bot Webhook    │
│  / Event Stream │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Adapter        │  (adapters/<platform>/)
│  (Bun process)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WS Bridge      │  (adapters/common/ws-bridge.ts)
│  Local Server   │
└─────────────────┘
```

---

## 8. Key Design Patterns

### 8.1 Feature Flags

GrowthBook-powered feature gating:
```typescript
// Runtime feature flag evaluation
if (growthbook.isOn('voice_mode')) {
  // Voice mode code
}
```

### 8.2 Command Registry

Lazy-loaded command modules:
```typescript
const command = await import(`./commands/${name}`);
```

### 8.3 Tool Schema

Each tool exports a JSON Schema-compatible definition:
```typescript
export default {
  name: 'Bash',
  description: 'Execute shell commands',
  input_schema: { /* JSON Schema */ },
  async execute(input) { /* ... */ }
};
```

### 8.4 Multi-Provider LLM Routing

Unified provider abstraction supporting:
- Anthropic (direct API)
- AWS Bedrock
- GCP Vertex
- Azure OpenAI
- OpenAI-compatible (xAI, etc.)
- Custom endpoints via provider presets (`src/server/config/providerPresets.json`)

### 8.5 Permission Modes

```typescript
enum PermissionMode {
  Auto,      // Automatically approve safe operations
  Ask,       // Prompt user for each operation
  Deny,      // Deny all operations
}
```

### 8.6 Session Persistence

Multi-layer persistence:
- `~/.claude/projects/**/*.jsonl` — Session transcripts
- `~/.claude/settings.json` — Global settings
- `~/.claude/cc-haha/settings.json` — Desktop-specific settings
- `~/.claude/cc-haha/providers.json` — Provider configs
- Forward migrations required for any schema change

---

## 9. Build System

### 9.1 Root CLI

```bash
bun install
./bin/claude-haha        # Run CLI
bun run check:server     # Server tests
bun run check:policy     # Policy & workflow tests
bun run quality:pr       # Full PR quality gate
```

### 9.2 Desktop App

```bash
cd desktop
bun install
bun run dev              # Vite dev server
bun run build            # Production build
bun run test             # Vitest
bun run lint             # TypeScript check
cd src-tauri && cargo check  # Rust check
```

### 9.3 Adapters

```bash
cd adapters
bun install
bun run feishu           # Start Feishu adapter
bun run telegram         # Start Telegram adapter
bun test                 # Run adapter tests
```

### 9.4 Docs

```bash
npm ci
npm run docs:build       # VitePress build
```

---

## 10. Security Model

| Layer | Mechanism |
|-------|-----------|
| Tool Permissions | Explicit allow/deny per tool category |
| File Access | Sandboxed to project directory |
| Bash Execution | User approval for destructive commands |
| Auth | API key or OAuth (claude.ai, AWS Bedrock, GCP Vertex, OpenAI) |
| Bridge | JWT tokens, trusted device verification |
| IM Access | Permission cards, pairing tokens |
| Desktop | Gatekeeper (macOS), code signing |

---

## 11. Extension Points

| Extension | Mechanism |
|-----------|-----------|
| Plugins | `.claude-plugin/plugin.json` manifest |
| Skills | `src/skills/bundled/` or user directory |
| MCP Servers | Configured via `claude config` / desktop settings |
| Themes | `src/outputStyles/` |
| Custom Commands | Plugin-provided slash commands |
| IM Adapters | Modular adapter package (`adapters/`) |

---

## 12. Testing Strategy

| Test Type | Location | Framework |
|-----------|----------|-----------|
| Unit tests | `src/**/__tests__/` | Bun test runner |
| Desktop unit | `desktop/src/__tests__/` | Vitest + Testing Library |
| Server tests | `src/server/__tests__/` | Bun test runner |
| Adapter tests | `adapters/**/__tests__/` | Bun test runner |
| E2E / Smoke | `scripts/e2e-*` | Playwright (agent-browser) |
| Quality gates | `scripts/quality-gate/` | Custom TS scripts |

**Coverage practice:** 75-80%+ target for maintained areas; every changed executable line must meet the changed-line coverage gate (`scripts/quality-gate/coverage-thresholds.json`).

---

## 13. Notable Files for Reference

| File | Purpose |
|------|---------|
| `src/entrypoints/cli.tsx` | Main CLI entrypoint |
| `src/commands.ts` | Command registry |
| `src/tools/utils.ts` | Tool utilities |
| `src/bridge/bridgeMain.ts` | Bridge orchestration |
| `src/services/api/client.ts` | API client factory |
| `src/state/AppStateStore.ts` | State shape |
| `src/server/index.ts` | Local server bootstrap |
| `src/server/router.ts` | API router |
| `desktop/src/App.tsx` | Desktop React root |
| `desktop/src-tauri/src/main.rs` | Tauri entrypoint |
| `adapters/feishu/index.ts` | Feishu adapter |
| `bin/claude-haha` | Executable wrapper |
| `AGENTS.md` | Contributor guidelines |

---

## 14. Comparison with free-code and claw-code

| Dimension | free-code | claw-code | cc-haha |
|-----------|-----------|-----------|---------|
| **Language** | TypeScript (Bun) | Rust (workspace) | TypeScript (Bun) + Rust (Tauri) |
| **Origin** | Community "free build" | Open-source alternative | Leaked-source修复 |
| **UI** | Terminal only (Ink) | Terminal only (crossterm) | Terminal + Desktop + H5 Mobile |
| **Architecture** | Monolithic | 9-crate workspace | Monolithic + Adapters package |
| **Desktop** | No | No | Yes (Tauri + Vite + React) |
| **IM Integration** | No | No | Yes (Feishu/DingTalk/Telegram/WeChat) |
| **Local Server** | No | No | Yes (Bun HTTP + WebSocket) |
| **Feature Flags** | 88 compile-time flags | Minimal runtime config | GrowthBook runtime flags |
| **Bridge/Remote** | Full bridge mode | Not yet | Full bridge + H5 access |
| **Voice Mode** | Feature-gated | Not yet | Feature-gated |
| **Computer Use** | Yes | Not yet | Yes |
| **Scheduled Tasks** | Yes | Yes | Yes |
| **Distribution** | `bun build --compile` | `cargo build --release` | GitHub Releases (Tauri) |
| **Telemetry** | Optional / stripped | Minimal, opt-in | Optional (GrowthBook + custom) |
| **Test Framework** | Bun test | Cargo test | Bun test + Vitest |
| **Approx. LOC** | ~150K | ~51K | ~643K |

---

## 15. Version Tracking

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Based on Commit | `ae7e33c` |
| Commit Date | 2026-05-11 |
| Branch | main |
| Approx. LOC | ~643,500 (TS/TSX + Rust) |
| Commands | 112 |
| Tools | 59 |
| Services | 40+ |
| Next Review Trigger | When user requests update for new commit |

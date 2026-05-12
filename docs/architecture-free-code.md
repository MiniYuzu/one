# free-code Architecture Document

> **Project**: free-code (claude-code-source-snapshot)  
> **Version**: 2.1.87  
> **Commit**: `7dc15d6` (main branch HEAD at analysis time)  
> **Tech Stack**: TypeScript / Bun / React (Ink)  
> **Last Updated**: 2026-05-11  
> **Repository**: paoloanzn/free-code

---

## 1. Overview

free-code is a CLI AI coding assistant — a community-driven "free build" of Claude Code with telemetry stripped, guardrails removed, and experimental features unlocked. It is a monolithic Bun-based TypeScript application with a Terminal UI (TUI) built on React/Ink.

The architecture is command-driven and tool-augmented: the LLM orchestrates a loop where it emits "commands" (user-facing slash commands) and "tools" (file system, shell, search, MCP, etc.) to accomplish tasks.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Shell                           │
│                   (bash / zsh / fish)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Entrypoint: src/entrypoints/cli.tsx            │
│  - Fast-path parsing (--version, --help)                    │
│  - Feature-flag gated initialization                        │
│  - Dynamic imports for cold-start optimization              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐ ┌────▼─────┐
│   Commands   │ │  Bridge  │ │   Tools     │ │  Plugins │
│  (80+ /cmd)  │ │(Remote)  │ │  (40+ impl) │ │  (ext)   │
└───────┬──────┘ └────┬─────┘ └──────┬──────┘ └────┬─────┘
        │             │              │             │
        └─────────────┴──────┬───────┴─────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     Core Services Layer      │
              │  - API client (Anthropic/   │
              │    Bedrock/Vertex/OAuth)    │
              │  - Session state (Zustand-   │
              │    like store)              │
              │  - Permissions / Policy      │
              │  - MCP / LSP integration     │
              │  - Analytics (optional)      │
              │  - Cost tracking             │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     UI Layer (Ink/React)    │
              │  - Components / Screens      │
              │  - Prompt input              │
              │  - Message rendering         │
              │  - Diff / Code highlight     │
              └─────────────────────────────┘
```

---

## 3. Module Breakdown

### 3.1 Entrypoints (`src/entrypoints/`)

| File | Purpose |
|------|---------|
| `cli.tsx` | Main CLI bootstrap. Handles fast paths, feature flags, dynamic imports. |
| `init.ts` | Initialization sequence (auth, config, plugin loading). |
| `mcp.ts` | MCP (Model Context Protocol) server entrypoint. |
| `sandboxTypes.ts` | Sandbox runtime type definitions. |
| `sdk/` | SDK type exports for external consumers. |

### 3.2 Commands (`src/commands/`)

Each subdirectory is a self-contained slash command implementation (~80+ commands).

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
- `voice` — Voice mode (feature-gated)

**Command registration pattern:**
```typescript
// src/commands.ts
export default function registerCommands(app: App) {
  app.register('/login', loginCommand);
  app.register('/skills', skillsCommand);
  // ...
}
```

### 3.3 Tools (`src/tools/`)

40+ tools that the LLM can invoke. Each tool is self-contained with schema definition and execution logic.

**Core tools:**
- `BashTool` — Shell execution
- `FileReadTool`, `FileWriteTool`, `FileEditTool` — File operations
- `GlobTool`, `GrepTool` — Search
- `MCPTool` — MCP tool proxy
- `TaskCreateTool`, `TaskUpdateTool`, etc. — Task management
- `WebFetchTool`, `WebSearchTool` — Web access
- `SkillTool` — Skill invocation
- `AskUserQuestionTool` — User interaction

**Tool architecture pattern:**
```
ToolNameTool/
├── index.ts          # Tool definition & schema
├── execute.ts        # Execution logic
└── types.ts          # Type definitions
```

### 3.4 Bridge (`src/bridge/`)

Remote session bridge for cloud execution and multi-device support.

| Module | Purpose |
|--------|---------|
| `bridgeMain.ts` | Bridge lifecycle management |
| `bridgeApi.ts` | API client for bridge service |
| `bridgeConfig.ts` | Bridge configuration |
| `sessionRunner.ts` | Session spawning & management |
| `jwtUtils.ts` | Token refresh scheduling |
| `workSecret.ts` | Worker registration & secrets |
| `replBridge.ts` | REPL bridge transport |

### 3.5 Services (`src/services/`)

Business logic layer organized by domain.

| Service | Purpose |
|---------|---------|
| `api/` | LLM API client (Anthropic SDK, Bedrock, Vertex) |
| `analytics/` | Telemetry / event logging (optional) |
| `mcp/` | MCP server lifecycle |
| `lsp/` | Language Server Protocol integration |
| `plugins/` | Plugin registry & loading |
| `oauth/` | OAuth token management |
| `compact/` | Session compaction / summarization |
| `tools/` | Tool orchestration helpers |
| `SessionMemory/` | Session memory management |

### 3.6 State Management (`src/state/`)

React-based state management using a custom store pattern.

| File | Purpose |
|------|---------|
| `AppState.tsx` | React provider component |
| `AppStateStore.ts` | Core state shape & reducers |
| `store.ts` | Store factory (Zustand-like) |
| `selectors.ts` | State selectors |

### 3.7 UI Layer (`src/components/`, `src/screens/`)

Built with Ink (React for terminals).

**Key components:**
- `PromptInput` — Command input
- `messages/` — Message rendering
- `diff/` — Diff viewer
- `sandbox/` — Sandbox UI
- `skills/` — Skill UI
- `mcp/` — MCP UI

### 3.8 Context (`src/context/`)

React context providers for cross-cutting concerns:
- `mailbox.tsx` — Message queue
- `notifications.tsx` — Notifications
- `voice.tsx` — Voice state (feature-gated)
- `stats.tsx` — Stats overlay

### 3.9 Native Modules (`src/native-ts/`)

Optional native TypeScript modules:
- `file-index/` — Fast file indexing
- `color-diff/` — Color diff rendering
- `yoga-layout/` — Layout engine

---

## 4. Data Flow

### 4.1 Conversation Loop

```
User Input
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

### 4.2 Tool Execution Flow

```
LLM Response (tool_use)
    │
    ▼
┌──────────────────┐
│  Permission      │
│  Check           │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Allowed   Denied
    │         │
    ▼         ▼
 Execute   Prompt User
    │         │
    ▼         ▼
 Collect   Abort / Retry
 Result
    │
    ▼
 Send tool_result to LLM
```

---

## 5. Key Design Patterns

### 5.1 Feature Flags

88 compile-time feature flags using `bun:bundle` `feature()` macro:
```typescript
if (feature('VOICE_MODE')) {
  // Voice mode code — DCE'd if flag disabled
}
```

### 5.2 Command Registry

Lazy-loaded command modules:
```typescript
const command = await import(`./commands/${name}`);
```

### 5.3 Tool Schema

Each tool exports a JSON Schema-compatible definition:
```typescript
export default {
  name: 'Bash',
  description: 'Execute shell commands',
  input_schema: { /* JSON Schema */ },
  async execute(input) { /* ... */ }
};
```

### 5.4 Bridge Pattern

Remote sessions use a WebSocket/long-polling bridge:
```
Local CLI ◄──► Bridge API ◄──► Claude.ai / Remote Worker
```

---

## 6. Dependencies

### 6.1 Core Runtime
- **Bun** (>=1.3.11) — Runtime & bundler
- **React** + **Ink** — TUI framework
- **@anthropic-ai/sdk** — Anthropic API client

### 6.2 Optional / Feature-Gated
- **@anthropic-ai/mcpb** — MCP protocol
- **@opentelemetry/*** — Observability
- **@growthbook/growthbook** — Feature gating
- Native audio modules (voice)

### 6.3 Build System
- `scripts/build.ts` — Custom Bun build script
- Supports `--dev`, `--compile`, `--feature-set=dev-full`

---

## 7. Security Model

| Layer | Mechanism |
|-------|-----------|
| Tool Permissions | Explicit allow/deny per tool category |
| File Access | Sandboxed to project directory |
| Bash Execution | User approval for destructive commands |
| Auth | API key or OAuth (claude.ai, AWS Bedrock, GCP Vertex) |
| Bridge | JWT tokens, trusted device verification |

---

## 8. Extension Points

| Extension | Mechanism |
|-----------|-----------|
| Plugins | `.claude-plugin/plugin.json` manifest |
| Skills | `src/skills/bundled/` or user directory |
| MCP Servers | Configured via `claude config` |
| Themes | `src/outputStyles/` |
| Custom Commands | Plugin-provided slash commands |

---

## 9. Notable Files for Reference

| File | Purpose |
|------|---------|
| `src/entrypoints/cli.tsx` | Main entrypoint |
| `src/commands.ts` | Command registry |
| `src/tools/utils.ts` | Tool utilities |
| `src/bridge/bridgeMain.ts` | Bridge orchestration |
| `src/services/api/client.ts` | API client factory |
| `src/state/AppStateStore.ts` | State shape |
| `FEATURES.md` | Feature flag audit |
| `scripts/build.ts` | Build pipeline |

---

## 10. Version Tracking

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Based on Commit | `7dc15d6` |
| Commit Date | 2026-04-15 approx |
| Branch | main |
| Next Review Trigger | When user requests update for new commit |

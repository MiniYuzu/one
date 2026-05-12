# claw-code Architecture Document

> **Project**: claw-code (claw CLI)  
> **Version**: 0.1.0  
> **Commit**: `0e5f695` (main branch HEAD at analysis time)  
> **Tech Stack**: Rust (workspace) + Python (archival placeholders)  
> **Last Updated**: 2026-05-11  
> **Repository**: ultraworkers/claw-code

---

## 1. Overview

claw-code is the public Rust implementation of the `claw` CLI agent harness — an open-source alternative to Claude Code. It is structured as a Rust workspace with 9 crates, plus a Python porting workspace that serves as an archived reference of the original TypeScript source.

The architecture follows a layered design: the CLI binary orchestrates the conversation loop, delegating to specialized crates for API communication, command routing, tool execution, plugin management, and runtime state.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Shell                           │
│                   (bash / zsh / fish)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│    Binary: rust/crates/rusty-claude-cli/src/main.rs         │
│    (claw command)                                           │
│  - Argument parsing (structopt/clap-style)                  │
│  - Auth resolution                                          │
│  - TUI initialization (crossterm/rustyline)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        │              │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐ ┌────▼─────┐
│  commands    │ │   api    │ │   tools     │ │  plugins │
│  (registry)  │ │(provider │ │ (executor)  │ │ (manager) │
│              │ │abstraction│ │             │ │           │
└───────┬──────┘ └────┬─────┘ └──────┬──────┘ └────┬─────┘
        │             │              │             │
        └─────────────┴──────┬───────┴─────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     runtime (core)          │
              │  - Session persistence      │
              │  - Conversation loop        │
              │  - Permission evaluation    │
              │  - Prompt assembly          │
              │  - MCP plumbing             │
              │  - File operations          │
              │  - Git context              │
              │  - Compaction / summary     │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │        telemetry            │
              │  - Event logging            │
              └─────────────────────────────┘
```

---

## 3. Crate Breakdown

### 3.1 `rusty-claude-cli` — CLI Binary Entrypoint

**Path**: `rust/crates/rusty-claude-cli/`

| Module | Purpose |
|--------|---------|
| `main.rs` | CLI argument parsing, main event loop, TUI renderer integration |
| `init.rs` | Repository initialization, config loading |
| `input.rs` | User input handling (readline, keybindings) |
| `render.rs` | Terminal rendering (Markdown stream, spinner, syntax highlighting via syntect) |

**Key dependencies**: `runtime`, `api`, `commands`, `tools`, `plugins`, `compat-harness`

**Binary name**: `claw`

### 3.2 `runtime` — Core Runtime Primitives

**Path**: `rust/crates/runtime/`

The heart of the system. Owns session persistence, permission evaluation, prompt assembly, MCP plumbing, tool-facing file operations, and the core conversation loop.

| Module | Purpose |
|--------|---------|
| `session.rs` | Session persistence, state management |
| `conversation.rs` | Core conversation turn loop |
| `permissions.rs` | Permission policy evaluation |
| `permission_enforcer.rs` | Runtime permission enforcement |
| `bash.rs` / `bash_validation.rs` | Bash command execution & validation |
| `file_ops.rs` | File read/write/edit operations |
| `git_context.rs` | Git repository context extraction |
| `compact.rs` | Session compaction / summarization |
| `mcp.rs` / `mcp_tool_bridge.rs` | MCP server lifecycle & tool bridging |
| `mcp_lifecycle_hardened.rs` | Hardened MCP lifecycle management |
| `lsp_client.rs` | LSP client integration |
| `config.rs` | Configuration loading & validation |
| `hooks.rs` | Plugin hook system |
| `prompt.rs` | System prompt assembly |
| `recovery_recipes.rs` | Error recovery patterns |
| `task_registry.rs` | Background task registry |
| `team_cron_registry.rs` | Team & cron job management |
| `worker_boot.rs` | Worker initialization |

**Exports**:
```rust
pub use bash::{execute_bash, BashCommandInput, BashCommandOutput};
pub use compact::{compact_session, CompactionConfig, CompactionResult};
pub use config::{ConfigEntry, ConfigError, ConfigLoader, ConfigSource};
pub use session_control::SessionStore;
// ... and many more
```

### 3.3 `api` — LLM API Abstraction

**Path**: `rust/crates/api/`

Abstracts multiple LLM providers behind a unified client interface.

| Module | Purpose |
|--------|---------|
| `client.rs` | Unified provider client |
| `providers/anthropic.rs` | Anthropic API client (native + Bedrock + Vertex) |
| `providers/openai_compat.rs` | OpenAI-compatible provider adapter |
| `http_client.rs` | HTTP client builder with proxy support |
| `sse.rs` | Server-Sent Events parsing |
| `prompt_cache.rs` | Prompt caching optimization |
| `types.rs` | Shared API types (messages, content blocks, tool definitions) |
| `error.rs` | API error types |

**Provider support**:
- Anthropic (direct API)
- AWS Bedrock
- GCP Vertex
- OpenAI-compatible (xAI, etc.)

### 3.4 `commands` — Command Registry

**Path**: `rust/crates/commands/`

Slash command definitions, parsing, and dispatch.

| Module | Purpose |
|--------|---------|
| `lib.rs` | Command registry, `CommandManifestEntry`, `CommandRegistry` |
| `SlashCommandSpec` | Metadata for each slash command (name, aliases, summary) |

**Built-in slash commands** (excerpt from `SLASH_COMMAND_SPECS`):
- `/help` — Help system
- `/config` — Configuration
- `/compact` — Session compaction
- `/cost` — Cost tracking
- `/doctor` — Health checks
- `/login`, `/logout` — Authentication
- `/skills` — Skill management
- `/mcp` — MCP server management
- `/tasks` — Task management

**Skill dispatch modes**:
- `Local` — Execute locally
- `Invoke(String)` — Invoke named skill

### 3.5 `tools` — Tool Execution Engine

**Path**: `rust/crates/tools/`

Tool registry and execution logic. Bridges runtime primitives to the LLM tool-use protocol.

| Module | Purpose |
|--------|---------|
| `lib.rs` | Global tool registry, `execute_tool()`, `mvp_tool_specs()` |
| `GlobalToolRegistry` | Thread-safe tool registry (lazy_static/OnceLock) |
| `RuntimeToolDefinition` | Tool schema + executor binding |

**Supported tool categories**:
- File operations (read, write, edit, glob, grep)
- Bash execution
- LSP queries
- MCP tool proxy
- Task management
- Web fetch

**Global registries** (OnceLock pattern):
```rust
fn global_lsp_registry() -> &'static LspRegistry;
fn global_mcp_registry() -> &'static McpToolRegistry;
fn global_team_registry() -> &'static TeamRegistry;
```

### 3.6 `plugins` — Plugin Management

**Path**: `rust/crates/plugins/`

Plugin lifecycle management with minimal dependencies.

| Type | Description |
|------|-------------|
| `PluginKind::Builtin` | Built-in plugins |
| `PluginKind::Bundled` | Shipped with the binary |
| `PluginKind::External` | User-installed from marketplace |

**Key structures**:
- `PluginManager` — Loading, enabling, disabling
- `PluginRegistry` — Discovery & lookup
- `HookRunner` — Hook execution

### 3.7 `telemetry` — Observability

**Path**: `rust/crates/telemetry/`

Minimal event logging. Decoupled from other crates.

| Type | Description |
|------|-------------|
| `AnalyticsEvent` | Structured event |
| `JsonlTelemetrySink` | Append-only JSONL logging |
| `ClientIdentity` | Anonymous client identification |

### 3.8 `compat-harness` — Compatibility Testing

**Path**: `rust/crates/compat-harness/`

Mock parity harness for validating Rust implementation against original behavior.

**Usage**:
```bash
cd rust/
cargo test -p compat-harness
```

### 3.9 `mock-anthropic-service` — Test Fixture

**Path**: `rust/crates/mock-anthropic-service/`

Deterministic mock Anthropic-compatible API server for testing.

---

## 4. Python Porting Workspace (`src/`)

The top-level `src/` directory contains Python placeholder modules that mirror the original TypeScript source structure. These serve as an **archival reference** and are not the canonical implementation.

| File | Purpose |
|------|---------|
| `main.py` | CLI argument parser (introspection tool) |
| `commands.py` | Mirrored command inventory |
| `tools.py` | Mirrored tool inventory |
| `bootstrap_graph.py` | Bootstrap stage visualization |
| `command_graph.py` | Command dependency graph |
| `parity_audit.py` | Compare Python vs archived TS |
| `runtime.py` | Runtime stub |

**All `__init__.py` files use `_archive_helper`** to load archived metadata:
```python
from src._archive_helper import load_archive_metadata
_SNAPSHOT = load_archive_metadata("subsystem_name")
```

---

## 5. Data Flow

### 5.1 Conversation Turn Loop (Rust)

```
User Input
    │
    ▼
┌─────────────────┐
│ Input Parser    │  (rustyline / crossterm)
│ (main.rs)       │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
  /slash    Raw query
  command
    │         │
    ▼         ▼
┌────────┐  ┌─────────────────────┐
│Command │  │ Build API Request   │
│Handler │  │ - Load system prompt│
│        │  │ - Assemble history  │
└────────┘  │ - Attach tool defs  │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │   api::ProviderClient│
            │   Stream Response    │
            └──────────┬──────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    Text Delta   Tool Use      Stop Reason
         │             │             │
         ▼             ▼             ▼
    Render to    Execute Tool   Update Session
    Terminal     (tools crate)   (runtime)
         │             │             │
         └─────────────┴─────────────┘
                       │
                       ▼
                Next Turn
```

### 5.2 Tool Execution Flow

```
LLM emits tool_use block
    │
    ▼
┌─────────────────────────┐
│ permission_enforcer     │
│ - Check policy          │
│ - Evaluate mode         │
│ (runtime crate)         │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
 Allowed          Denied
    │               │
    ▼               ▼
┌─────────┐   ┌─────────────┐
│ tools:: │   │ Render deny │
 │execute_ │   │ to user     │
 │tool()   │   └─────────────┘
└────┬────┘
     │
     ▼
┌─────────────┐
│ Collect     │
│ result      │
└──────┬──────┘
       │
       ▼
Send tool_result to LLM
```

---

## 6. Key Design Patterns

### 6.1 Workspace Architecture

```toml
# rust/Cargo.toml
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.lints.rust]
unsafe_code = "forbid"
```

### 6.2 Provider Abstraction

```rust
// api/src/client.rs
pub trait ProviderClient {
    async fn stream_messages(
        &self,
        request: MessageRequest,
    ) -> Result<MessageStream, ApiError>;
}

// Implementations: AnthropicClient, OpenAiCompatClient
```

### 6.3 Permission Modes

```rust
// runtime/src/permissions.rs
pub enum PermissionMode {
    Auto,      // Automatically approve safe operations
    Ask,       // Prompt user for each operation
    Deny,      // Deny all operations
}
```

### 6.4 Session Store

```rust
// runtime/src/session_control.rs
pub struct SessionStore {
    // Persistent session state
}

impl SessionStore {
    pub fn load(path: &Path) -> Result<Self, RuntimeError>;
    pub fn save(&self) -> Result<(), RuntimeError>;
}
```

### 6.5 Task Registry (Background Tasks)

```rust
// runtime/src/task_registry.rs
pub struct TaskRegistry {
    // Manages async background tasks
}
```

---

## 7. Build System

### 7.1 Rust Build

```bash
cd rust/
cargo build --release         # Release binary: target/release/claw
cargo test                    # Run tests
cargo test -p compat-harness  # Parity harness
```

### 7.2 Features

The Rust workspace does not use feature flags extensively (unlike free-code). Instead, it favors compile-time lints and workspace-level settings:

```toml
[workspace.lints.clippy]
all = { level = "warn", priority = -1 }
pedantic = { level = "warn", priority = -1 }
```

### 7.3 Python Workspace (Introspection Only)

```bash
python -m src.main summary      # Markdown summary
python -m src.main parity-audit # Compare with TS archive
python -m src.main commands     # List mirrored commands
python -m src.main tools        # List mirrored tools
```

---

## 8. Security Model

| Layer | Mechanism |
|-------|-----------|
| Tool Permissions | `PermissionPolicy` + `PermissionEnforcer` |
| File Sandbox | `sandbox.rs` — Restricted file operations |
| Bash Validation | `bash_validation.rs` — Dangerous command detection |
| Auth | API keys or OAuth (via `api` crate) |
| Config Validation | `config_validate.rs` |

---

## 9. Testing Strategy

| Test Type | Location | Description |
|-----------|----------|-------------|
| Unit tests | Each crate's `#[cfg(test)]` modules | Component-level testing |
| Mock parity harness | `rust/crates/rusty-claude-cli/tests/mock_parity_harness.rs` | Behavioral parity validation |
| Mock service | `rust/crates/mock-anthropic-service/` | Deterministic API mock |
| Compatibility diff | `rust/scripts/run_mock_parity_diff.py` | Automated parity checking |

**Parity milestones achieved** (9-lane checkpoint):
1. Bash validation
2. CI fix / Sandbox
3. File-tool operations
4. TaskRegistry
5. Task wiring
6. Team + Cron
7. MCP lifecycle
8. LSP client
9. Permission enforcement

---

## 10. Notable Files for Reference

| File | Purpose |
|------|---------|
| `rust/crates/rusty-claude-cli/src/main.rs` | CLI entrypoint |
| `rust/crates/runtime/src/lib.rs` | Runtime exports |
| `rust/crates/runtime/src/conversation.rs` | Conversation loop |
| `rust/crates/api/src/lib.rs` | API client exports |
| `rust/crates/commands/src/lib.rs` | Command registry |
| `rust/crates/tools/src/lib.rs` | Tool execution |
| `rust/crates/plugins/src/lib.rs` | Plugin manager |
| `PARITY.md` | Parity status |
| `USAGE.md` | Build & usage guide |
| `ROADMAP.md` | Future roadmap |

---

## 11. Comparison with free-code

| Dimension | free-code | claw-code |
|-----------|-----------|-----------|
| **Language** | TypeScript (Bun) | Rust |
| **Architecture** | Monolithic | Workspace (9 crates) |
| **UI Framework** | React + Ink | crossterm + rustyline |
| **Feature Flags** | 88 compile-time flags | Minimal — runtime config |
| **Plugin System** | `.claude-plugin/` manifest | `PluginManager` registry |
| **MCP Support** | Full (TypeScript SDK) | Full (`mcp_tool_bridge.rs`) |
| **LSP Support** | Full | Full (`lsp_client.rs`) |
| **Bridge/Remote** | Full bridge mode | Not yet implemented |
| **Voice Mode** | Feature-gated | Not yet implemented |
| **Distribution** | `bun build --compile` | `cargo build --release` |
| **Telemetry** | Optional / stripped | Minimal, opt-in |
| **Parity Harness** | N/A | Mock parity harness |

---

## 12. Version Tracking

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Based on Commit | `0e5f695` |
| Commit Date | 2026-05-08 approx |
| Branch | main |
| Rust LOC | ~48,599 tracked |
| Test LOC | ~2,568 |
| Next Review Trigger | When user requests update for new commit |

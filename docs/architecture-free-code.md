# free-code (Claude Code CLI) 完整架构分析

> 生成日期: 2026-05-13
> 版本: 2.1.87
> 分析范围: `src/` 目录下所有模块

---

## 1. 项目概述

**free-code** 是 Anthropic Claude Code CLI 的一个可构建分支，基于 Bun 运行时 + TypeScript + React(Ink) 构建的终端原生 AI 编码代理。核心定位是：用户在终端中与 Claude 对话，Claude 通过调用工具（Bash、Read、Edit、Write 等）来执行实际的软件开发任务。

### 1.1 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Bun >= 1.3.11 |
| 语言 | TypeScript 6.x |
| 终端 UI | React 19 + Ink 6.8 |
| CLI 解析 | Commander.js |
| 模式验证 | Zod v4 |
| 代码搜索 | ripgrep (内嵌) |
| 协议 | MCP、LSP |
| API | Anthropic Messages、OpenAI Codex、AWS Bedrock、Google Vertex AI、Anthropic Foundry |

### 1.2 顶层架构（ASCII）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层 (TUI)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ REPL.tsx    │  │ components/ │  │ hooks/      │  │ keybindings/        │ │
│  │ (主循环)     │  │ (Ink组件)   │  │ (React Hooks)│  │ (快捷键系统)        │ │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────┼───────────────────────────────────────────────────────────────────┤
│         │                        命令路由层                                   │
│  ┌──────┴──────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │ commands.ts │  │ commands/   │  │ skills/     │                          │
│  │ (注册表)     │  │ (slash命令) │  │ (技能系统)   │                          │
│  └──────┬──────┘  └─────────────┘  └─────────────┘                          │
├─────────┼───────────────────────────────────────────────────────────────────┤
│         │                        查询引擎层                                   │
│  ┌──────┴──────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │ QueryEngine │  │ query.ts    │  │ tools.ts    │                          │
│  │ (协调器)     │  │ (核心查询)   │  │ (工具注册表) │                          │
│  └──────┬──────┘  └─────────────┘  └─────────────┘                          │
├─────────┼───────────────────────────────────────────────────────────────────┤
│         │                        工具执行层                                   │
│  ┌──────┴──────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ tools/      │  │ tasks/      │  │ plugins/    │  │ bridge/             │ │
│  │ (Bash/Edit) │  │ (后台任务)   │  │ (插件系统)   │  │ (IDE桥接)           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                              服务与基础设施层                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ services/   │  │ state/      │  │ utils/      │  │ types/              │ │
│  │ (API/MCP)   │  │ (状态管理)   │  │ (工具函数)   │  │ (类型定义)          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. src/ 目录完整模块分析

### 2.1 src/entrypoints — 入口点

**Purpose:** CLI 启动入口和 SDK 入口，负责最小化加载、快速路径判断、环境初始化。

**Key files:**
- `cli.tsx` — 主 CLI 入口。处理 `--version`、 `--dump-system-prompt`、 `--claude-in-chrome-mcp`、 `--chrome-native-host` 等快速路径。动态导入其余模块以减少启动时间。
- `sdk/` — SDK 入口，支持将 Claude Code 作为库嵌入其他应用。

**Notable patterns:**
- 使用动态导入 (`await import(...)`) 实现快速路径零加载。
- 通过 `bun:bundle` 的 `feature()` 宏进行编译时死代码消除 (DCE)。
- 顶层设置 `COREPACK_ENABLE_AUTO_PIN=0`、远程模式下的 `NODE_OPTIONS` 堆大小限制。

---

### 2.2 src/cli — CLI 解析与执行

**Purpose:** Commander.js 的 CLI 参数解析、子命令处理、传输层抽象。

**Subdirectories:**
- `handlers/` — CLI 参数处理逻辑
- `transports/` — 不同传输协议的实现（stdio、SSE、WebSocket 等）

**Functionality:**
- 将用户的命令行输入解析为内部数据结构。
- 支持 `--remote`、 `--model`、 `--dev` 等全局标志。
- 管理非交互式模式 (`-p` 一次性查询)。

---

### 2.3 src/commands — Slash 命令实现（~100+ 命令）

**Purpose:** 实现所有以 `/` 开头的用户命令，如 `/login`、 `/model`、 `/compact`、 `/plan` 等。

**命令分组（按功能）:**

#### 认证与会话管理
- `login/`、 `logout/`、 `oauth-refresh/` — OAuth 登录/登出/刷新
- `session/` — 会话管理
- `resume/` — 恢复会话

#### 模型与配置
- `model/` — 切换模型
- `config/` — 配置管理
- `env/` — 环境变量
- `output-style/` — 输出样式
- `theme/`、 `color/` — 主题和颜色
- `fast/` — Fast 模式
- `effort/` — 努力级别

#### 代码与 Git 操作
- `diff/` — 查看 diff
- `branch/` — 分支操作
- `commit.js`、 `commit-push-pr.js` — 提交相关（内部命令）
- `review.js` — 代码审查
- `autofix-pr/` — PR 自动修复

#### 上下文与压缩
- `compact/` — 上下文压缩
- `context/` — 上下文管理
- `ctx_viz/` — 上下文可视化
- `memory/` — 内存/记忆管理

#### 工具与基础设施
- `mcp/` — MCP 服务器管理
- `skills/` — 技能管理
- `tasks/` — 任务管理
- `hooks/` — Hooks 管理
- `plugins/`、 `reload-plugins/` — 插件管理

#### 远程与桥接
- `bridge/` — IDE 桥接（BRIDGE_MODE）
- `remote-setup/` — 远程设置
- `teleport/` — 会话传送

#### 诊断与调试
- `doctor/` — 诊断
- `debug-tool-call/` — 调试工具调用
- `bughunter/` — Bug 追踪
- `ant-trace/`、 `perf-issue/` — 性能追踪（内部）

#### 实验性功能（Feature-flagged）
- `voice/` — 语音模式（VOICE_MODE）
- `proactive.js` — 主动模式（PROACTIVE/KAIROS）
- `ultraplan.js` — 超级计划（ULTRAPLAN）
- `buddy/` — Buddy 伴侣（BUDDY）
- `assistant/` — 助手模式（KAIROS）

**Command 类型系统（`src/types/command.ts`）:**
- `PromptCommand` — 展开为提示文本发送给模型
- `LocalCommand` — 本地执行，返回文本结果
- `LocalJSXCommand` — 本地执行，渲染 Ink UI

---

### 2.4 src/query — 查询引擎

**Purpose:** 与 LLM API 交互的核心查询循环，管理消息流、工具调用、重试、错误处理。

**Key files:**
- `query.ts` — 核心查询函数，处理单次 API 调用
- `QueryEngine.ts` — 查询引擎协调器，管理多轮对话、工具执行循环

**Functionality:**
- 构建 API 请求（system prompt + messages + tools）
- 流式处理 API 响应（SSE）
- 工具使用解析和分发
- 自动重试、退避、错误分类
- Token 计数和预算管理
- 上下文压缩触发

**Sub-files (架构细分):**
- `config.ts` — 查询配置快照。`buildQueryConfig()` 在 `query()` 入口一次性捕获不可变配置：
  - `sessionId`、Statsig feature gates（streamingToolExecution、fastModeEnabled）
  - 故意排除 `feature()` 编译时标志（DCE 边界必须保持内联）
- `deps.ts` — 依赖注入容器。`QueryDeps` 类型将 I/O 依赖（`callModel`、`autocompact`、`microcompact`、`uuid`）提取为接口，测试可直接注入 fake，无需按模块 spy。
- `stopHooks.ts` — Stop Hook 处理器。在对话轮次结束时执行：
  - `handleStopHooks()` — 生成器函数，产出 StreamEvent / Message / ToolUseSummaryMessage
  - 调用记忆提取（`EXTRACT_MEMORIES`）、自动 Dream（`autoDream`）、Prompt Suggestion、任务完成 hook、队友空闲 hook
  - 返回 `StopHookResult`（blocking errors + prevent continuation 标志）
- `tokenBudget.ts` — Token 预算跟踪器。
  - `createBudgetTracker()` — 创建预算状态（continuation count、last delta tokens、start time）
  - `checkTokenBudget()` — 基于预算阈值决定 `continue`（附带 nudge message）或 `stop`（附带 completion event）
  - 支持 diminishing returns 检测（连续 3+ 次续写且增量低于阈值时触发）

**Notable patterns:**
- `QueryEngine` 是状态机，管理 `idle` -> `querying` -> `tool_use` -> `tool_result` -> `idle` 循环
- 支持 speculative execution（预执行提示建议）
- `config.ts` + `deps.ts` 将 query() 向纯 reducer 演进：`(state, event, config, deps)`

---

### 2.5 src/tools — 工具实现

**Purpose:** Claude 可调用的所有工具的完整实现。每个工具是一个独立的目录，包含工具定义、提示词、执行逻辑和 UI。

**核心工具:**

| 工具 | 目录 | 功能 |
|------|------|------|
| BashTool | `BashTool/` | 执行 shell 命令，支持 sandbox 模式 |
| FileReadTool | `FileReadTool/` | 读取文件内容 |
| FileEditTool | `FileEditTool/` | 编辑文件（基于 diff） |
| FileWriteTool | `FileWriteTool/` | 写入文件 |
| GlobTool | `GlobTool/` | 文件搜索（glob 模式） |
| GrepTool | `GrepTool/` | 文本搜索（ripgrep 包装） |
| WebFetchTool | `WebFetchTool/` | 获取网页内容 |
| WebSearchTool | `WebSearchTool/` | 网络搜索 |
| NotebookEditTool | `NotebookEditTool/` | Jupyter Notebook 编辑 |
| TaskCreateTool | `TaskCreateTool/` | 创建任务（Todo V2） |
| TaskGet/List/Update/Stop | `Task*Tool/` | 任务管理工具 |
| AgentTool | `AgentTool/` | 创建子代理（Agent） |
| SkillTool | `SkillTool/` | 调用技能 |
| AskUserQuestionTool | `AskUserQuestionTool/` | 向用户提问 |
| EnterPlanModeTool | `EnterPlanModeTool/` | 进入计划模式 |
| ExitPlanModeTool | `ExitPlanModeTool/` | 退出计划模式 |
| EnterWorktreeTool | `EnterWorktreeTool/` | 进入 git worktree |
| ExitWorktreeTool | `ExitWorktreeTool/` | 退出 git worktree |
| LSPTool | `LSPTool/` | LSP 服务器交互 |
| MCPTool | `MCPTool/` | MCP 工具包装 |
| SendMessageTool | `SendMessageTool/` | 发送消息（Swarm 通信） |
| TodoWriteTool | `TodoWriteTool/` | 写入待办事项 |
| TungstenTool | `TungstenTool/` | 内部测试工具 |
| REPLTool | `REPLTool/` | REPL 模式（内部） |
| WorkflowTool | `WorkflowTool/` | 工作流脚本 |

**AgentTool 详细分析:**
- 最核心的工具，允许 Claude 创建子代理执行独立任务
- 支持多种 Agent 类型：`general-purpose`、 `explore`、 `code`、 `test` 等
- 实现两种执行模式：
  - **Inline**: 在同一上下文中执行
  - **Fork**: 在独立进程/worktree 中执行
- 支持 teammate/swarm 模式：多代理协作
- 内置代理定义在 `AgentTool/built-in/` 目录

**工具注册:**
- `src/tools.ts` 是所有工具的中央注册表
- 使用 `feature('FLAG')` 进行编译时条件导入
- `getTools()` 根据权限上下文过滤可用工具
- `assembleToolPool()` 合并内置工具和 MCP 工具

---

### 2.6 src/tasks — 后台任务管理

**Purpose:** 实现 Claude Code 的完整后台任务执行系统。任务是异步工作单元（shell 命令、本地 Agent、远程 Agent、工作流等），与主会话并发运行。

**Task 类型（`src/Task.ts`）:**
- `local_bash` — 本地 shell 命令
- `local_agent` — 本地后台 Agent
- `remote_agent` — 远程 Agent（teleport 到云端）
- `in_process_teammate` — 同进程队友（AsyncLocalStorage 隔离）
- `local_workflow` — 本地工作流
- `monitor_mcp` — MCP 监控
- `dream` — 自动梦境（记忆整合）

**Task 状态机:**
- `pending` → `running` → `completed` / `failed` / `killed`
- `isTerminalTaskStatus()` 判断任务是否已终止

**实现目录:**

#### `src/tasks/LocalAgentTask/` — 本地后台 Agent 执行
- `LocalAgentTask.tsx` — 核心实现。定义 `AgentProgress`、`ProgressTracker`、`ToolActivity` 类型
  - `killAsyncAgent()` — 发送 abort signal
  - `updateAgentProgress()` — 计算 token 计数和工具使用
  - `enqueueAgentNotification()` — 格式化 XML 任务通知
  - `runAsyncAgentLifecycle()` — 主执行循环
  - 使用 `AsyncLocalStorage` 进行 Agent 上下文隔离
- `useLocalAgentTask.ts` — React hook 管理本地 Agent 任务 UI 状态

#### `src/tasks/LocalShellTask/` — Shell 命令执行
- `LocalShellTask.tsx` — 带 stall 检测和监控模式支持的 shell 任务
  - `looksLikePrompt()` — 使用正则启发式检测交互式提示（如密码提示）
  - `startStallWatchdog()` — 命令超过阈值无输出时触发通知
  - 支持一次性命令和持久监控 shell
- `guards.ts` — 区分一次性 vs 监控的 `LocalShellTaskState` 变体的类型守卫

#### `src/tasks/RemoteAgentTask/` — 远程 Agent 轮询
- `RemoteAgentTask.tsx` — 定义 `RemoteAgentTaskState`，支持 ultraplan 阶段（`plan_ready`、`needs_input`）
  - `registerCompletionChecker()` — 允许可扩展的远程任务类型
  - 轮询远程状态并相应转换状态

#### `src/tasks/InProcessTeammateTask/` — 同进程队友
- `InProcessTeammateTask.tsx` — 使用 `AsyncLocalStorage` 上下文隔离
  - `requestTeammateShutdown()` — 请求队友关闭
  - `appendTeammateMessage()` — 向队友对话历史追加消息
  - `injectUserMessageToTeammate()` — 注入用户消息到队友
- `types.ts` — `InProcessTeammateTaskState` 定义

#### `src/tasks/DreamTask/` — 自动记忆整合
- `DreamTask.ts` — `DreamTaskState`，`addDreamTurn()` 上限 `MAX_TURNS = 30`
- 管理后台记忆整合生命周期

#### `src/tasks/LocalWorkflowTask/` — 工作流执行
- `LocalWorkflowTask.tsx` — `LocalWorkflowTaskState`，含 `workflowName` 和 `workflowProgress`
- 管理工作流生命周期和子任务协调

#### `src/tasks/MonitorMcpTask/` — MCP 监控
- `MonitorMcpTask.tsx` — MCP 服务器监控任务

#### `src/utils/task/` — 任务框架基础设施
- `framework.ts` — 核心框架函数：
  - `registerTask()` — 注册任务
  - `updateTaskState()` — 更新任务状态
  - `evictTerminalTask()` — 驱逐已终止任务
  - `getRunningTasks()` — 获取运行中任务
  - `pollTasks()` — 轮询任务
  - 定义 `POLL_INTERVAL_MS = 1000`, `STOPPED_DISPLAY_MS = 3000`, `PANEL_GRACE_MS = 30000`
  - XML 任务通知格式化（`<task_notification>`, `<task_id>`, `<status>`）
- `diskOutput.ts` — `DiskTaskOutput` 类：
  - 异步磁盘写入，带平面队列和 drain 循环，避免 Promise 闭包链导致的内存驻留
  - `MAX_TASK_OUTPUT_BYTES = 5GB`
  - 安全：使用 `O_NOFOLLOW` 防止符号链接攻击
  - 函数：`appendTaskOutput()`, `flushTaskOutput()`, `getTaskOutput()`, `getTaskOutputDelta()`, `cleanupTaskOutput()`
- `sdkProgress.ts` — `emitTaskProgress()`：发出 `task_progress` SDK 事件，计算 `duration_ms`

**Notable patterns:**
- 不可变状态更新通过 `setAppState` updater 函数
- `outputOffset` 追踪增量输出交付，无需重新读取完整文件
- 终端任务驱逐带宽限期（`evictAfter`）保证 UI 稳定性
- 安全文件操作：`O_NOFOLLOW`, `O_EXCL`
- `AsyncLocalStorage` 广泛用于并发任务间的上下文隔离

---

### 2.7 src/components — 终端 UI 组件（Ink/React）

**Purpose:** 基于 Ink（React for terminals）的 UI 组件库。这是整个项目中最大的代码集合，包含 200+ 组件文件。

**核心架构特点:**
- 使用 **React Compiler Runtime** (`import { c as _c } from "react/compiler-runtime"`) 进行自动 memoization
- **自定义 Ink 渲染框架** (`src/ink/`)：自定义 React reconciler、Yoga 布局引擎、双缓冲屏幕输出、视口裁剪
- **特性标志条件编译**: 大量使用 `feature('...')` 进行编译时 DCE

**组件分组:**

#### 应用外壳与消息渲染
- `App.tsx` — 顶层 Provider 包装（FpsMetricsProvider、StatsProvider、AppStateProvider）
- `FullscreenLayout.tsx` — 终端布局：可滚动内容区、底部固定区（prompt/spinner/permissions）、overlay、modal slot、浮动内容。实现 "N new messages" pill 和 sticky prompt 追踪
- `Message.tsx` — 消息路由组件，根据消息类型分发到具体渲染器
- `Messages.tsx` — 消息列表管理器：消息规范化、分组、重排序、折叠（后台 bash、hook 摘要、read/search 分组、teammate shutdown）
- `VirtualMessageList.tsx` — 虚拟化消息列表，支持 sticky header、搜索导航 (`JumpHandle`)、滚动锚定

#### 消息类型渲染器 (`messages/`)
- `AssistantTextMessage.tsx` — 助手文本消息，处理大量特殊错误消息（rate limit、API error、invalid key、org disabled 等）
- `AssistantThinkingMessage.tsx` / `AssistantRedactedThinkingMessage.tsx` — Thinking 块渲染
- `UserPromptMessage.tsx` — 用户提示消息，大输入截断策略（head+tail，MAX_DISPLAY_CHARS=10,000）
- `UserToolResultMessage/` — 工具结果消息路由（canceled/rejected/error/success）
- `AttachmentMessage.tsx`、 `CompactBoundaryMessage.tsx`、 `CollapsedReadSearchContent.tsx` — 特殊消息类型
- `AdvisorMessage.tsx`、 `TaskAssignmentMessage.tsx`、 `ShutdownMessage.tsx` — Agent/swarm 相关消息
- `nullRenderingAttachments.ts` — 决定哪些附件不渲染

#### 设计系统 (`design-system/`)
- `Pane.tsx` — 终端区域容器，彩色顶线边框
- `Dialog.tsx` — 确认/取消对话框，内置快捷键（Esc/n, Ctrl-C/D）
- `Tabs.tsx` — 复杂 Tab 导航，header focus gating，支持 controlled/uncontrolled 模式
- `Divider.tsx`、 `Byline.tsx`、 `KeyboardShortcutHint.tsx`
- `ThemedText.tsx` / `ThemedBox.tsx` / `ThemeProvider.tsx` — 主题系统
- `FuzzyPicker.tsx`、 `ListItem.tsx`、 `ProgressBar.tsx`、 `Ratchet.tsx`、 `StatusIcon.tsx`

#### 输入与交互
- `PromptInput/PromptInput.tsx` — 主输入框（~3000+ 行，最复杂的单组件）
  - 文本输入、Vim 模式、图片粘贴、历史导航、建议渲染
  - 命令队列显示、Agent/teammate 状态、权限模式切换
  - Fast 模式、Auto 模式、IDE 集成、typeahead、@提及
- `PromptInputFooterSuggestions.tsx` — 建议下拉浮层
- `PromptInputQueuedCommands.tsx` — 队列命令显示
- `VimTextInput.tsx`、 `TextInput.tsx`、 `BaseTextInput.tsx` — 输入组件层次

#### 权限与审批 (`permissions/`)
- `PermissionRequest.tsx` — 中央路由：Tool class → PermissionRequest component 映射
- `PermissionDialog.tsx` / `PermissionPrompt.tsx` / `PermissionExplanation.tsx` — 共享权限 UI 原语
- `BashPermissionRequest/`、 `FileEditPermissionRequest/`、 `FileWritePermissionRequest/`
- `WebFetchPermissionRequest/`、 `PowerShellPermissionRequest/`、 `NotebookEditPermissionRequest/`
- `SkillPermissionRequest/`、 `AskUserQuestionPermissionRequest/`
- `EnterPlanModePermissionRequest/`、 `ExitPlanModePermissionRequest/`
- `ComputerUseApproval`、 `SandboxPermissionRequest.tsx`、 `SedEditPermissionRequest/`
- `WorkerBadge.tsx`、 `WorkerPendingPermission.tsx` — Swarm worker 权限 UI

#### Agent 管理 (`agents/`)
- `AgentsMenu.tsx` — 顶层状态机（`list-agents` → `agent-menu` → `view-agent` → `edit-agent` → `create-agent` → `delete-confirm`）
- `AgentDetail.tsx` — 显示 Agent 属性（描述、工具、模型、权限模式、记忆、hooks、技能、颜色）
- `AgentEditor.tsx` — 终端内 Agent 属性编辑器
- `AgentsList.tsx` — 按来源分组列出 Agent（内置、自定义、插件）
- `new-agent-creation/CreateAgentWizard.tsx` — 新 Agent 创建向导（10 步）
  1. Location（project vs global）
  2. Method（manual vs AI 生成）
  3. Generate（AI 生成）
  4. Type（Agent 子类型）
  5. Prompt（系统提示词编辑）
  6. Description（描述）
  7. Tools（工具选择）
  8. Model（模型选择）
  9. Color（UI 颜色）
  10. Confirm（最终确认）
- `generateAgent.ts` — AI 生成 Agent。调用 `queryModelWithoutStreaming()` 配合 `AGENT_CREATION_SYSTEM_PROMPT`，期望结构化 JSON 输出：`{identifier, whenToUse, systemPrompt}`
- `agentFileUtils.ts` — Agent 文件 I/O：`formatAgentAsMarkdown()` 创建 YAML frontmatter + markdown 正文；`saveAgentToFile()`、`updateAgentToFile()`、`deleteAgentFromFile()` 处理 CRUD。Agent 存储为 `.md` 文件，含 YAML frontmatter（identifier、name、description、tools、model、color 等）

#### MCP UI (`mcp/`)
- `MCPSettings.tsx` — MCP 设置主屏，视图状态机（`list` → `detail` → `add-stdio` → `add-sse`...）
- `MCPListPanel.tsx` — 服务器列表
- `ElicitationDialog.tsx` — 服务器参数请求对话框
- `MCPToolListView.tsx`、 `MCPToolDetailView.tsx` — 工具浏览

#### 任务与后台作业 (`tasks/`)
- `BackgroundTask.tsx` — 后台任务状态渲染
- `BackgroundTasksDialog.tsx` — 后台任务列表对话框
- `ShellProgress.tsx`、 `TaskStatusText` — Shell 进度/状态指示器
- `ShellDetailDialog.tsx`、 `RemoteSessionDetailDialog.tsx` — Shell/远程会话详情
- `InProcessTeammateDetailDialog.tsx`、 `DreamDetailDialog.tsx`、 `AsyncAgentDetailDialog.tsx`

#### 记忆 UI (`memory/`)
- `MemoryFileSelector.tsx` — 记忆文件选择器
- `MemoryUpdateNotification.tsx` — 记忆更新通知

#### 技能 UI (`skills/`)
- `SkillsMenu.tsx` — 按来源分组的技能列表

#### 团队与 Swarm (`teams/`)
- `TeamsDialog.tsx` — 队友查看对话框，支持嵌套层级（`teammateList` → `teammateDetail`）
- `TeamStatus.tsx` — 团队状态显示

#### Shell 输出 (`shell/`)
- `ExpandShellOutputContext.tsx` — 可展开 shell 输出上下文
- `OutputLine.tsx` — 单行渲染
- `ShellProgressMessage.tsx` — Shell 任务进度指示

#### 向导框架 (`wizard/`)
- `WizardProvider.tsx`、 `useWizard.ts` — 向导状态管理
- `WizardDialogLayout.tsx` — 向导步骤布局包装
- `WizardNavigationFooter.tsx` — 导航页脚

#### 其他重要组件
- `Markdown.tsx` (~200KB) / `MarkdownTable.tsx` — Markdown 渲染（含表格）
- `Spinner.tsx` (~152KB) — 复杂加载动画，多模式/多动词/多状态
- `MessageSelector.tsx` (~115KB) — 消息选择 UI
- `ScrollKeybindingHandler.tsx` (~149KB) — 键盘滚动处理
- `Feedback.tsx` (~87KB) — 反馈收集
- `ContextVisualization.tsx` (~76KB) — 上下文可视化
- `ConsoleOAuthFlow.tsx` (~82KB) — OAuth 流程 UI
- `Onboarding.tsx` (~31KB) — 用户引导流程
- `ExportDialog.tsx` — 会话导出
- `GlobalSearchDialog.tsx` (~43KB) — 全局搜索
- `HistorySearchDialog.tsx` — 历史搜索
- `QuickOpenDialog.tsx` (~28KB) — 快速文件打开
- `ThemePicker.tsx`、 `ModelPicker.tsx` (~54KB)、 `LanguagePicker.tsx` — 选择对话框
- `TrustDialog/`、 `Settings/`、 `HelpV2/`、 `LogoV2/`、 `CustomSelect/`、 `FeedbackSurvey/`、 `ClaudeCodeHint/`、 `DesktopUpsell/`、 `HighlightedCode/`、 `LspRecommendation/`、 `Passes/`、 `StructuredDiff.tsx`、 `TaskListV2.tsx`、 `TeleportProgress.tsx`、 `TeleportError.tsx`、 `ThinkingToggle.tsx`、 `TokenWarning.tsx`、 `ValidationErrorsList.tsx`

---

### 2.8 src/screens — 屏幕/页面级组件

**Purpose:** 顶级屏幕组件，代表主要应用模式。只有 3 个屏幕，但 REPL.tsx 是主导模块（896KB）。

**Key files:**
- `REPL.tsx` — 主交互式 REPL 屏幕（最核心的 UI 文件，~3000+ 行）
  - 管理整个对话循环：输入 -> 查询 -> 显示 -> 等待输入
  - 集成所有 hooks：远程会话、语音、桥接、成本追踪、背景任务等
  - 处理键盘快捷键、模态框堆叠、滚动、搜索高亮
  - 使用 `useDeferredValue` 和大量 refs 避免滚动期间 re-render
  - 条件死代码消除：VOICE_MODE、KAIROS、PROACTIVE、COORDINATOR_MODE 等
- `ResumeConversation.tsx` — 会话恢复屏幕
  - 渐进式加载日志、恢复 Agent、处理跨项目恢复
  - Props: `commands`, `worktreePaths`, `initialTools`, `mcpClients`, `thinkingConfig`
  - 最终渲染 `<REPL>` 完成恢复
- `Doctor.tsx` — 诊断屏幕
  - 显示版本信息、配置路径、设置验证、锁信息（PID-based）
  - 使用 `Suspense` + `use(promise)` 异步获取 dist tag

**Notable patterns:**
- `REPL.tsx` 导入 80+ 模块，是整个应用的集成中心
- `ResumeConversation.tsx` 使用渐进式日志加载
- Feature-flagged 条件导入

---

### 2.9 src/ink — Ink 框架扩展

**Purpose:** 对 Ink 终端 UI 框架的深度定制扩展，包括自定义 React reconciler、Yoga 布局引擎、事件系统、屏幕缓冲区管理。这是整个应用的基础渲染层。

**Key files:**
- `ink.tsx` (~251KB) — Ink 主类，管理终端渲染循环、键盘事件、鼠标追踪、文本选择、超链接
- `reconciler.ts` — 自定义 React reconciler，将 React 组件桥接到 Ink DOM
- `dom.ts` — Ink DOM 元素类型（`ink-root`, `ink-box`, `ink-text`, `ink-virtual-text`, `ink-link`, `ink-progress`, `ink-raw-ansi`）和节点操作
- `renderer.ts` — 帧渲染编排器：双缓冲、blitting、脏检查
- `output.ts` — 收集 write/blit/clear/clip 操作并应用到 Screen buffer
- `screen.ts` — 屏幕缓冲区：字符驻留池 (`CharPool`)、超链接驻留池 (`HyperlinkPool`)、单元格设置、diffing
- `render-node-to-output.ts` — 将 DOM 节点渲染到输出缓冲区，处理 scroll box 的视口裁剪

**Subdirectories:**
- `components/` — 自定义 Ink 组件
  - `ScrollBox.tsx` — 带 `overflow: scroll` 的 Box，提供命令式滚动 API (`scrollTo`, `scrollBy`, `scrollToBottom`, `getScrollTop`, `isSticky`, `setClampBounds`)
  - 支持视口裁剪（只渲染可见区域的子元素）
- `events/` — 终端事件处理
  - `dispatcher.ts` — 键盘/鼠标事件分发
- `hooks/` — Ink 专用 hooks
  - `use-input.ts` — 使用 `useLayoutEffect`（非 `useEffect`）在 React commit 阶段同步设置 raw mode
  - `use-search-highlight.ts` — 搜索高亮
  - `use-tab-status.ts` — Tab 状态
- `layout/` — Yoga 布局集成
  - `engine.ts` — Yoga 布局引擎集成
  - `geometry.ts` — 布局几何计算
  - `node.ts` — 布局节点管理
- `termio/` — 终端 I/O 底层
  - ANSI 序列、OSC 处理

**Notable patterns:**
- **React Compiler Runtime**: 所有 JSX 文件使用 `import { c as _c } from "react/compiler-runtime"` 自动 memoization
- **双缓冲渲染**: `frontFrame` / `backFrame`，检查 `prevFrameContaminated` 决定 blitting 安全性
- **字符串驻留池**: `CharPool` (ASCII 快速路径 via `Int32Array`) 和 `HyperlinkPool` 节省内存并加速比较
- **视口裁剪**: ScrollBox 只渲染可见内容
- **事件处理器分离**: 处理器身份变化不标记 dirty

---

### 2.10 src/context — React Context

**Purpose:** 全局 UI 状态、通知、覆盖层、模态框尺寸的跨领域 Provider。

**Key files:**
- `notifications.tsx` — 基于优先级的通知队列（`immediate` > `high` > `medium` > `low`），支持超时（DEFAULT_TIMEOUT_MS=8000）、折叠、失效
- `overlayContext.tsx` — Escape 键协调，通过 active overlay 注册集管理模态框堆叠
- `promptOverlayContext.tsx` — 提示覆盖层 Portal，将浮动内容置于 prompt 上方以逃避 `overflowY:hidden` 裁剪。分为 data/setter 两个 Context 防止 writer re-render
- `stats.tsx` — 指标收集：计数器、仪表盘、计时器（直方图 via reservoir sampling，RESERVOIR_SIZE=1024）、集合
- `voice.tsx` — 语音状态管理，使用自定义 Store + `useSyncExternalStore`
- `modalContext.tsx` — 提供模态框尺寸和 scrollRef
- `fpsMetrics.tsx` — FPS 追踪 Provider

**Notable patterns:**
- **Context Splitting**: data + setter 成对分离，防止 writer 自身触发 re-render
- **Store + useSyncExternalStore**: 细粒度订阅（voice state）
- **Reservoir Sampling**: Algorithm R 实现直方图指标

---

### 2.11 src/hooks — React Hooks

**Purpose:** 可复用的 React 逻辑，主要服务于 REPL.tsx 和组件。

**Hooks 分组:**

#### 核心状态 Hooks
- `useAppState.ts` — AppState 访问
- `useCanUseTool.ts` — 工具使用权限检查
- `useMainLoopModel.ts` — 主循环模型管理

#### 输入与交互
- `useInputBuffer.ts` — 输入缓冲区管理
- `useArrowKeyHistory.ts` — 上下箭头历史
- `useHistorySearch.ts` — 历史搜索
- `useTypeahead.ts` — 自动补全
- `usePromptSuggestion.ts` — 提示建议
- `useDoublePress.ts` — 双击检测

#### 远程与连接
- `useRemoteSession.ts` — 远程会话（CCR - Claude Code Remote）
- `useDirectConnect.ts` — 直接连接
- `useSSHSession.ts` — SSH 会话
- `useReplBridge.ts` — REPL 桥接

#### 语音与媒体
- `useVoiceIntegration.ts` — 语音集成（VOICE_MODE）

#### 任务与代理
- `useBackgroundTaskNavigation.ts` — 后台任务导航
- `useSwarmInitialization.ts` — Swarm 初始化
- `useTeammateViewAutoExit.ts` — 队友视图自动退出
- `useSwarmPermissionPoller.ts` — Swarm 权限轮询

#### 其他
- `useLogMessages.ts` — 日志消息
- `useIdeLogging.ts` — IDE 日志
- `useSkillImprovementSurvey.ts` — 技能改进调查
- `useAfterFirstRender.ts` — 首次渲染后
- `useDeferredHookMessages.ts` — 延迟 Hook 消息
- `useApiKeyVerification.ts` — API 密钥验证
- `useGlobalKeybindings.ts` — 全局快捷键
- `useCommandKeybindings.ts` — 命令快捷键
- `useSearchInput.ts` — 搜索输入
- `useTerminalSize.ts` — 终端尺寸
- `useAssistantHistory.ts` — 助手历史
- `useMoreRight.ts` — MoreRight 功能

---

### 2.12 src/services — 服务层

**Purpose:** 外部 API 客户端、认证、分析、压缩、MCP 等核心服务。

#### services/api/ — API 客户端
- `claude.ts` — Anthropic API 调用核心（流式请求、重试、usage 追踪）
- `errors.ts` — API 错误分类和处理
- `logging.ts` — API 请求日志
- `withRetry.ts` — 通用重试包装器
- `dumpPrompts.ts` — 提示词转储（调试）
- `sessionIngress.ts` — 会话日志获取
- `codexFetchAdapter.ts` — OpenAI Codex 适配器

#### services/mcp/ — MCP 协议实现
- `client.ts` — MCP 客户端管理
- `types.ts` — MCP 类型定义（stdio、sse、ws、http 传输）
- `mcpStringUtils.ts` — MCP 字符串工具
- `serverManager.ts` — MCP 服务器生命周期管理
- `oauth/` — MCP OAuth 认证

#### services/oauth/ — OAuth 认证
- `anthropic.ts` — Anthropic OAuth 流程
- `openai.ts` — OpenAI OAuth 流程
- `client.ts` — OAuth 客户端通用逻辑

#### services/compact/ — 上下文压缩
- `compact.ts` — 主压缩逻辑
- `autoCompact.ts` — 自动压缩触发
- `reactiveCompact.ts` — 响应式压缩（实验性）

#### services/analytics/ — 分析（已剥离）
- `index.ts` — 分析事件接口（stub）
- `growthbook.ts` — GrowthBook 特性开关（本地评估，不上报）

#### services/AgentSummary/ — Agent 摘要
- `agentSummary.ts` — Agent 执行摘要生成

#### services/PromptSuggestion/ — 提示建议
- `promptSuggestion.ts` — 基于上下文的提示建议
- `speculation.ts` — 推测执行

#### services/contextCollapse/ — 上下文折叠
- `index.ts` — 上下文折叠实现。当对话上下文过长时，自动折叠旧消息为摘要。

#### services/extractMemories/ — 记忆提取
- `extractMemories.ts` — 自动从对话中提取持久化记忆，写入 `~/.claude/projects/<path>/memory/`
- 使用 forked agent 模式执行提取

#### services/lsp/ — LSP 支持
- `manager.ts` — LSP 管理器单例初始化
- `LSPServerManager.ts` — 按文件扩展名路由到对应 LSP 服务器
- `LSPServerInstance.ts` — 单服务器生命周期管理（启动/停止/重启/健康检查）
- `LSPClient.ts` — JSON-RPC 客户端包装器（stdio 传输）
- `passiveFeedback.ts` — 诊断通知处理器

#### services/MagicDocs/ — 文档魔法
- 智能文档处理和检索

#### services/SessionMemory/ — 会话记忆
- `sessionMemory.ts` — 后台 forked agent 定期提取关键信息到 markdown 记忆文件
- `prompts.ts` — 记忆提取提示词
- `sessionMemoryUtils.ts` — 阈值检查和配置管理

#### services/settingsSync/ — 设置同步
- `index.ts` — 本地设置/记忆上传到远程（交互式 CLI），远程设置下载到 CCR
- 增量变更检测

#### services/teamMemorySync/ — 团队记忆同步
- `index.ts` (~1250 行) — 双向同步（pull/push）团队记忆文件
- 增量上传、乐观锁定（ETag/If-Match）、冲突解决、密钥扫描、批量大小限制

#### services/remoteManagedSettings/ — 企业远程设置
- `index.ts` (~640 行) — 获取、缓存、验证企业远程托管设置
- Checksum-based HTTP 缓存、每小时后台轮询

#### services/tips/ — 使用提示
- 上下文相关的用户提示

#### services/autoDream/ — 自动梦境
- `consolidationLock.ts` — 记忆整合锁管理

#### services/policyLimits/ — 策略限制
- 企业策略限制检查

---

### 2.13 src/state — 应用状态管理

**Purpose:** 全局状态存储，基于自定义的轻量级 store（非 Redux）。

**Key files:**
- `AppStateStore.ts` — 核心状态定义和默认值
  - 包含 `AppState` 类型：消息列表、工具权限、MCP 状态、设置、成本追踪等
  - 包含 `AppStateStore` 接口：getState/setState/subscribe
- `AppState.tsx` — React Context Provider 包装
- `store.ts` — Store 实现（基于 React 的 useSyncExternalStore）
- `selectors.ts` — 状态选择器
- `teammateViewHelpers.ts` — 队友视图状态助手

**State 结构要点:**
- `messages: Message[]` — 对话历史
- `mcp: { servers, tools, commands, resources }` — MCP 状态
- `toolPermissionContext: ToolPermissionContext` — 工具权限上下文
- `pendingPermissions: QueuedPermissionRequest[]` — 待处理权限请求队列
- `tasks: TaskState[]` — 后台任务列表
- `settings: Settings` — 用户设置
- `costState: CostState` — 成本追踪
- `speculationState: SpeculationState` — 推测执行状态

---

### 2.14 src/utils — 工具函数（最大目录，~350 文件，40+ 子目录）

**Purpose:** 纯工具函数和业务逻辑辅助。按功能细分子目录。

#### 设置与配置
- `settings/settings.ts` — 多层设置系统：支持 `userSettings`、`projectSettings`、`localSettings`、`flagSettings`、`policySettings`、`cliArg`、`session`。提供 `getSettings_DEPRECATED()`、`getSettingsForSource()`、`updateSettingsForSource()`、`parseSettingsFile()`。支持托管设置（企业策略）、MDM 设置、插件设置。每源缓存，带文件监视器
- `settings/types.ts`、 `settings/constants.ts`、 `settings/validation.ts`、 `settings/settingsCache.ts` — 设置类型、常量、验证、缓存
- `settings/managedPath.ts` — 托管设置路径
- `settings/pluginOnlyPolicy.ts` — 插件-only 策略
- `settings/mdm/settings.ts` — MDM 集成
- `settings/applySettingsChange.ts` — 设置变更应用
- `config.ts` / `configConstants.ts` — 全局配置读写

#### 权限与安全
- `permissions/permissions.ts` — 核心权限判断逻辑
- `permissions/PermissionMode.ts` — 权限模式（`acceptEdits`、`bypassPermissions`、`default`、`dontAsk`、`plan`、`auto`、`bubble`）
- `permissions/PermissionResult.ts` — 权限结果类型（discriminated unions）
- `permissions/PermissionRule.ts` — 权限规则定义
- `permissions/PermissionUpdate.ts` / `PermissionUpdateSchema.ts` — 权限更新逻辑
- `permissions/denialTracking.ts` — 拒绝追踪
- `permissions/filesystem.ts` — 文件系统权限：危险目录检查、scratchpad 路径、自动记忆路径覆盖
- `permissions/permissionSetup.ts` — 权限设置初始化
- `sandbox/` — Shell sandboxing 逻辑
- `secureStorage/` — 安全存储抽象：macOS Keychain、Windows Credential Manager、Linux secret service

#### Git 与仓库
- `git.ts` — Git 操作封装，根目录发现（LRU memoization），分支检测
- `github.ts` — GitHub API 交互
- `detectRepository.ts` — 仓库检测
- `gitDiff.ts` — Git diff 生成
- `gitSettings.ts` — Git 设置同步
- `worktree.ts` — Git worktree 管理，含 tmux 集成
- `getWorktreePaths.ts` / `getWorktreePathsPortable.ts` — Worktree 路径获取

#### 模型与 API
- `model/model.ts` — 模型选择、配置、优先级解析（session override > --model flag > env var > settings > default）
- `model/providers.ts` — API 提供商管理（Anthropic、Bedrock、Vertex、Foundry、Codex）
- `model/agent.ts` — Agent 模型选择
- `model/aliases.ts` — 模型别名
- `model/antModels.ts` — Anthropic 内部模型
- `model/modelAllowlist.ts` — 模型白名单
- `model/modelStrings.ts` — 模型字符串常量
- `model/modelCost.ts` — 模型成本计算
- `api.ts` — API 请求构建：工具 schema 过滤、提示缓存（`cacheScope: 'global' | 'org'`）、归因头
- `apiPreconnect.ts` — API 预连接
- `betas.ts` — API Beta 特性管理
- `context.ts` — 上下文窗口管理

#### 消息与提示
- `messages.ts` — 消息创建、转换、规范化
- `messages/mappers.ts` — SDK 消息映射
- `messages/systemInit.ts` — 系统初始化消息
- `systemPrompt.ts` — 系统提示词构建
- `systemPromptType.ts` — 系统提示词类型
- `queryContext.ts` — 查询上下文构建
- `attachments.ts` — 消息附件处理

#### Shell 与进程执行
- `Shell.ts` — Shell 抽象，生命周期管理、会话 env、sandboxing
- `ShellCommand.ts` — Shell 命令封装
- `shell/shellProvider.ts` — `ShellProvider` 接口定义
- `shell/shellToolUtils.ts` — Shell 工具工具函数
- `bash/` — Bash 命令解析和 AST 分析，用于命令安全性分析
- `powershell/` — PowerShell 支持
- `execFileNoThrow.ts` / `execFileNoThrowPortable.ts` / `execSyncWrapper.ts` — 进程执行包装器
- `promptShellExecution.ts` — 提示词中的 shell 命令执行

#### 任务与代理
- `task/framework.ts` — 任务注册和生命周期管理
- `task/diskOutput.ts` — 任务磁盘输出：异步写入、平面队列、drain 循环、`O_NOFOLLOW` 安全
- `task/sdkProgress.ts` — SDK 进度事件发射
- `swarm/teamHelpers.ts` — 团队管理：生成 team 文件、协调 inter-agent 通信
- `swarm/spawnInProcess.ts` — 同进程 teammate 生成
- `swarm/leaderPermissionBridge.ts` — 领导者权限桥接
- `swarm/permissionSync.ts` — 跨代理权限同步
- `swarm/backends/` — Swarm 后端实现（tmux、iTerm2 等）
- `agentContext.ts` — Agent 上下文管理
- `agentSwarmsEnabled.ts` — Swarm 启用检查
- `forkedAgent.ts` — Fork 代理执行：共享父进程提示缓存
- `standaloneAgent.ts` — 独立 Agent 执行
- `inProcessTeammateHelpers.ts` — 同进程 teammate 辅助
- `teammate.ts` / `teammateContext.ts` / `teammateMailbox.ts` — 队友身份、上下文、邮箱通信

#### 认证与身份
- `auth.ts` — 多提供商认证：API key、OAuth（claude.ai）、AWS（Bedrock/Vertex）、Codex。主入口：`getAuthTokenSource()`、`getEffectiveAuthToken()`
- `authFileDescriptor.ts` / `authPortable.ts` — 文件描述符认证、可移植认证
- `aws.ts` / `awsAuthStatusManager.ts` — AWS 认证和状态管理
- `sessionIngressAuth.ts` — 会话入口认证

#### MCP（Model Context Protocol）
- `mcp/` — MCP 客户端管理工具
- `mcpInstructionsDelta.ts` — MCP 指令增量追踪
- `mcpOutputStorage.ts` — MCP 输出存储
- `mcpValidation.ts` — MCP 验证
- `mcpWebSocketTransport.ts` — MCP WebSocket 传输

#### 插件
- `plugins/` — 插件加载工具
  - `pluginLoader.ts` — 从 Git 仓库加载插件
  - `pluginRegistry.ts` — 插件注册表
  - `schemas.ts` — 插件 schema
  - `loadPluginOutputStyles.ts` — 插件输出样式加载

#### 文件与 IO
- `fsOperations.ts` — 文件系统操作抽象（可注入，用于测试）
- `fileStateCache.ts` — 文件状态缓存（LRU）
- `fileHistory.ts` — 文件历史快照
- `filePersistence.ts` — 文件持久化
- `readFileInRange.ts` — 范围文件读取
- `tempfile.ts` — 临时文件管理
- `path.ts` — 路径规范化
- `glob.ts` — Glob 匹配
- `ripgrep.ts` — ripgrep 集成，回退到内嵌二进制
- `pdf.ts` / `pdfUtils.ts` — PDF 处理（提取、验证）
- `notebook.ts` — Jupyter Notebook 支持

#### 会话与状态管理
- `sessionStorage.ts` / `sessionStoragePortable.ts` — 会话转录存储（JSONL 格式）、会话恢复
- `sessionState.ts` — 会话状态管理
- `sessionRestore.ts` — 会话恢复逻辑
- `sessionStart.ts` — 会话启动
- `sessionEnvironment.ts` / `sessionEnvVars.ts` — 会话环境变量
- `sessionFileAccessHooks.ts` — 文件访问分析 hooks
- `sessionActivity.ts` — 会话活动追踪
- `sessionTitle.ts` — 会话标题生成
- `concurrentSessions.ts` — 并发会话管理
- `crossProjectResume.ts` — 跨项目恢复

#### 记忆与上下文
- `memory/` — 记忆系统工具
- `context.ts` — 上下文窗口管理
- `contextAnalysis.ts` — 对话分析
- `contextSuggestions.ts` — 上下文建议
- `analyzeContext.ts` — 上下文分析

#### 终端与 UI 工具
- `terminal.ts` — 终端能力检测
- `fullscreen.ts` — 全屏模式
- `theme.ts` / `systemTheme.ts` — 主题管理（dark/light/auto）
- `ink.ts` — Ink 框架相关工具
- `cliHighlight.ts` — CLI 高亮
- `ansiToPng.ts` / `ansiToSvg.ts` — ANSI 渲染为图片/SVG
- `screenshotClipboard.ts` — 剪贴板截图
- `hyperlink.ts` — 超链接生成

#### 字符串与文本处理
- `stringUtils.ts` — 字符串工具
- `intl.ts` — Grapheme 分割（Intl.Segmenter）
- `words.ts` — 单词计数
- `truncate.ts` — 截断工具
- `sliceAnsi.ts` — ANSI 字符串切片
- `markdown.ts` — Markdown 处理
- `xml.ts` — XML 处理
- `yaml.ts` — YAML 解析
- `json.ts` / `jsonRead.ts` — JSON 解析（容错）
- `frontmatterParser.ts` — Frontmatter 提取

#### 光标与输入
- `Cursor.ts` — Grapheme-aware 光标抽象
- `textHighlighting.ts` — 文本高亮
- `handlePromptSubmit.ts` — 提示提交处理
- `earlyInput.ts` — 提前输入处理
- `modifiers.ts` — 键盘修饰符追踪

#### 计划与项目管理
- `plans.ts` — 计划文件管理（`.claude/plans/`）
- `planModeV2.ts` — 计划模式 V2
- `readEditContext.ts` — 读/编辑上下文追踪

#### 计费与用量
- `billing.ts` — 计费追踪
- `extraUsage.ts` — 额外用量
- `modelCost.ts` — 模型成本计算
- `tokenBudget.ts` — Token 预算执行
- `tokens.ts` — Token 计数

#### 平台与环境
- `platform.ts` — 平台检测（macOS、Linux、Windows）
- `env.ts` / `envUtils.ts` / `envDynamic.ts` / `envValidation.ts` — 环境变量访问、验证
- `systemDirectories.ts` — 系统目录解析
- `xdg.ts` — XDG 目录合规
- `windowsPaths.ts` — Windows 路径转换

#### 性能与缓存
- `memoize.ts` — 自定义 memoization（TTL、LRU）
- `completionCache.ts` — 完成缓存
- `statsCache.ts` — 统计缓存
- `profilerBase.ts` / `headlessProfiler.ts` / `startupProfiler.ts` — 性能分析基础设施
- `fpsTracker.ts` — FPS 追踪
- `queryProfiler.ts` — 查询性能分析

#### 图片与媒体
- `imagePaste.ts` — 图片粘贴（终端拖放、剪贴板）
- `imageResizer.ts` — 图片调整大小到 API 限制
- `imageStore.ts` — 图片存储
- `imageValidation.ts` — 图片验证
- `attachments.ts` — 附件管理

#### 网络与 Web
- `browser.ts` — 浏览器打开
- `http.ts` — HTTP 请求
- `proxy.ts` — 代理支持
- `mtls.ts` — mTLS 证书处理
- `caCerts.ts` / `caCertsConfig.ts` — CA 证书配置
- `codex-fetch-adapter.ts` — Codex API fetch 适配器

#### 错误处理与日志
- `errors.ts` — 错误分类（`isENOENT`、`isEACCES` 等）
- `log.ts` — 结构化日志
- `errorLogSink.ts` — 错误日志接收器
- `debug.ts` — 调试日志（`--debug` 控制）
- `diagLogs.ts` — 诊断日志，PII 脱敏
- `warningHandler.ts` — 警告处理
- `toolErrors.ts` — 工具错误格式化

#### 测试与开发
- `generatedFiles.ts` — 生成文件检测
- `doctorContextWarnings.ts` — 诊断上下文警告
- `doctorDiagnostic.ts` — 诊断诊断工具
- `claudeCodeHints.ts` — Claude Code 提示
- `exampleCommands.ts` — 示例命令生成

#### 其他工具
- `abortController.ts` — AbortController 管理
- `cwd.ts` — 当前工作目录管理
- `format.ts` — 格式化工具
- `array.ts` — 数组工具
- `cleanupRegistry.ts` — 清理注册表
- `crypto.ts` / `hash.ts` / `cch.ts` / `fingerprint.ts` — 加密、哈希、内容完整性、构建指纹
- `detectRepository.ts` — 仓库检测
- `editor.ts` — 外部编辑器集成
- `exportRenderer.ts` — 导出渲染器
- `lazySchema.ts` — 懒加载 Zod Schema
- `nativeInstaller.ts` — 原生安装器
- `suggestions/` — 自动补全建议
- `todo/` — 待办事项工具
- `ultraplan/` — 超级计划工具
- `voice/` — 语音处理
- `skills/` — 技能加载工具
- `telemetry/` — 遥测（已 stub）

**Notable patterns across src/utils:**
1. **特性标志**: 大量使用 `feature()` 配合条件 `require()`
2. **Memoization**: 自定义 memoization（TTL、LRU）用于 git root 发现、设置解析、认证令牌检索
3. **FsImplementation 抽象**: `fsOperations.ts` 提供可注入的文件系统接口用于测试
4. **设置分层**: 多源设置，清晰优先级（policy > flag > local > project > user）
5. **Branded types**: `SessionId` 和 `AgentId` 防止 ID 混淆
6. **懒加载**: 重依赖（highlight.js、yoga）首次使用时加载
7. **缓存失效**: 文件监视器和 generation 计数器保持缓存新鲜
8. **安全优先路径处理**: 路径规范化、危险目录检查、自动记忆路径验证

---

### 2.15 src/types — 类型定义

**Purpose:** 全项目共享的 TypeScript 类型。作为架构中的 "cycle breaker" 层，大量纯类型定义提取至此以避免运行时循环依赖。

**Key files:**
- `command.ts` — 命令类型系统
  - `LocalCommandResult` — 本地命令结果：text / compact / skip 三种变体
  - `PromptCommand` — 提示命令结构：progressMessage、contentLength、allowedTools、model、source、hooks、skillRoot、context（inline/fork）、effort、paths、getPromptForCommand()
- `message.ts` — 消息类型（UserMessage、AssistantMessage、SystemMessage、ToolUseBlock、ToolResultBlock 等）
- `permissions.ts` — 权限类型定义（纯类型，无运行时依赖）
  - `ExternalPermissionMode` / `InternalPermissionMode` — 权限模式联合类型
  - `PermissionBehavior` — `'allow' | 'deny' | 'ask'`
  - `PermissionRuleSource` — 规则来源（userSettings、projectSettings、policySettings 等）
- `tools.ts` — 工具进度类型
- `ids.ts` — Branded ID 类型（`AgentId`、`SessionId`），编译期防止 ID 混淆
- `textInputTypes.ts` — 文本输入类型
- `hooks.ts` — Hooks 类型与 Zod schema
  - `promptRequestSchema` / `promptResponseSchema` — 提示请求/响应协议
  - `syncHookResponseSchema` / `asyncHookResponseSchema` — Hook 响应 schema
  - `HookProgress` — Hook 执行进度跟踪
- `plugin.ts` — 插件清单类型（PluginManifest、PluginCapability、PluginHook 等）
- `logs.ts` — 日志选项与类型
- `connectorText.ts` — IDE 桥接连接器文本常量

**Notable patterns:** 这是架构中最底层的类型层，所有子系统都依赖它但谁也不被它依赖，形成自然的 DAG 根节点。

**generated/** — 自动生成的类型
- `events_mono/` — Protocol Buffers 事件类型
  - `claude_code/v1/` — Claude Code 事件
  - `common/v1/` — 通用事件
  - `growthbook/v1/` — GrowthBook 事件
- `google/protobuf/` — Google Protobuf 类型

---

### 2.16 src/constants — 常量定义

**Purpose:** 编译时常量和运行时配置。

**Key files:**
- `prompts.ts` — 系统提示词生成（核心文件，~2000+ 行）
  - 构建完整的 system prompt，包含工具说明、安全指导、行为规范
  - 支持多种模型和配置的动态提示词组装
- `systemPromptSections.ts` — 系统提示词章节管理
- `xml.ts` — XML 标签常量（用于消息格式）
- `querySource.ts` — 查询来源常量
- `outputStyles.ts` — 输出样式
- `figures.ts` — 终端图形字符
- `oauth.ts` — OAuth 配置
- `product.ts` — 产品常量

---

### 2.17 src/skills — 技能系统

**Purpose:** 可扩展的技能框架，允许用户或插件添加自定义能力。技能是可扩展的命令，可从磁盘（用户定义）、捆绑（编译到 CLI 中）、遗留命令或 MCP 服务器加载。

**Key files:**
- `loadSkillsDir.ts` — 从 `~/.claude/skills/` 和遗留 `.claude/commands/` 加载技能
  - `getSkillDirCommands()` — 记忆化
  - `discoverSkillDirsForPaths()` — 从文件路径向上遍历目录树发现相关技能目录
  - `activateConditionalSkillsForPaths()` — 使用 `ignore` 库进行 gitignore 风格路径匹配，条件激活技能
  - 通过 resolved realpath 去重，避免通过不同路径重复加载同一技能
- `bundledSkills.ts` — `registerBundledSkill()` 在构建/编译时以编程方式注册技能
  - 支持 `files` 属性用于技能资源的延迟磁盘提取
  - 安全文件写入：`O_NOFOLLOW | O_EXCL` 标志防止覆盖和符号链接攻击
- `mcpSkillBuilders.ts` — 从 MCP 服务器构建技能
- `legacyCommands.ts` — 遗留命令格式技能（pre-SKILL.md 格式）的适配层
- `skillValidation.ts` — 技能定义验证逻辑
- `skillExecution.ts` — 技能运行时执行包装器，处理参数解析和调用

**bundled/** — 内嵌技能目录
- 包含随 CLI 一起分发的技能

**技能加载流程:**
1. 扫描 `~/.claude/skills/` 和项目 `CLAUDE.md` 中定义的技能目录
2. 解析 Markdown 前置 matter（frontmatter）获取元数据
3. 支持参数替换、shell 命令执行
4. 注册为 `PromptCommand`，可被模型调用

**Notable patterns:**
- 记忆化技能目录发现，避免重复文件系统遍历
- 基于 realpath 的去重防止同一技能通过不同路径重复加载
- Gitignore 风格条件激活
- 安全文件提取（exclusive creation flags）

---

### 2.18 src/plugins — 插件系统

**Purpose:** 比技能更重的扩展机制，插件可提供命令、hooks、MCP 服务器。

**Key files:**
- `builtinPlugins.ts` — 内置插件注册表
- `bundled/` — 捆绑插件

**插件类型:**
- Marketplace 插件（`name@marketplace`）
- 内置插件（`name@builtin`）

---

### 2.19 src/bridge — 远程控制桥接

**Purpose:** "Remote Control" 功能完整实现，允许本地 Claude Code 会话被 claude.ai（Web/移动端）远程控制。包含两个主要子系统：
1. **Standalone bridge** (`bridgeMain.ts`): `claude remote-control` 守护进程，轮询服务器工作项并生成子进程处理
2. **REPL bridge** (`replBridge.ts`, `remoteBridgeCore.ts`): 活跃 REPL 会话中的进程内桥接，将会话事件转发到服务器

**Key files:**
- `types.ts` — 共享协议类型：`WorkData`, `WorkResponse`, `BridgeConfig`, `BridgeApiClient`, `PermissionResponseEvent`
- `bridgeApi.ts` — Environments API HTTP 客户端：`registerBridgeEnvironment`, `pollForWork`, `acknowledgeWork`, `stopWork` 等。定义 `BridgeFatalError` 和 `validateBridgeId()`
- `bridgeConfig.ts` — 认证/URL 解析，支持开发覆盖 (`CLAUDE_BRIDGE_OAUTH_TOKEN`, `CLAUDE_BRIDGE_BASE_URL`)
- `bridgeEnabled.ts` — 运行时权限控制：检查 `feature('BRIDGE_MODE')`、 `isClaudeAISubscriber()`、GrowthBook `tengu_ccr_bridge`
- `bridgeMain.ts` — Standalone bridge 守护进程核心。管理会话 Map、超时、令牌刷新、容量唤醒、心跳、worktree 创建、优雅关闭（SIGTERM→SIGKILL 升级）
- `sessionRunner.ts` — `createSessionSpawner()` 生成子 `claude` 进程，解析 NDJSON stdout，管理 debug/transcript 文件
- `bridgeUI.ts` — `createBridgeLogger()` 渲染 bridge TUI：连接 spinner、空闲/已连接/重连/失败状态、二维码、会话计数
- `bridgeMessaging.ts` — 共享传输层：`handleIngressMessage()` (消息路由、echo 去重), `handleServerControlRequest()` (响应 `initialize`/`set_model`/`interrupt` 等), `BoundedUUIDSet` (FIFO 去重)
- `bridgePermissionCallbacks.ts` — 桥接权限请求/响应流程类型
- `bridgeDebug.ts` — 内部故障注入系统 (`registerBridgeDebugHandle`, `injectBridgeFault`)，用于测试恢复路径
- `bridgePointer.ts` — 崩溃恢复指针 (`bridge-pointer.json`)，`readBridgePointerAcrossWorktrees()` 跨 worktree 搜索最新指针
- `capacityWake.ts` — `createCapacityWake()` 合并 AbortSignal，使容量轮询循环在容量释放或关闭前高效睡眠
- `createSession.ts` — `createBridgeSession()`, `getBridgeSession()`, `archiveBridgeSession()` — Sessions API 包装
- `codeSessionApi.ts` — CCR v2 代码会话 SDK 包装：`createCodeSession()`, `fetchRemoteCredentials()`
- `envLessBridgeConfig.ts` — v2 bridge 的 GrowthBook 配置（重试时间、心跳、令牌刷新缓冲）
- `flushGate.ts` — `FlushGate<T>` 状态机，在初始历史 flush 期间排队实时消息以保序
- `inboundAttachments.ts` — 解析入站 bridge 用户消息的 `file_uuid` 附件，下载到 `~/.claude/uploads/{sessionId}/`
- `inboundMessages.ts` — `extractInboundMessageFields()` 和 `normalizeImageBlocks()` 处理入站消息
- `initReplBridge.ts` — REPL bridge 启动入口，读取 session/git/OAuth 上下文，分支到 v1 (`initBridgeCore`) 或 v2 (`initEnvLessBridgeCore`)
- `jwtUtils.ts` — `decodeJwtPayload()`, `decodeJwtExpiry()`, `createTokenRefreshScheduler()` 主动 JWT 刷新
- `pollConfig.ts` / `pollConfigDefaults.ts` — GrowthBook 轮询间隔配置，带 Zod 验证和安全下限
- `remoteBridgeCore.ts` — **Env-less bridge core (v2)**。直接通过 `POST /v1/code/sessions` → `POST /bridge` → SSETransport+CCRClient 连接。401 恢复、主动令牌刷新、seq-num  carryover
- `replBridge.ts` — **Env-based bridge core (v1)**。注册环境、创建会话、启动工作轮询、HybridTransport (WS 读取 + POST 写入)、`onEnvironmentLost` 恢复（原地重连或回退新会话）
- `replBridgeHandle.ts` — 全局指针 `setReplBridgeHandle()` / `getReplBridgeHandle()`，使工具/slash 命令能与桥接交互
- `replBridgeTransport.ts` — 传输抽象层，统一 v1 (WebSocket+POST) 和 v2 (SSE+CCRClient)
- `sessionIdCompat.ts` — `toCompatSessionId()` / `toInfraSessionId()` CCR v2 compat 层 ID 转换 (`cse_*` ↔ `session_*`)
- `trustedDevice.ts` — 可信设备令牌注册和检索，用于提升 bridge 认证安全等级
- `workSecret.ts` — `decodeWorkSecret()`, `buildSdkUrl()`, `buildCCRv2SdkUrl()`, `registerWorker()`

**桥接安全:**
- JWT 认证 + 主动刷新 (`createTokenRefreshScheduler`)
- 可信设备令牌 (`trustedDevice.ts`)，用于 ELEVATED 安全等级的 bridge 会话
- 桥接 ID 安全验证 (`validateBridgeId`)，防止路径遍历
- `prctl(PR_SET_DUMPABLE, 0)` 通过 FFI 禁用 ptrace

**Notable patterns:**
- **Bootstrap isolation**: `initReplBridge.ts` 是 "bootstrap-read 边界"，显式传递所有 bootstrap 状态到核心函数
- **Transport abstraction**: `ReplBridgeTransport` 统一 v1 和 v2 传输
- **Crash recovery**: `bridge-pointer.json` + mtime TTL 支持 `--continue` 恢复
- **Fault injection**: ant-only `bridgeDebug.ts` 支持 `/bridge-kick` 注入故障
- **CSE shim**: `sessionIdCompat.ts` 处理 CCR v2 compat 层 ID 标签转换

---

### 2.20 src/voice — 语音输入

**Purpose:** 语音模式支持（push-to-talk、dictation）。

**Functionality:**
- 音频录制和转录
- 语音活动检测
- 与提示输入框集成

---

### 2.21 src/vim — Vim 模式

**Purpose:** 为提示输入框提供完整的 Vim 键绑定支持。基于状态机的 vim 编辑器实现。

**Key files:**
- `types.ts` — 核心状态机类型：
  - `VimState`（INSERT | NORMAL）
  - `CommandState`（idle、count、operator、operatorCount、operatorFind、operatorTextObj、find、g、replace、indent）
  - `PersistentState`（lastChange、lastFind、register）
  - `RecordedChange`（用于 dot-repeat）
- `motions.ts` — 纯动作解析函数：`resolveMotion()` 应用动作（`h/j/k/l/w/b/e/W/B/E/0/^/$/G/gj/gk`），带 count 重复
- `operators.ts` — 操作符执行：`executeOperatorMotion`、`executeOperatorFind`、`executeOperatorTextObj`、`executeLineOp`、`executeX`、`executeReplace`、`executeToggleCase`、`executeJoin`、`executePaste`、`executeIndent`、`executeOpenLine`
- `textObjects.ts` — 文本对象边界查找：`findTextObject()` 支持单词（`iw`、`aw`、`iW`、`aW`）、引号（`i"`、`a"` 等）、括号（`i(`、`a(`、`i[`、`a{` 等）。Grapheme-safe 迭代
- `transitions.ts` — 主状态转换表。`transition()` 按 `CommandState.type` 分发到处理函数（`fromIdle`、`fromCount`、`fromOperator` 等）。处理 count 解析、操作符链、find 重复、dot-repeat

**Notable patterns:**
- 穷举状态机，使用 TypeScript discriminated unions
- 纯动作函数 + 非纯操作符 context
- Grapheme-safe 文本操作
- 录制变更用于 dot-repeat

---

### 2.22 src/bootstrap — 启动状态

**Purpose:** 全局会话状态容器和访问层。实现单一可变 `STATE` 对象，保存所有会话范围的数据。强制执行 "bootstrap-isolation" 规则：bootstrap 必须是 DAG 叶子节点，不能导入大多数其他 src/ 模块，防止循环依赖。

**Key files:**
- `state.ts` — 唯一文件。定义 `State` 类型（~250 字段）、`getInitialState()`、`STATE` 单例、~150 个访问函数

**State 结构要点:**
- 财务/计时: `totalCostUSD`, `totalAPIDuration`, `totalToolDuration`, turn-level hook/classifier/tool 计数器
- 模型/配置: `modelUsage`, `mainLoopModelOverride`, `modelStrings`
- 会话身份: `sessionId`, `parentSessionId`, `originalCwd`, `projectRoot`, `cwd`, `clientType`
- 遥测/OpenTelemetry: `meter`, `sessionCounter`, `costCounter`, `tokenCounter`, `tracerProvider`
- Agent 颜色: `agentColorMap`, `agentColorIndex`
- API/调试捕获: `lastAPIRequest`, `lastAPIRequestMessages`, `cachedClaudeMdContent`
- 特性标志: `flagSettingsPath`, `allowedSettingSources`, `sdkAgentProgressSummariesEnabled`
- Bridge/远程控制: `isRemoteMode`, `directConnectServerUrl`, `sessionIngressToken`
- 插件/技能: `inlinePlugins`, `invokedSkills`, `registeredHooks`
- 计划/模式追踪: `hasExitedPlanMode`, `planSlugCache`
- 团队/信任: `sessionCreatedTeams`, `sessionTrustAccepted`, `sessionPersistenceDisabled`
- Cron: `scheduledTasksEnabled`, `sessionCronTasks`
- 提示缓存: `afkModeHeaderLatched`, `fastModeHeaderLatched`, `promptCache1hAllowlist`

**Notable patterns:**
- 顶部有 "DO NOT ADD MORE STATE HERE" 注释，有意施压保持全局状态最小化
- `bootstrap-isolation` ESLint 规则：禁止相对 `./` 或绝对 `/` 导入到非叶子模块
- `createSignal` 工具用于 `sessionSwitched` 事件订阅
- `AttributedCounter` 抽象包装 OpenTelemetry 计数器并注入属性
- Turn-level 预算: `snapshotOutputTokensForTurn()`, `getTurnOutputTokens()`
- Scroll drain 暂停: `markScrollActivity()` / `getIsScrollDraining()` / `waitForScrollIdle()` — 滚动期间暂停后台间隔任务

---

### 2.23 src/buddy — Buddy 伴侣系统

**Purpose:** 终端中的视觉伴侣角色（实验性）。一个 gamification/easter-egg 功能。

**Key files:**
- `types.ts` — `Companion` 类型：`CompanionBones`（确定性：稀有度、物种、眼睛、帽子、 shiny、属性）和 `CompanionSoul`（生成：名字、个性）。物种使用 `String.fromCharCode` 编码避免金丝雀字符串检测
- `companion.ts` — 基于 `userId` 的确定性伴侣生成，使用 `mulberry32` PRNG 和 `hashString`。`roll()` 按 userId 缓存。`getCompanion()` 合并存储的灵魂与重新生成的骨骼
- `sprites.ts` — 18 个物种的 ASCII 精灵艺术（duck、goose、blob、cat、dragon、octopus、owl、penguin、turtle、snail、ghost、axolotl、capybara、cactus、robot、rabbit、mushroom、chonk），每个有 3 帧 idle 动画。`renderSprite()` 替换眼睛字符并可选叠加帽子
- `CompanionSprite.tsx` (~46KB) — React/Ink 组件，渲染带 idle 动画 tick（500ms）、语音气泡（淡出）、pet 心形动画、thinking 状态反应的伴侣。使用 React compiler runtime (`_c` 调用)
- `useBuddyNotification.tsx` — 启动时显示彩虹 `/buddy` 预告通知（teaser window: 2026-04-01 至 04-07）
- `prompt.ts` — 系统提示词附件，向模型介绍 companion

**Notable patterns:**
- 确定性生成基于 hash(userId + salt)，用户无法重刷获得 legendary 稀有度
- `String.fromCharCode` 编码物种名以规避构建时金丝雀检查
- React compiler runtime 缓存 Ink 组件
- 基于帧的 ASCII 动画，带帽子槽位叠加逻辑

---

### 2.24 src/assistant — 助手模式

**Purpose:** KAIROS 助手模式相关逻辑。

**Key files:**
- `sessionHistory.ts` — 分页获取会话事件历史。`createHistoryAuthCtx` 准备认证头；`fetchLatestEvents` 和 `fetchOlderEvents` 使用 `anchor_to_latest` 和 `before_id` 游标检索。页面大小 100 事件
- `AssistantSessionChooser.tsx` — 选择加入哪个助手会话的 React 组件（当前为 no-op，直接调用 `onCancel`）

**Notable patterns:** 历史分页使用基于 `first_id` 的游标导航而非偏移量

---

### 2.25 src/coordinator — 协调器模式

**Purpose:** 多 Agent 协调器模式（COORDINATOR_MODE）。当启用时，CLI 充当协调器，生成 worker agent 而非直接执行工具。

**Key files:**
- `coordinatorMode.ts` (~19KB) — 所有协调器模式逻辑
  - `isCoordinatorMode()`: 检查特性标志和环境变量
  - `matchSessionMode()`: 确保恢复的会话与其存储的模式匹配
  - `getCoordinatorUserContext()`: 构建 worker 工具上下文字符串注入系统提示词
  - `getCoordinatorSystemPrompt()`: 完整的协调器系统提示词（~370 行）。定义协调器角色、工具（`Agent`、`SendMessage`、`TaskStop`）、worker 能力、任务工作流阶段（Research / Synthesis / Implementation / Verification）、并发规则、失败处理

**Notable patterns:**
- 系统提示词是大模板字符串，内嵌工具名称和大量 markdown 文档
- 为避免循环依赖，`isScratchpadGateEnabled` 在此文件中重复定义而非从 `filesystem.ts` 导入

### 2.26 src/server — 本地服务器

**Purpose:** 直接连接服务器客户端。支持连接到本地运行的 Claude Code 服务器（direct connect 模式），而非托管的 CCR 后端。

**Key files:**
- `directConnectManager.ts` — `DirectConnectSessionManager` 类。通过 WebSocket 连接 direct-connect 服务器，处理控制请求（权限提示），转发 SDK 消息，发送中断。使用 Bun 的带 headers 的 WebSocket
- `createDirectConnectSession.ts` — `createDirectConnectSession()` 函数。POST 到 `${serverUrl}/sessions` 创建新会话，Zod 验证响应，返回 `DirectConnectConfig`
- `types.ts` — 类型定义：`ServerConfig`, `SessionState`, `SessionInfo`, `SessionIndexEntry` 及 Zod schemas

**Notable patterns:** WebSocket 消息解析处理换行符分隔的 JSON 流。控制请求/响应协议匹配 SDK 的 StructuredIO 格式

---

### 2.27 src/remote — 远程控制

**Purpose:** Claude Code Remote (CCR) 会话管理。处理 WebSocket 连接、消息适配、权限桥接，当 CLI 作为客户端连接到远程 Agent 会话时。

**Key files:**
- `RemoteSessionManager.ts` — CCR 会话高级管理器。协调 WebSocket 订阅（接收消息）、HTTP POST（发送消息）、权限请求/响应流。维护待处理权限请求 Map
- `SessionsWebSocket.ts` — 底层 WebSocket 客户端，连接 `wss://api.anthropic.com/v1/sessions/ws/{id}/subscribe`。支持 header 认证、指数退避重连（最多 5 次）、ping/pong、永久关闭码（4003 unauthorized）。支持 Bun 原生 WebSocket 和 `ws` 包
- `sdkMessageAdapter.ts` — 将 CCR 后端的 SDK 格式消息 (`SDKMessage`) 转换为内部 REPL `Message` 类型。处理助手消息、流事件、工具进度、压缩边界、结果消息、用户消息
- `remotePermissionBridge.ts` — 为远程权限请求创建合成 `AssistantMessage` 和 `Tool` stub，当真实工具使用在 CCR 容器上运行且本地 CLI 未加载该工具时

**Notable patterns:**
- 双运行时 WebSocket 支持（Bun 原生 vs Node `ws` 包）
- 通用断开和 4001（会话未找到）在压缩期间的独立重试预算
- `isSDKMessage` 类型守卫区分控制消息和 SDK 消息

---

### 2.28 src/upstreamproxy — 上游代理

**Purpose:** CCR 会话的容器端上游代理布线。当在启用 upstreamproxy 的 CCR 容器中运行时，设置本地 CONNECT-to-WebSocket 中继，将出站 HTTPS 流量通过 CCR upstreamproxy 隧道传输，注入组织配置凭证。

**Key files:**
- `upstreamproxy.ts` — 主初始化。从 `/run/ccr/session_token` 读取会话令牌，通过 FFI 设置 `prctl(PR_SET_DUMPABLE, 0)` 阻止 ptrace，下载 upstreamproxy CA 证书，与系统证书包拼接，启动中继，取消链接令牌文件，暴露 `HTTPS_PROXY` / `SSL_CERT_FILE` 环境变量
- `relay.ts` — CONNECT-over-WebSocket 中继实现。监听 localhost TCP，接受子进程的 HTTP CONNECT（curl/gh/kubectl），通过 WebSocket 将字节隧道传输到 CCR upstreamproxy 端点。使用手写 protobuf (`UpstreamProxyChunk`) 兼容服务器端网关。支持 Bun `Bun.listen` 和 Node `net.createServer`

**Notable patterns:**
- FFI 调用 `prctl`（仅 Linux）用于安全加固
- 手写 protobuf varint 编码/解码（单字段消息），避免运行时依赖
- 双运行时 TCP 服务器（Bun vs Node），Bun 部分写入的背压处理
- `NO_PROXY` 列表覆盖 loopback、RFC1918、IMDS 和特定主机（Anthropic API、GitHub、包注册表）
- 每一步失败都开放（记录警告并禁用代理）

### 2.29 src/memdir — 记忆目录

**Purpose:** 持久化记忆文件系统目录，提供跨会话的文件型记忆存储。

**Key files:**
- `memdir.ts` — 核心记忆提示词构建器。`buildMemoryLines()` 构建行为指令；`buildMemoryPrompt()` 包含 `MEMORY.md` 内容；`loadMemoryPrompt()` 是系统提示词章节注册表分派的主入口点。支持自动记忆、KAIROS daily-log 模式、团队记忆（特性标志控制）。`truncateEntrypointContent()` 强制执行行/字节上限
- `memoryTypes.ts` — 记忆类型分类法（`user`、`feedback`、`project`、`reference`），frontmatter 格式示例，类型化章节（`TYPES_SECTION_COMBINED`、`TYPES_SECTION_INDIVIDUAL`、`WHAT_NOT_TO_SAVE_SECTION`、`WHEN_TO_ACCESS_SECTION`、`TRUSTING_RECALL_SECTION`）
- `paths.ts` — 记忆路径解析：`getAutoMemPath()`、`getAutoMemEntrypoint()`、`isAutoMemPath()`、`isAutoMemoryEnabled()`。支持环境覆盖（`CLAUDE_COWORK_MEMORY_PATH_OVERRIDE`）和 settings.json 覆盖，带安全验证
- `findRelevantMemories.ts` — 使用 Sonnet side query 从扫描清单中选择相关记忆文件（最多 5 个）。过滤已展示的记忆和最近使用的工具
- `memoryScan.ts` — 扫描记忆目录的 markdown 文件，解析 frontmatter 头
- `teamMemPaths.ts` / `teamMemPrompts.ts` — 团队记忆路径和组合提示词构建器（`TEAMMEM` 特性标志后）

**Notable patterns:**
- 两步保存流程（写文件 + 更新 MEMORY.md 索引）
- Assistant 会话的 daily-log 模式
- 路径验证带安全守卫，防止危险目录

---

### 2.30 src/moreright — MoreRight 功能

**Purpose:** 右侧附加信息面板（内部功能）。外部构建中使用 stub 实现。

**Key files:**
- `useMoreRight.tsx` — 提供三个生命周期 hook：
  - `onBeforeQuery(input, allMessages, n)` — 查询前拦截，返回 `false` 可阻断查询
  - `onTurnComplete(allMessages, aborted)` — 单轮完成后回调
  - `render()` — 返回 React 元素渲染到右侧面板

**Notable patterns:** 外部构建（public build）中的文件是 self-contained stub，无相对导入，直接返回 no-op 实现，避免暴露内部逻辑。

---

### 2.31 src/migrations — 数据迁移

**Purpose:** 用户设置和数据迁移脚本。每个迁移文件处理一次性的设置格式升级，确保用户配置在版本迭代间平滑过渡。

**Key files:**
- `migrateAutoUpdatesToSettings.ts` — 将自动更新配置迁移到 settings.json
- `migrateBypassPermissionsAcceptedToSettings.ts` — 迁移权限绕过接受标志
- `migrateEnableAllProjectMcpServersToSettings.ts` — 项目级 MCP 服务器启用状态迁移
- `migrateFennecToOpus.ts` — 模型别名 `fennec` → `opus`
- `migrateLegacyOpusToCurrent.ts` — 旧版 Opus 模型配置迁移
- `migrateOpusToOpus1m.ts` — Opus → Opus 1M 上下文窗口迁移
- `migrateReplBridgeEnabledToRemoteControlAtStartup.ts` — REPL Bridge 启用标志重命名
- `migrateSonnet1mToSonnet45.ts` / `migrateSonnet45ToSonnet46.ts` — Sonnet 模型版本链式升级
- `resetAutoModeOptInForDefaultOffer.ts` — 重置自动模式 opt-in 状态
- `resetProToOpusDefault.ts` — Pro 用户默认模型重置为 Opus

**Notable patterns:** 迁移按文件名单调顺序执行，幂等设计，失败记录日志但不阻断启动。

---

### 2.32 src/native-ts — 原生 TypeScript 模块

**Purpose:** 纯 TypeScript 移植的原生 Rust/NAPI 模块，消除某些平台的原生依赖。

**Subdirectories:**
- `color-diff/index.ts` — 颜色 diff 算法移植。语法高亮通过 highlight.js（懒加载），单词 diff 通过 `diff` 包的 `diffArrays`。实现 `ColorDiff` 和 `ColorFile` 类，ANSI escape 输出。支持 truecolor、256-color、ANSI 模式。主题：Monokai Extended（dark）、GitHub（light）、daltonized 变体
- `file-index/index.ts` — nucleo 模糊文件搜索移植。`FileIndex` 类，含 `loadFromFileList()`、`loadFromFileListAsync()`、`search()`。使用 bitmap 过滤、SIMD 加速 `indexOf` 扫描、top-k 排序数组
- `yoga-layout/index.ts` — Meta Yoga flexbox 引擎完整移植。
  - `Node` 类：style setter、`calculateLayout()`、dirty tracking、multi-entry layout cache、flex-basis cache、generation-based cache invalidation
  - 支持 flex-direction、flex-grow/shrink、alignment、justify-content、gaps、wrapping、absolute positioning、measure functions
  - `enums.ts` — Yoga 枚举定义（`Align`、`FlexDirection`、`Justify`、`Wrap` 等）

**Notable patterns:**
- 懒加载重依赖（highlight.js）
- 异步索引构建，带事件循环让出
- 大量布局缓存，带 generation 计数器
- 像素网格舍入匹配上游 Yoga

---

### 2.33 src/outputStyles — 输出样式

**Purpose:** 自定义输出风格加载器。允许用户和项目通过 Markdown 文件定义自定义的输出样式（如 "concise"、"verbose"、"chinese" 等），模型会在生成回复时遵循对应风格的提示词。

**Key files:**
- `loadOutputStylesDir.ts` — 样式加载器。扫描两个来源：
  1. 项目级 `.claude/output-styles/*.md`
  2. 用户级 `~/.claude/output-styles/*.md`（项目级覆盖用户级）
  - 文件名 = 样式名，文件内容 = 样式提示词（prompt）
  - Frontmatter 支持 `name`、`description`、`keep-coding-instructions`（是否保留默认编码指令）
  - 使用 `lodash-es/memoize` 缓存结果

**Notable patterns:** 与技能/插件系统类似的 Markdown 驱动配置，零代码即可自定义模型输出风格。

---

### 2.34 src/vendor — 第三方工具

**Purpose:** 捆绑的第三方二进制工具。

**Subdirectories:**
- `ripgrep/` — ripgrep 二进制文件
  - `x64-linux/` — Linux x64 版本

---

### 2.35 src/keybindings — 快捷键系统

**Purpose:** 全局和命令级快捷键管理。

**Key files:**
- `KeybindingProviderSetup.ts` — 快捷键 Provider 设置
- `KeybindingContext.ts` — 快捷键上下文
- `useKeybinding.ts` — 快捷键 hook
- `shortcutFormat.ts` — 快捷键格式化

---

### 2.36 src/schemas — 数据模式

**Purpose:** 提取到独立文件的 Zod Schema 定义，专门用于打破循环依赖。

**Key files:**
- `hooks.ts` — Hook 相关的 Zod schemas。原位于 `src/utils/settings/types.ts`，为避免 `settings/types.ts` ↔ `plugins/schemas.ts` 循环依赖而提取至此。
  - `IfConditionSchema` — 支持权限规则语法的 `if` 条件（如 `"Bash(git *)"`）
  - `BashCommandHookSchema` — 命令型 hook：shell、timeout、statusMessage、once/async/asyncRewake 标志
  - `PromptHookSchema` — LLM prompt 型 hook：prompt 模板、`$ARGUMENTS` 占位符
  - `AgentHookSchema` — Agent 型 hook：agent 类型、instructions、context

**Notable patterns:** 这是架构中专门的 "cycle breaker" 文件，当两个模块互相需要对方的 schema 时，将 schema 提取到此处作为共享依赖。

---

## 3. 关键数据流

### 3.1 主查询循环数据流

```
用户输入
   │
   ▼
┌──────────────┐
│ PromptInput  │ ──▶ 输入解析、历史管理、自动补全
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ processUserInput │ ──▶ 引用解析、命令检测、附件生成
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  QueryEngine │ ──▶ 组装 system prompt + messages + tools
│              │ ──▶ 调用 API（流式）
│              │ ──▶ 处理 tool_use 块
└──────┬───────┘
       │
   ┌───┴───┐
   ▼       ▼
文本响应  工具调用
            │
            ▼
      ┌──────────┐
      │ Tool执行  │ ──▶ Bash/Read/Edit/Write/Agent/...
      └────┬─────┘
           │
           ▼
      ┌──────────┐
      │ Tool结果  │ ──▶ 渲染结果、更新状态
      └────┬─────┘
           │
           ▼
      回到 QueryEngine（循环直到无 tool_use）
```

### 3.2 Agent 工具执行流

```
AgentTool 被调用
    │
    ▼
┌──────────────┐
│ 解析参数     │ ──▶ agent_type、task、instructions
└──────┬───────┘
       │
   ┌───┴───────────┐
   ▼               ▼
Inline 模式     Fork 模式
   │               │
   ▼               ▼
同上下文执行   创建 worktree/子进程
   │               │
   ▼               ▼
调用 query()    调用 forkedAgent.ts
   │               │
   ▼               ▼
┌──────────────┐  ┌──────────────┐
│ 执行工具循环  │  │ 独立进程循环  │
│ （共享状态）  │  │ （隔离状态）  │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
   返回结果          返回结果
       │                 │
       └────────┬────────┘
                ▼
         AgentTool 结果
```

---

## 4. 构建系统

### 4.1 构建脚本（`scripts/build.ts`）

**功能:**
- 使用 Bun bundler 打包 TypeScript
- 编译时特性标志系统（`feature('FLAG')`）
- 死代码消除（DCE）基于 `bun:bundle` 宏
- 支持 `--dev`、 `--compile`、 `--feature=`、 `--feature-set=dev-full`

**默认特性:** `VOICE_MODE`

**完整实验特性（54 个）:**
- `ULTRAPLAN`、 `ULTRATHINK`、 `VOICE_MODE`
- `BRIDGE_MODE`、 `AGENT_TRIGGERS`、 `EXTRACT_MEMORIES`
- `TOKEN_BUDGET`、 `BASH_CLASSIFIER`、 `MESSAGE_ACTIONS`
- 等（详见 `FEATURES.md`）

### 4.2 构建变体

| 命令 | 输出 | 特性 |
|------|------|------|
| `bun run build` | `./cli` | VOICE_MODE |
| `bun run build:dev` | `./cli-dev` | VOICE_MODE + dev stamp |
| `bun run build:dev:full` | `./cli-dev` | 全部 54 个实验特性 |
| `bun run compile` | `./dist/cli` | VOICE_MODE |

---

## 5. 功能标志系统

**实现:** `bun:bundle` 编译时宏 + `feature('FLAG')` 函数。

**特点:**
- 编译时确定：未启用的代码在打包时被完全消除
- 使用 `/* eslint-disable @typescript-eslint/no-require-imports */` 模式进行条件导入
- 运行时也可用 `process.env` 进行部分控制

**常用标志:**
```typescript
feature('ULTRAPLAN')      // 远程多代理规划
feature('VOICE_MODE')     // 语音输入
feature('BRIDGE_MODE')    // IDE 桥接
feature('AGENT_TRIGGERS') // 定时触发器
feature('KAIROS')         // 助手模式
feature('PROACTIVE')      // 主动模式
feature('BUDDY')          // Buddy 伴侣
```

---

## 6. 权限系统架构

### 6.1 权限模式

- `ask` — 每次询问用户
- `yes-to-all` — 全部允许（危险）
- `auto-edit` — 自动允许编辑
- `auto-bash` — 自动允许 bash
- `auto-write` — 自动允许写入

### 6.2 权限规则系统

- 基于 glob 匹配的工具名规则
- 支持按来源（skill、plugin、bundled）过滤
- 持久化到用户设置
- 支持 blanket deny（`mcp__server` 前缀拒绝整个 MCP 服务器）

### 6.3 审批流程

```
工具调用请求
    │
    ▼
检查 deny 规则 ──▶ 拒绝 ──▶ 返回拒绝结果
    │
    ▼
检查 permission mode ──▶ auto-allow ──▶ 执行
    │
    ▼
显示 PermissionRequest 组件 ──▶ 用户确认 ──▶ 执行
```

---

## 7. 多代理系统（Swarm）

### 7.1 架构

```
Leader Agent (主会话)
    │
    ├──▶ LocalAgentTask (forked 子代理)
    │       └── 独立 worktree，隔离文件系统
    │
    ├──▶ InProcessTeammateTask (同进程 teammate)
    │       └── AsyncLocalStorage 上下文隔离
    │
    ├──▶ RemoteAgentTask (远程 Agent)
    │       └── teleport 到云端执行
    │
    └──▶ DreamTask (后台记忆整合)
            └── 自动运行的 forked agent
```

### 7.2 通信机制

- **Mailbox**: 基于 React Context 的消息邮箱系统
- **SendMessageTool**: 代理间显式消息传递
- **Permission Sync**: 跨代理权限同步

---

## 8. 二次开发指南

### 8.1 添加新工具

1. 在 `src/tools/` 下创建新目录（如 `MyTool/`）
2. 创建以下文件：
   - `MyTool.ts` — 工具定义（名称、描述、输入 schema、执行函数）
   - `prompt.ts` — 工具的 prompt 说明（指导模型如何使用）
3. 在 `src/tools.ts` 的 `getAllBaseTools()` 中注册
4. 可选：在 `src/constants/prompts.ts` 的系统提示词中添加相关指导

### 8.2 添加新命令

1. 在 `src/commands/` 下创建新目录
2. 实现 `index.ts`，导出符合 `Command` 类型的对象
3. 在 `src/commands.ts` 中导入并加入 `COMMANDS` 数组

### 8.3 添加新组件

1. 在 `src/components/` 下创建组件目录或文件
2. 使用 Ink 的 `Box`、`Text`、`useInput` 等构建终端 UI
3. 在 `src/screens/REPL.tsx` 或相关父组件中集成

### 8.4 修改系统提示词

- 编辑 `src/constants/prompts.ts` 中的 `getSystemPrompt()` 函数
- 使用 `systemPromptSection()` 和 `DANGEROUS_uncachedSystemPromptSection()` 管理不同章节

### 8.5 添加实验性功能

1. 在 `scripts/build.ts` 的 `fullExperimentalFeatures` 数组中添加标志名
2. 在代码中使用 `feature('MY_FLAG')` 进行条件编译
3. 使用 `/* eslint-disable @typescript-eslint/no-require-imports */` 包裹条件导入

### 8.6 关键扩展点

| 扩展点 | 文件/目录 | 说明 |
|--------|-----------|------|
| 新工具 | `src/tools/` + `src/tools.ts` | 代理可调用的能力 |
| 新命令 | `src/commands/` + `src/commands.ts` | 用户 slash 命令 |
| 新技能 | `~/.claude/skills/` 或 `src/skills/bundled/` | Markdown 定义的技能 |
| 新插件 | `src/plugins/bundled/` | 更重的扩展机制 |
| 新 Agent | `src/tools/AgentTool/built-in/` | 预设代理模板 |
| 系统提示词 | `src/constants/prompts.ts` | 修改模型行为 |
| 权限规则 | `src/utils/permissions/` | 自定义权限逻辑 |
| MCP 服务器 | `src/services/mcp/` | 外部工具协议 |

---

## 9. 模块依赖关系

### 9.1 顶层依赖图

```
entrypoints/cli.tsx
    │
    ├──▶ screens/REPL.tsx
    │       ├──▶ components/ (UI)
    │       ├──▶ hooks/ (逻辑)
    │       ├──▶ commands/ (命令执行)
    │       └──▶ query.ts (查询)
    │
    ├──▶ state/AppState.tsx
    │       └──▶ state/AppStateStore.ts
    │
    └──▶ bootstrap/state.ts (全局状态)

query.ts
    ├──▶ services/api/claude.ts (API)
    ├──▶ tools/ (工具执行)
    └──▶ utils/messages.ts (消息处理)

tools.ts
    └──▶ tools/*/ (各工具实现)

commands.ts
    ├──▶ commands/*/ (各命令)
    ├──▶ skills/loadSkillsDir.ts
    └──▶ plugins/builtinPlugins.ts
```

### 9.2 循环依赖注意

- `tools.ts` ↔ `tools/TeamCreateTool/` / `tools/TeamDeleteTool`：通过懒加载 `require()` 打破
- `commands.ts` ↔ `tools/WorkflowTool/`：同样使用懒加载

---

## 10. 测试与质量

### 10.1 测试基础设施

- **框架:** 内置 Bun 测试运行器 (`bun test`)
- **类型:** TypeScript 6.x 严格模式
- **代码质量:** 自定义 ESLint 规则（见 `custom-rules/`）

### 10.2 关键内部命令（测试/调试用）

- `/debug-tool-call` — 调试工具调用
- `/ctx_viz` — 上下文可视化
- `/ant-trace` — 执行追踪（内部）
- `/perf-issue` — 性能问题报告
- `/mock-limits` — 模拟限制
- `/heapdump` — 堆转储

---

## 11. 安全架构

### 11.1 安全层次

1. **模型层**: Anthropic 的安全训练（不可移除）
2. **提示词层**: 系统提示词中的安全指导（本构建已剥离额外限制）
3. **权限层**: 用户可控的工具权限系统
4. **Sandbox 层**: Bash 命令的 sandbox 模式（`shouldUseSandbox`）
5. **文件系统层**: 路径验证、gitignore 检查

### 11.2 已移除的安全提示词

- 硬编码的拒绝模式
- 注入的 "cyber risk" 指令块
- 托管设置安全覆盖层

**注意**: 模型本身的安全训练仍然有效，只是移除了 CLI 额外包裹的提示词级限制。

---

## 12. 性能优化

### 12.1 启动优化

- 动态导入（`await import(...)`）延迟加载大模块
- `insights.ts`（113KB）懒加载
- 快速路径：`--version` 零依赖

### 12.2 运行时优化

- 文件状态缓存 (`fileStateCache.ts`)
- 提示词缓存（Anthropic API prefix caching）
- 自动上下文压缩 (`autoCompact.ts`)
- 推测执行 (`speculation.ts`)

### 12.3 构建优化

- 死代码消除（基于 `feature()` 宏）
- ripgrep 内嵌（避免外部依赖）
- 可选的 bfs/ugrep 内嵌搜索工具

---

## 13. 总结

这是一个架构复杂但组织良好的终端 AI 代理项目，核心特点：

1. **分层清晰**: UI 层 -> 命令层 -> 查询引擎 -> 工具层 -> 服务层
2. **高度可扩展**: 技能、插件、工具、命令都有标准化的扩展点
3. **多代理支持**: Inline、Fork、Remote、In-process 四种 Agent 执行模式
4. **编译时特性系统**: 88 个 feature flag，54 个可用，灵活的构建配置
5. **安全可控**: 多层权限系统，用户完全控制工具访问
6. **IDE 集成**: Bridge 模式支持 VS Code、JetBrains 远程控制
7. **终端原生**: Ink + React 提供丰富的 TUI 体验

对于二次开发，最关键的文件是：
- `src/tools.ts` / `src/tools/` — 扩展能力
- `src/commands.ts` / `src/commands/` — 扩展命令
- `src/constants/prompts.ts` — 修改模型行为
- `src/QueryEngine.ts` / `src/query.ts` — 修改查询逻辑
- `src/screens/REPL.tsx` — 修改主交互流程
- `scripts/build.ts` — 修改构建配置

# ONE AI Agent — Design System

> 设计基准：`docs/gemini_design.js`（React 原型）
> 预览文件：`docs/gemini-preview.html`
> 交付目标：Windows 桌面端 Electron `.exe`

---

## 1. Design Philosophy（美学方向）

**Rational Transparency（理性透明）**

本设计核心在于让 AI 的「思考过程」对用户可见，以此建立银行职员对自动化工具的信任感。视觉上采用工业实用主义（Industrial Utilitarian）：去装饰、重信息层级、高对比度语义色彩。没有毛玻璃、没有渐变阴影滥用，一切服务于效率与安全感。

---

## 2. Color System（色彩系统）

所有颜色均基于 Slate + Indigo + Amber + Emerald 的 Tailwind 调色板，支持亮色/暗色双主题。

### 2.1 语义色彩映射

| Token | 亮色模式 | 暗色模式 | 用途 |
|---|---|---|---|
| `--bg-base` | `bg-slate-100` (#F1F5F9) | `bg-slate-950` (#020617) | 最底层背景 |
| `--bg-surface` | `bg-white` (#FFFFFF) | `bg-[#0F172A]` (#0F172A) | 主内容区、卡片 |
| `--bg-sidebar` | `bg-slate-50` (#F8FAFC) | `bg-slate-900` (#0F172A) | 左侧边栏 |
| `--bg-sidebar-right` | `bg-white` / `bg-[#0B1120]` | — | 右侧面板底层 |
| `--border-default` | `border-slate-200` (#E2E8F0) | `border-slate-800` (#1E293B) | 默认边框 |
| `--border-subtle` | `border-slate-100` (#F1F5F9) | `border-slate-800` (#1E293B) | 弱分割线 |
| `--text-primary` | `text-slate-900` (#0F172A) | `text-slate-100` (#F1F5F9) | 主标题、正文 |
| `--text-secondary` | `text-slate-600` (#475569) | `text-slate-400` (#94A3B8) | 次要文字 |
| `--text-muted` | `text-slate-400` (#94A3B8) | `text-slate-500` (#64748B) | 辅助信息 |

### 2.2 品牌与状态色

| 语义 | 亮色 | 暗色 | 场景 |
|---|---|---|---|
| **Primary** | `text-indigo-600` / `bg-indigo-600` | `text-indigo-400` / `bg-indigo-500` | 主按钮、选中态、Logo |
| **Success** | `text-emerald-600` / `bg-emerald-500` | `text-emerald-400` | 完成状态、在线指示 |
| **Warning/Plan** | `text-amber-700` / `bg-amber-500` | `text-amber-300` / `bg-amber-500/20` | Plan 卡片、待确认操作 |
| **Danger** | `text-rose-600` | `text-rose-400` | 拒绝、删除、错误 |

### 2.3 模式专属配色（底部控制台）

| 模式 | 背景色（亮色） | 背景色（暗色） | 文字色 |
|---|---|---|---|
| Ask | `bg-slate-100/60` | `bg-slate-700/60` | `text-slate-600` / `text-slate-300` |
| Plan | `bg-amber-50` | `bg-amber-500/20` | `text-amber-700` / `text-amber-300` |
| Craft | `bg-indigo-50` | `bg-indigo-500/20` | `text-indigo-700` / `text-indigo-300` |

---

## 3. Typography（排版）

### 3.1 字体栈

```css
--font-sans: 'Geist Sans', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'SF Mono', monospace;
```

> 跨平台注意：Windows 目标环境优先回退到 `"Microsoft YaHei"`（微软雅黑），macOS 开发环境使用 `"PingFang SC"`。

### 3.2 字号规范

| 层级 | 尺寸 | 字重 | 行高 | Tailwind 类 |
|---|---|---|---|---|
| Logo | 18px | Bold (700) | 1.2 | `text-lg font-bold` |
| 页面标题 | 14px | Semibold (600) | 1.4 | `text-sm font-semibold` |
| 正文 | 14px | Normal (400) | 1.625 | `text-sm leading-relaxed` |
| 输入框 | 15px | Normal (400) | 1.625 | `text-[15px]` |
| 小字/标签 | 12px | Medium (500) | 1.5 | `text-xs font-medium` |
| 极小字 | 11px | Medium (500) | 1.4 | `text-[11px]` |
| 代码/文件名 | 12px | Mono | 1.4 | `text-xs font-mono` |

---

## 4. Layout Grid（布局网格）

### 4.1 三栏结构

```
┌─────────────────┬─────────────────────────────┬──────────────────┐
│   SidebarLeft   │         MainChat            │   SidebarRight   │
│   (Rail 模式)   │                             │                  │
│   w-64 / 68px   │       flex-1 (自适应)        │     w-[320px]    │
│                 │                             │                  │
│  Logo (h-14)    │   Header (h-14)             │  Tab Bar (h-10)  │
│  Nav            │                             │                  │
│  Workspace List │   Chat Stream               │  Files / Preview │
│                 │                             │                  │
│  Settings       │   ───────────────────────   │                  │
│                 │   Unified Console           │                  │
│                 │   (浮动底部输入区)            │                  │
└─────────────────┴─────────────────────────────┴──────────────────┘
```

### 4.2 断点与最小宽度

- 左侧面板展开：`w-64` (256px)；收起：`w-[68px]` (68px)
- 右侧面板：`w-[320px]` (320px)，关闭时 `w-0`
- 主聊天区：`min-w-0`（防止 flex 溢出）
- 用户消息气泡：`max-w-[85%]`，小屏上限 `sm:max-w-xl`
- 输入框容器：`max-w-3xl` 居中

---

## 5. Spacing Scale（间距规范）

基于 Tailwind 默认 4px 步进单位：

| Token | 值 | 使用场景 |
|---|---|---|
| `space-0.5` | 2px | 极紧凑内联间距 |
| `space-1` | 4px | 图标与文字间距 |
| `space-1.5` | 6px | 按钮内图标间距 |
| `space-2` | 8px | 控件内部 padding |
| `space-2.5` | 10px | 列表项横向间距 |
| `space-3` | 12px | 卡片内部 padding |
| `space-4` | 16px | 区块间距 |
| `space-6` | 24px | 聊天流垂直间距 |
| `space-8` | 32px | 输入区水平边距 (`sm:px-8`) |

---

## 6. Border Radius（圆角层级）

| Token | 值 | 使用场景 |
|---|---|---|
| `rounded-md` | 6px | 小按钮、标签、输入控件 |
| `rounded-lg` | 8px | 普通按钮、卡片内部容器 |
| `rounded-xl` | 12px | 卡片（PlanCard、ThinkingChain、产物卡片） |
| `rounded-2xl` | 16px | 用户消息气泡 |
| `rounded-[20px]` | 20px | 底部 Unified Console 输入容器 |
| `rounded-full` | 9999px | Avatar、状态指示灯 |

---

## 7. Motion Tokens（动效规范）

### 7.1 过渡时长

| 场景 | 时长 | Easing | Tailwind |
|---|---|---|---|
| 主题切换（深色/浅色） | 300ms | ease-in-out | `duration-300` |
| 侧边栏展开/收起 | 300ms | ease-in-out | `duration-300 ease-in-out` |
| 下拉菜单出现 | 100ms | ease-out | `duration-100` |
| 消息进入 | 500ms | ease-out | `animate-in fade-in slide-in-from-bottom-4 duration-500` |
| 计划卡片进入 | 500ms | ease-out | 自定义 `fadeUp` keyframe |
| Hover 透明度 | 150ms | ease | `transition-opacity` |

### 7.2 关键动画

```css
/* 消息滑入 */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 下拉菜单缩放 */
@keyframes zoomIn {
  from { opacity: 0; transform: scale(.95); }
  to   { opacity: 1; transform: scale(1); }
}

/* ThinkingChain 展开收起 */
max-height + opacity transition, duration-300 ease-in-out
```

---

## 8. Component Specs（关键组件规范）

### 8.1 User Message Bubble

- 背景：`bg-indigo-600`（亮）/ `bg-indigo-500`（暗）
- 文字：`text-white`
- 圆角：`rounded-2xl rounded-tr-sm`（左侧大圆角，右下小圆角形成指向）
- 阴影：`shadow-sm`
- Hover 操作：左侧悬浮 `Copy` 按钮，`opacity-0 group-hover:opacity-100`

### 8.2 AI Message Chain

- Avatar：40×40px 圆形渐变背景 `from-indigo-100 to-white`，带 1px 边框
- 内容最大宽度：`max-w-2xl`
- 包含三个子组件：ThinkingChain、PlanCard、FinalMessage

### 8.3 ThinkingChain（思维链）

- 外层：border `border-slate-200 dark:border-slate-700/60`，圆角 `rounded-xl`
- 头部按钮：全宽可点击，显示步骤数与展开/收起箭头
- 内容区：白色背景，步骤列表带时间戳与状态图标
- 挂起状态：`text-indigo-600` + `Loader2` 旋转动画

### 8.4 PlanCard（计划审批卡片）

- 背景：`bg-amber-50` / `bg-amber-900/10`
- 边框：`border-amber-200/60` / `border-amber-700/30`
- 头部：浅 amber 背景条 + `AlertCircle` 图标 + "执行计划待确认"
- 操作列表：白色内嵌容器，带 `CheckCircle2` 绿色图标
- 底部按钮：
  - 「批准执行」：`bg-amber-500 hover:bg-amber-600` 白色文字
  - 「拒绝」：白色背景 + 灰色边框
- 状态反馈：
  - approved → `text-emerald-600` + `CheckCircle2`
  - rejected → `text-rose-600` + `XCircle`
- **拒绝恢复**：用户点击"拒绝"后，PlanCard 不消失，在卡片下方原地展开微调输入框，预填原始需求，允许修改后点击"重新生成计划"。输入框样式同底部 Unified Console textarea，但高度固定为单行。

### 8.5 Unified Console（底部输入区）

- 外层容器：`rounded-[20px]`，白色/深色背景，`shadow-2xl`
- Focus 状态：`ring-4 ring-indigo-50` + `border-indigo-300`
- 内部分区：
  1. Context Pills（上下文胶囊）：`bg-emerald-50` 带文件名与删除按钮
  2. Textarea：透明背景，无 border，placeholder 灰色
  3. Control Console（底部工具栏）：
     - 模式切换下拉（左）
     - 模型切换下拉（中）
     - `@引入` + Paperclip（右）
     - 发送按钮：圆形 `rounded-xl`，有内容时 `bg-indigo-600` + 悬停上移效果

### 8.5.1 可点击区域（Touch Targets）防呆规范

为照顾 Windows 触屏设备（如 Surface）及触控板精度不足的场景，所有图标按钮（Icon Button）在视觉上保持精巧（14px 或 16px），但物理点击判定区必须放大：
- **禁止**使用过小的 padding（如 `p-1`）作为唯一热区。
- 必须显式声明固定宽高以撑开点击热区，统一使用：`w-8 h-8 flex items-center justify-center rounded-md`（确保最小触摸面积达到 **32×32px**）。
- 视觉尺寸保持 `w-3.5 h-3.5`（14px）或 `w-4 h-4`（16px）的图标，由外层容器负责撑开热区。

### 8.6 Empty State（空状态）

所有空状态统一采用极简方案，不画插画：
- 居中显示灰色 Lucide 图标（`text-slate-300 dark:text-slate-600`，尺寸 32×32）
- 下方 12px 灰色文案（`text-slate-400 dark:text-slate-500`）
- 示例：
  - 工作区列表空：`FolderOpen` + "暂无工作区，点击上方"新建"开始"
  - 产物列表空：`Layout` + "暂无生成产物"
  - 预览面板空：`Layout`（48×48，stroke-1）+ "暂无渲染内容" + 说明文案

### 8.7 Toast / Notification（通知系统）

基于 `sonner`，全局统一调用。禁止各组件自行实现 Toast。

| 类型 | 背景色 | 边框色 | 文字色 | 图标 |
|---|---|---|---|---|
| Success | `#F0FDF4` (`bg-emerald-50`) | `#86EFAC` | `#166534` | `CheckCircle2` |
| Error | `#FFF1F2` (`bg-rose-50`) | `#FDA4AF` | `#9F1239` | `XCircle` |
| Warning | `#FFFBEB` (`bg-amber-50`) | `#FCD34D` | `#92400E` | `AlertCircle` |

位置：右下角（`position: bottom-right`），最多同时显示 3 条，新 toast 从底部滑入。

### 8.8 File Drop Overlay（文件拖放视觉反馈）

- 触发：全局 `onDragEnter`，检测到文件拖拽进入窗口
- 遮罩：绝对定位覆盖主聊天区，`bg-indigo-50/80 dark:bg-indigo-900/30`
- 边框：`border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-xl`
- 内容：居中 `FileUp` 图标（`text-indigo-500`，32×32）+ 文案"松开鼠标上传文件"（`text-indigo-700 dark:text-indigo-300 font-medium`）
- 消失：`onDragLeave` 或 `onDrop` 后 150ms 淡出

### 8.9 Offline Banner（离线横幅）

- 位置：顶部固定，紧贴标题栏下方，z-index 最高
- 样式：`bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800`
- 文字：`text-rose-700 dark:text-rose-300 text-xs px-4 py-2`
- 文案："网络不可用，仅支持查看历史会话"
- 操作：右侧"重试"按钮（`text-rose-600 dark:text-rose-400 hover:underline text-xs font-medium`）
- 联动：横幅出现时，底部输入框 `disabled`，发送按钮置灰

### 8.10 Settings Dialog（系统设置）

- 形态：模态框（Dialog），非全屏路由页面
- 尺寸：宽度 400px，居中显示，带遮罩 `bg-black/30`
- 内容极简，仅两项：
  1. **主题切换**：`Switch` 控件，标签"深色模式"
  2. **API 基地址**：`Input` 输入框，标签"模型服务地址"，placeholder 为默认值
- 底部："保存"按钮（`bg-indigo-600 text-white rounded-lg px-4 py-2`）+ "取消"按钮（文字按钮）
- 不使用复杂表单，不引入 Ant Design Form

### 8.11 Day 0 Welcome（首次启动引导）

- 触发：`AppStateStore` 检测到本地无历史会话时自动注入
- 形态：普通 AI 消息气泡（非系统弹窗），融入聊天流
- 内容：
  - 标题文案："你好！我是你的专属 AI 办公助手。你可以直接将 Excel、Word 或 PDF 拖拽到这个窗口，或者试试点击下方的快捷指令："
  - Action Pills（3 个）：
    - `📊 "帮我分析并清洗 Excel 销售数据"`
    - `📝 "将这份文本排版为标准公文格式"`
    - `📊 "根据数据生成一份汇报 PPT"`
  - Pill 样式：`bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition`
  - 点击行为：直接将文本填入输入框并触发发送

---

## 9. Iconography（图标系统）

**统一使用 Lucide Icons**，禁止混用其他图标库。

| 场景 | 图标名 | 尺寸 |
|---|---|---|
| Logo | `Bot` | 20×20 |
| 新建工作区 | `Plus` | 20×20 |
| 全局搜索 | `Search` | 20×20 |
| 我的工作区 | `FolderKanban` | 20×20 |
| 本地工具库 | `Wrench` | 20×20 |
| 系统设置 | `Settings` | 20×20 |
| 菜单/折叠 | `Menu` | 20×20 |
| 右侧面板 | `PanelRight` | 20×20 |
| 深色/浅色切换 | `Sun` / `Moon` | 16×16 |
| 在线状态 | 自定义小圆点 + `Globe` | — |
| 发送 | `Send` | 16×16 |
| 附件 | `Paperclip` | 16×16 |
| @上下文 | `AtSign` | 14×14 |
| 模式图标 Ask | `MessageCircle` | 14×14 |
| 模式图标 Plan | `BrainCircuit` | 14×14 |
| 模式图标 Craft | `Zap` | 14×14 |
| 模型选择 | `Cpu` | 14×14 |
| 复制 | `Copy` | 14×14 |
| 重新生成 | `RotateCcw` | 14×14 |
| 展开/收起 | `ChevronUp` / `ChevronDown` | 14×14 |
| 成功/完成 | `CheckCircle2` | 14×14 |
| 警告 | `AlertCircle` | 16×16 |
| 拒绝/错误 | `XCircle` | 16×16 |
| 加载中 | `Loader2` | 14×14 |
| Word 文件 | `FileText` | 32×32 |
| Excel 文件 | `FileSpreadsheet` | 32×32 |
| 预览 | `Eye` | 14×14 |
| 下载/打开 | `Download` | 14×14 |

---

## 10. State Definitions（交互状态清单）

### 10.1 全局状态

| State | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `isLeftOpen` | boolean | `true` | 左侧边栏展开/收起 |
| `isRightOpen` | boolean | `true` | 右侧边栏展开/收起 |
| `isDarkMode` | boolean | `false` | 深色模式开关 |
| `workMode` | `'Ask' \| 'Plan' \| 'Craft'` | `'Plan'` | 当前工作模式 |
| `selectedModel` | string | `'Minimax 2.5'` | 当前选中模型 |
| `rightTab` | `'files' \| 'preview'` | `'files'` | 右侧面板当前标签 |

### 10.2 会话级状态

| State | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `planStatus` | `'pending' \| 'approved' \| 'rejected'` | `'pending'` | Plan 卡片审批状态 |
| `planRetryText` | string | `''` | Plan 被拒绝后微调输入框的预填内容 |
| `isThoughtOpen` | boolean | `true` | ThinkingChain 展开/收起 |
| `inputText` | string | `''` | 输入框内容 |
| `isInputDisabled` | boolean | `false` | 输入框禁用（离线或有待审批 Plan 时） |
| `showModeDropdown` | boolean | `false` | 模式选择下拉可见性 |
| `showModelDropdown` | boolean | `false` | 模型选择下拉可见性 |
| `isOffline` | boolean | `false` | 网络离线状态 |
| `isDragActive` | boolean | `false` | 文件拖拽悬停状态 |
| `showSettings` | boolean | `false` | Settings Dialog 可见性 |
| `isNewWorkspaceEditing` | boolean | `false` | 新建工作区输入状态 |

---

## 11. Safe vs Risk Design Decisions（设计决策记录）

### ✅ Safe（已验证，可直接采用）

1. **Slate + Indigo 主色调**：中性灰底 + 靛蓝品牌色，符合 B 端金融系统审美惯例，无情绪冲突。
2. **Amber 作为 Plan 专属色**：暖黄色天然带有「需要关注」的语义，与审批场景完美契合。
3. **底部 Unified Console**：将输入、模式、模型、附件整合在一个浮动容器中，减少视觉跳跃。
4. **思维链可折叠**：默认展开显示执行过程，满足「透明」理念；用户可收起减少干扰。
5. **圆角分层体系**：20px（输入容器）> 16px（气泡）> 12px（卡片）> 8px（按钮），层级清晰。
6. **Lucide 图标全局统一**：线条风格一致，开源可商用，与 Tailwind 生态兼容。

### ⚠️ Risk（需注意的实现细节）

1. **暗色模式自定义色值**：`#0F172A` 和 `#0B1120` 不是标准 Tailwind Slate 色值，需要在 Tailwind 配置中通过 `extend` 或 CSS 变量显式定义。
2. **Windows 字体渲染**：Geist 字体在 Windows 上的渲染可能与 macOS 有差异，需要实际测试 `"Microsoft YaHei"` 回退效果。
3. **右侧面板最小宽度**：`min-w-[20rem]` 在右侧面板关闭时可能产生布局溢出，需配合 `overflow-hidden` 使用。
4. **输入框高度自适应**：原型使用固定 `rows={2}`，实际产品需要实现根据内容自适应高度（`textarea` auto-resize）。
5. **Dropdown z-index 层级**：底部输入区的下拉菜单需要确保 `z-50` 高于聊天流和侧边栏。

---

## 12. Dark Mode Strategy（深色模式策略）

采用 **CSS Class 切换方案**（`darkMode: 'class'`），由顶层容器控制：

```tsx
<div className={isDarkMode ? 'dark' : ''}>
  <div className="bg-slate-100 dark:bg-slate-950 ...">
    {/* 所有子元素使用 dark: 变体 */}
  </div>
</div>
```

切换按钮位于顶部状态栏右侧，图标在 `Sun`（深色模式下显示，点击切浅色）与 `Moon`（浅色模式下显示，点击切深色）之间切换。

---

## 13. Accessibility & Banking Compliance（无障碍与合规）

1. **颜色对比度**：所有正文文字与背景对比度需满足 WCAG AA 标准（4.5:1）。
2. **操作确认**：Plan 模式下的「批准执行」按钮使用高对比度 Amber 色，防止误触。
3. **敏感数据提示**：底部固定显示免责声明「AI 可能会犯错。处理涉及财务或敏感数据前，请核实生成内容。」
4. **焦点状态**：输入框 Focus 时有明确的 `ring-4` 蓝色光晕，键盘导航可见。
5. **图标语义**：所有功能性图标必须有 `title` 属性或 `aria-label`。

---

*Document version: 2026-05-12*
*Based on: docs/gemini_design.js (React Prototype) & docs/gemini-preview.html (Interactive HTML)*

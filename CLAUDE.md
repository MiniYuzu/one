# 跨平台开发规范 (Mac Dev -> Windows Target)

当前项目在 macOS 环境下开发，但最终交付目标为 Windows 桌面端 `.exe`。在编写、重构或提供代码建议时，必须严格遵守以下跨平台防御性编程规范：

## 1. 路径处理原则 (Path Handling)
- **绝对禁止硬编码路径分隔符**：永远不要在代码中使用 `/` 或 `\` 拼接路径。
- **强制使用内置模块**：必须使用 Node.js 的 `path.join()`, `path.resolve()`, `path.normalize()` 来处理所有文件路径。
- **动态获取系统目录**：严禁硬编码 `~/.app` 或 `C:\Users\...` 等绝对路径。必须使用 Electron 提供的标准 API 获取系统目录：
  - 用户数据：`app.getPath('userData')` (对应 Windows `%APPDATA%`)
  - 临时文件：`app.getPath('temp')`
  - 桌面目录：`app.getPath('desktop')`

## 2. 文件系统大小写与换行符 (File System & CRLF)
- **严格区分大小写**：Windows 文件系统默认不区分大小写，但 macOS 区分。在 `import` 或 `require` 模块时，路径字母的大小写必须与实际文件名 **100% 完全一致**。
- **文件流处理**：在读取或写入 `.txt`, `.csv`, `.md` 等文本文件时，遇到换行符拆分必须兼容 `\r\n` (Windows) 和 `\n` (Unix)，优先使用正则表达式 `/\r?\n/` 进行按行分割。

## 3. 子进程与系统命令 (Child Process & Shell)
- **禁止使用 Unix 专属 Shell 命令**：在使用 `child_process.exec` 或类似工具时，严禁使用 `rm -rf`, `cp`, `ls` 等命令。
- **跨平台替代方案**：
  - 删除文件/目录：使用 Node.js 内置的 `fs.promises.rm({ recursive: true, force: true })` 或引入 `rimraf`。
  - 复制文件：使用 `fs.promises.copyFile`。
- **执行外部脚本**：必须显式判断系统环境 `if (process.platform === 'win32')`，对 Windows 环境调用 `.cmd` 或 `.bat`，对 Mac 环境调用 `.sh`。

## 4. 环境变量与 Scripts 兼容 (NPM Scripts)
- **配置注入**：在 `package.json` 的 scripts 中设置环境变量时，必须使用 `cross-env`（例如：`cross-env NODE_ENV=development vite`），绝对不能使用 `NODE_ENV=development vite`。

## 5. Electron 窗口与 IPC 通信规范
- **窗口透明与阴影**：Windows 和 macOS 对 `BrowserWindow` 的 `transparent`、`frame: false` 和 `vibrancy` 支持差异巨大。若无特殊说明，UI 设计避免使用 Mac 专属的毛玻璃效果。
- **IPC 隔离**：严格开启 `contextIsolation: true` 和 `nodeIntegration: false`，所有跨进程通信必须通过 `preload.ts` 中的 `contextBridge.exposeInMainWorld` 暴露带 TypeScript 类型定义的接口。

## 6. 设计系统参考 (Design System)
- **权威设计文档**：`DESIGN.md`（由 `/design-consultation` 生成，基于 `docs/gemini_design.js` 原型）
- **交互预览**：`docs/gemini-preview.html`（可直接在浏览器中打开预览所有交互状态）
- **核心 aesthetic**：Rational Transparency（理性透明）—— 将 AI 思考过程可视化以建立银行职员信任
- **色彩系统**：Slate 中性灰底 + Indigo 品牌色 + Amber 计划审批 + Emerald 成功状态；支持亮色/暗色双主题
- **字体栈**：`Geist Sans` + `Geist Mono`，Windows 回退 `"Microsoft YaHei"`
- **布局结构**：三栏式（左 Rail 导航 256px/68px，中聊天流自适应，右产物面板 320px）
- **圆角层级**：20px(输入容器) > 16px(气泡) > 12px(卡片) > 8px(按钮)
- **动效规范**：主题切换/侧边栏 300ms ease-in-out，下拉菜单 100ms，消息进入 500ms fade-up
- **图标系统**：全局统一使用 **Lucide Icons**，禁止混用其他图标库
- **工作模式**：Ask(只读对话)、Plan(需审批)、Craft(自动执行) —— 底部统一控制台切换
- **合规要求**：Plan 卡片审批使用高对比度 Amber 色防止误触；底部固定显示 AI 免责声明

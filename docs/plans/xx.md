改造一：动态 Token 截断策略（防超限防 OOM）
free-code 的核心思路：Token 预算账本 (Budget Tracker) + 上下文折叠 (Context Collapse)
它摒弃了我们原计划中粗暴的“按轮数截断”或“按字符估算”。它在发起请求前，会严格计算 Token 预算。当预算吃紧时，它不会生硬地把头部历史记录直接扔掉，而是触发一个后台任务，调用模型把早期的几十条废话对话“提炼/折叠”成一段精简的摘要（Summary），从而在保证逻辑连贯的前提下释放大量上下文空间。

你要让本地模型查找的源码文件：

src/query/tokenBudget.ts

寻宝重点： 让模型解释 createBudgetTracker() 和 checkTokenBudget() 函数，看看真正的商业级客户端是怎么精打细算控制 Token 花销的。

src/services/contextCollapse/index.ts

寻宝重点： 了解当上下文过长时，它是如何触发“折叠”动作的，以及折叠后的数据结构长什么样。

src/services/compact/autoCompact.ts

寻宝重点： 看看触发自动压缩（Compact）的阈值条件是怎么判断的。


改造二：无痕断流续写机制（消除幻觉开场白）
free-code 的核心思路：严格状态机 (State Machine) + 网络层退避重试 (Exponential Backoff)
它坚决不使用“在提示词里强迫模型去掉问候语接着写”这种 Hack 手段。因为不同模型对这种指令的容忍度极差。它的做法是将整个聊天过程严格定义为状态机（idle -> querying -> tool_use -> idle）。
如果在请求初期遇到网络波动，底层的重试包装器会进行指数退避重试；如果是在生成中途彻底断流，状态机会安全地截断当前进度，抛出异常并退回 idle 状态，把“是否重发”的选择权交给用户，绝不污染对话上下文。

你要让本地模型查找的源码文件：

src/services/api/withRetry.ts

寻宝重点： 查看这个通用重试包装器是如何区分“可恢复错误（如网络断开、502）”和“不可恢复错误（如 401 鉴权失败）”的，以及指数退避算法的具体实现。

src/query/QueryEngine.ts

寻宝重点： 这是整个项目的大脑。让模型帮你梳理它是如何管理多轮对话状态流转的，重点看它在捕获到网络中断错误时，是如何处理已经生成了一半的消息的。

src/services/api/claude.ts

寻宝重点： 看看它最底层的流式 API 请求（SSE 接收）是怎么写出来的。


改造三：异步防抖与安全落盘策略（解决 EBUSY 崩溃）
ree-code 的核心思路：平面队列 (Flat Queue) + Drain 循环 + JSONL 追加
它彻底抛弃了 fs.writeFile 全量覆盖的做法。对话日志被视为“流水账”，使用 JSONL（按行分割的 JSON）格式。内存里只维护一个一维数组（平面队列），来了一条新消息就 push 进去。后台有一个不阻塞主线程的死循环（Drain 循环），慢悠悠地把队列里的数据用追加模式（O_APPEND）刷入磁盘。结合操作系统的安全文件标志（O_NOFOLLOW），完美避开 Windows 文件锁死。

你要让本地模型查找的源码文件：

src/utils/task/diskOutput.ts

寻宝重点： 让模型给你看 DiskTaskOutput 类的实现。重点观察它是如何避免 Promise 闭包链导致内存泄漏的，以及那个神秘的“drain 循环”具体是怎么写的。

src/utils/sessionStorage.ts

寻宝重点： 看看它是如何把会话数据格式化为 JSONL 并调用底层写入的。


4. 范围裁剪
  当前计划未包含 Settings Dialog（设置弹窗）和 File Drag-and-Drop 的文件解析处理，都先不做，加入到计划最下方的 todo 中

5. 会话持久化方案：坚决反对纯同步的 writeFileSync + renameSync
存储格式：从“全量覆盖”升级为 “JSONL 追加”
我之前建议的 writeFile + rename 虽然安全，但在处理不断增长的对话记录时，每次都要重写整个文件，效率会越来越低。free-code 采用了 JSONL (JSON Lines) 格式。

核心逻辑： 每一条消息或每一个事件都被序列化为单行 JSON，然后直接使用 fs.appendFile 追加到文件末尾。

优势： 追加操作在底层是非常轻量且原子的，它极大地避开了 Windows 上的文件锁冲突（EBUSY）。即使程序在写入时崩溃，也只会丢失最后一行，而不会损坏整个历史文件。

参考路径： * src/utils/sessionStorage.ts：定义了会话转录的存储结构。

src/utils/sessionStoragePortable.ts：跨平台的会话存储实现。

2. 写入机制：异步排水队列 (Drain Queue)
free-code 在处理磁盘 I/O 时，为了绝对不阻塞主循环并保证内存安全，实现了一个精巧的任务输出框架。

核心逻辑： 它不直接调用写入函数，而是将待写入的数据推入一个平面队列（Flat Queue）。后台有一个独立的 Drain 循环，它会持续检查队列并按顺序将数据“排”到硬盘上。

工程细节： 这个机制避免了大量的 Promise 闭包堆积在内存中，防止了在高频输出（如流式生成）时导致的内存抖动。

参考路径：

src/utils/task/diskOutput.ts：查看 DiskTaskOutput 类。这是解决你提到的“落盘策略”最核心的代码。重点观察它是如何利用队列和异步循环来管理磁盘写入的。

3. 会话恢复：灾难恢复与按需加载
Claude CLI 的“不显示历史”其实是为了保持终端的简洁。它实现了一套完整的“恢复屏幕（Resume Screen）”逻辑。

核心逻辑： 它通过读取保存的 JSONL 日志，逐步重建（Rehydrate）内存中的消息状态。

参考路径：

src/screens/ResumeConversation.tsx：这里展示了它是如何处理“渐进式加载”历史记录的。你可以参考这个组件来实现你的 ONE 桌面端在启动时“丝滑”地恢复之前的对话列表。

src/commands/resume/：查看恢复命令的入口逻辑。


6. UI 术语统一：完全赞同，需严格划清概念边界
评估： 这是典型的前期设计残留导致的概念混淆，必须在 Phase 1 彻底纠正。

概念隔离建议：

会话（Session）： 仅仅代表一条线性的、有上下文状态的对话时间线（Message History）。侧边栏必须改为“最近会话”。

工作区（Workspace / Sandbox）： 在未来的 Phase 2 中，这个词应该被严格保留给上下文沙箱或 MCP (Model Context Protocol) 挂载点。例如，用户将一个特定的本地 Git 仓库目录挂载到客户端，AI 的操作范围被限制在该目录内，这才是真正的 Workspace。两者在底层数据结构和 UI 呈现上是完全不同的维度。
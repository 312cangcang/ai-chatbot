# 简历项目描述

> 🌐 **在线 Demo**：<https://ai-chatbot-one-rust.vercel.app>　|　📦 **代码**：<https://github.com/312cangcang/ai-chatbot>

针对不同情境我写了 4 个版本，从短到长。直接复制粘贴用。

> 💡 **简历写法建议**：写简历时记得把 **Live Demo URL** 也带上 —— 招聘官能 1 秒打开试玩远胜过 100 字描述。

---

## 版本 1：超精简（150 字 / 一行块）

> **AI Chatbot Web Agent** · Next.js 14 · TypeScript · DeepSeek API · Function Calling · [Live Demo](https://ai-chatbot-one-rust.vercel.app) · [GitHub](https://github.com/312cangcang/ai-chatbot)
> 
> 5 天独立开发并部署上线的 ChatGPT 式流式对话 Web Agent。**不依赖 Vercel AI SDK / LangChain 等封装**，手写 SSE 协议解析、`ReadableStream` + `TextDecoder` 处理 TCP 粘包/UTF-8 多字节切分；实现可中断流式生成（`AbortController`）、多对话管理（含流式中切换/删除边界处理）、`localStorage` 持久化、Markdown + 代码高亮等产品级特性。**Day 5 升级为 Agent**：实现 OpenAI Tool Calling 多轮循环（最多 5 轮）、同轮工具 `Promise.all` 并行执行、扩展 SSE 协议（`type: text/tool_start/tool_result`）、工具调用 UI 卡片。

---

## 版本 2：STAR 结构（250 字 / 简历项目段落首选）

> **AI Chatbot Web Agent** ｜ 个人项目 ｜ 2026.05  
> **技术栈**：Next.js 14 (App Router) / React 18 / TypeScript / Tailwind CSS / DeepSeek API / OpenAI Function Calling
> 
> - **背景**：为深入理解 LLM 应用底层协议，从零手写流式对话应用并升级为支持工具调用的 Web Agent，刻意不使用 Vercel AI SDK / LangChain 等高层封装。
> - **关键实现**：
>   - 服务端基于 `ReadableStream` + `TextEncoder` 转发 SSE 流；前端基于 `getReader()` + `TextDecoder({ stream: true })` 解决 **TCP 粘包**与 **UTF-8 多字节字符跨包切分**问题
>   - 通过 `AbortController` 实现**可中断的流式生成**，并处理"流式中切换对话""流式中删除对话"等并发边界
>   - 设计**单一数据源**状态模型（`Conversation[]` + `currentId` 派生当前对话）解决多对话场景的状态一致性问题
>   - 实现 **OpenAI Function Calling 多轮工具循环**（`while` + `MAX_ROUNDS=5` 防死循环），支持**同轮多工具 `Promise.all` 并行执行**
>   - 扩展 SSE 协议加 `type` 字段（`text` / `tool_start` / `tool_result`），实现**流式文字与工具事件混合传输**
>   - 配置 `X-Accel-Buffering: no` 解决 Nginx 反代下的流式缓冲问题
> - **成果**：5 天完成可上线产品形态——Day 1-4 完成 ChatGPT 式 Web App，Day 5 升级为 Agent 支持时间/计算/天气工具调用，含 10+ 项产品级特性。代码 0 lint 错误，[完整复盘博客](https://github.com/312cangcang/ai-chatbot/blob/main/docs/BLOG.md)。

---

## 版本 3：技术亮点列表（适合详细技术面 / 项目经历铺开版）

> **AI Chatbot Web Agent** ｜ <https://github.com/312cangcang/ai-chatbot>
> 
> 一个从零实现的 ChatGPT 式流式对话 Web Agent，**未使用任何 chatbot 框架**（如 Vercel AI SDK、LangChain），目的是吃透 LLM 应用的底层协议、流式 SSE、以及 Function Calling 完整闭环。
> 
> **核心技术亮点**
> 
> 1. **手写 SSE 流式协议（端到端）**
>    - 服务端：`OpenAI SDK 异步迭代器` → `ReadableStream` → `TextEncoder` → SSE 格式响应
>    - 客户端：`fetch().body.getReader()` → `TextDecoder({ stream: true })` → buffer 切分 → 增量渲染
>    - 处理了 TCP 粘包/拆包、UTF-8 多字节切分、Nginx 反代缓冲等真实生产问题
> 
> 2. **Function Calling 多轮工具调用循环（核心 Agent 能力）**
>    - 实现 OpenAI Tool Calling 完整协议：累积流式 `tool_calls` chunk → 按 `tool_call_id` 严格配对 `role: 'tool'` 回单
>    - `while` 循环 + `MAX_ROUNDS=5` 防死循环；同一轮内多个工具用 `Promise.all` **并行执行**
>    - 扩展 SSE 协议加 `type` 字段（`text` / `tool_start` / `tool_result`），实现**文字流和工具事件混合传输**
>    - 工具集：`get_current_time`（弥补 LLM 时间盲）、`calculator`（弥补 LLM 算数不准）、`get_weather`（mock）
>    - 工具调用 UI 卡片：转圈 → 完成 → 可展开看 args/result
> 
> 3. **可中断流式（`AbortController`）**
>    - 客户端 fetch 取消，服务端响应 `req.signal` 中断 LLM 调用，避免取消后继续烧 token
> 
> 4. **多对话状态管理（单一数据源）**
>    - 唯一可信源：`Conversation[]` 数组；`current` 由 `useMemo` 派生，避免双 state 不一致
>    - 流式过程中**捕获目标对话 id**，支持"发消息后切走仍正确累积"的 ChatGPT 行为
> 
> 5. **客户端持久化（含坑位规避）**
>    - 使用 `hydrated` 标志位避免初始空状态覆盖已有 localStorage 数据
>    - 版本化 storage key（`v2`）支持数据结构平滑升级
>    - "空对话不持久化"——保存时过滤，刷新自动清理
> 
> 6. **产品级 UI 细节**
>    - Tailwind `group` + `group-hover` 实现 hover 联动；侧边栏宽度过渡动画 + `overflow-hidden` 折叠
>    - Inline 重命名：`Enter`/`Esc`/`onBlur`/`stopPropagation` 4 个细节缺一不可
>    - "流式状态指示"：列表项动画绿点提示用户哪个对话正在生成
>    - 智能滚动锁定：底部吸附 + 用户上滑解锁
> 
> 7. **Markdown 渲染**：`react-markdown` + `remark-gfm` + `react-syntax-highlighter`，含代码块一键复制
> 
> **工程化**
> - 0 lint 错误、0 类型错误，TypeScript 全程严格模式
> - 完整的 [技术复盘博客](https://github.com/312cangcang/ai-chatbot/blob/main/docs/BLOG.md)（Day 1-5 全过程，覆盖核心踩坑与思考）
> - 已部署上线 Vercel：<https://ai-chatbot-one-rust.vercel.app>
> - 清晰的 git 历史 + MIT License + 详细 README

---

## 版本 4：一句话标语（适合放 LinkedIn headline / 个人主页 hero）

> "5 days from `create-next-app` to a production-grade ChatGPT-style **Web Agent** — no SDK shortcuts, hand-written SSE, multi-conversation, abortable streams, **OpenAI Function Calling with multi-round tool loop & parallel execution**."

或中文：

> "5 天，从 `create-next-app` 到一个产品级 ChatGPT 仿品并升级为 Web Agent —— 不抄 SDK 捷径，手写 SSE 协议、多对话管理、可中断流式、**Function Calling 多轮工具调用循环**。"

---

## 面试时怎么讲（30 秒电梯演讲 · Day 5 升级版）

> "我用 5 天从零写了一个流式多对话 Web Agent，特意不用 Vercel AI SDK / LangChain 那种封装框架，目的是搞清楚两件事：**SSE 协议**和 **Function Calling 闭环**。
> 
> 前 4 天搞定流式 SSE——TCP 一次 read 可能不是一条完整消息，UTF-8 中文 3 字节可能被切到两次 read，Nginx 默认会缓冲流式响应——这些只有手写一次才会真正遇到。
> 
> 第 5 天升级为 Agent：实现了 OpenAI Function Calling 多轮循环——AI 决定喊工具，后端 `Promise.all` 并行执行同一轮里的多个工具，结果按 `tool_call_id` 严格配对塞回 messages，再次喂给 AI 直到它不再喊工具。**关键是流式文字和工具事件要在同一个 SSE 流里混合传输**——我扩展了 SSE 协议加 `type` 字段（`text` / `tool_start` / `tool_result`），前端按 type 分发到不同的 UI 渲染。
> 
> 状态层面有个我比较得意的设计：流式过程中允许用户切换对话，原对话回复仍在后台累积。这个项目让我对 LLM 应用底层有了一手理解，再用 SDK 时就知道每个 API 在抽象什么。"

---

## 给招聘官看的"硬指标"

如果你的简历筛选偏向数字党，这些是可量化的点：

- **代码量**：~ 1300 行 TypeScript（不含依赖）
- **0 错误**：lint / type-check 全绿
- **特性数**：12+ 项产品级功能（流式、可中断、多对话、持久化、Markdown、代码高亮、复制、滚动锁定、侧边栏折叠、内联重命名、状态指示动画、**Function Calling 工具调用**）
- **Agent 能力**：3 个内置工具 + 多轮 Tool Loop（最多 5 轮）+ 同轮工具并行执行
- **文档**：技术复盘博客（Day 1-5 全过程）+ 详细 README + License
- **部署**：上线 Vercel，含 `maxDuration` 配置坑位规避
- **开发周期**：5 天 / 个人

---

## 仓库链接整理

| 用途 | 链接 |
|---|---|
| 仓库主页 | https://github.com/312cangcang/ai-chatbot |
| 在线 Demo | https://ai-chatbot-one-rust.vercel.app |
| 技术博客 | https://github.com/312cangcang/ai-chatbot/blob/main/docs/BLOG.md |

# 简历项目描述

> 🌐 **在线 Demo**：<https://ai-chatbot-one-rust.vercel.app>　|　📦 **代码**：<https://github.com/312cangcang/ai-chatbot>

针对不同情境我写了 4 个版本，从短到长。直接复制粘贴用。

> 💡 **简历写法建议**：写简历时记得把 **Live Demo URL** 也带上 —— 招聘官能 1 秒打开试玩远胜过 100 字描述。

---

## 版本 1：超精简（120 字 / 一行块）

> **AI Chatbot Web** · Next.js 14 · TypeScript · DeepSeek API · [Live Demo](https://ai-chatbot-one-rust.vercel.app) · [GitHub](https://github.com/312cangcang/ai-chatbot)
> 
> 4 天独立开发并部署上线的 ChatGPT 式流式对话 Web 应用。**不依赖 Vercel AI SDK 等封装**，手写 SSE 协议解析、`ReadableStream` + `TextDecoder` 处理 TCP 粘包/UTF-8 多字节切分；实现可中断流式生成（`AbortController`）、多对话管理（含流式中切换/删除边界处理）、`localStorage` 持久化、Markdown + 代码高亮、可折叠侧边栏、内联重命名等完整产品级特性。

---

## 版本 2：STAR 结构（200 字 / 简历项目段落首选）

> **AI Chatbot Web App** ｜ 个人项目 ｜ 2026.05  
> **技术栈**：Next.js 14 (App Router) / React 18 / TypeScript / Tailwind CSS / DeepSeek API
> 
> - **背景**：为深入理解 LLM 应用底层协议，从零手写流式对话应用，刻意不使用 Vercel AI SDK 等高层封装。
> - **关键实现**：
>   - 服务端基于 `ReadableStream` + `TextEncoder` 转发 SSE 流；前端基于 `getReader()` + `TextDecoder({ stream: true })` 解决 **TCP 粘包**与 **UTF-8 多字节字符跨包切分**问题
>   - 通过 `AbortController` 实现**可中断的流式生成**，并处理"流式中切换对话""流式中删除对话"等并发边界
>   - 设计**单一数据源**状态模型（`Conversation[]` + `currentId` 派生当前对话）解决多对话场景的状态一致性问题
>   - 配置 `X-Accel-Buffering: no` 解决 Nginx 反代下的流式缓冲问题
> - **成果**：4 天完成可上线产品形态，含多对话管理、持久化、Markdown 渲染、代码高亮、内联重命名、可折叠侧栏等 10+ 项产品级特性。代码 0 lint 错误，[完整复盘博客 4000 字](https://github.com/312cangcang/ai-chatbot/blob/main/docs/BLOG.md)。

---

## 版本 3：技术亮点列表（适合详细技术面 / 项目经历铺开版）

> **AI Chatbot Web App** ｜ <https://github.com/312cangcang/ai-chatbot>
> 
> 一个从零实现的 ChatGPT 式流式对话 Web 应用，**未使用任何 chatbot 框架**（如 Vercel AI SDK、LangChain），目的是吃透 LLM 应用的底层协议与工程实现。
> 
> **核心技术亮点**
> 
> 1. **手写 SSE 流式协议（端到端）**
>    - 服务端：`OpenAI SDK 异步迭代器` → `ReadableStream` → `TextEncoder` → SSE 格式响应
>    - 客户端：`fetch().body.getReader()` → `TextDecoder({ stream: true })` → buffer 切分 → 增量渲染
>    - 处理了 TCP 粘包/拆包、UTF-8 多字节切分、Nginx 反代缓冲等真实生产问题
> 
> 2. **可中断流式（`AbortController`）**
>    - 客户端 fetch 取消，服务端响应 `req.signal` 中断 LLM 调用，避免取消后继续烧 token
> 
> 3. **多对话状态管理（单一数据源）**
>    - 唯一可信源：`Conversation[]` 数组；`current` 由 `useMemo` 派生，避免双 state 不一致
>    - 流式过程中**捕获目标对话 id**，支持"发消息后切走仍正确累积"的 ChatGPT 行为
> 
> 4. **客户端持久化（含坑位规避）**
>    - 使用 `hydrated` 标志位避免初始空状态覆盖已有 localStorage 数据
>    - 版本化 storage key（`v2`）支持数据结构平滑升级
>    - "空对话不持久化"——保存时过滤，刷新自动清理
> 
> 5. **产品级 UI 细节**
>    - Tailwind `group` + `group-hover` 实现 hover 联动；侧边栏宽度过渡动画 + `overflow-hidden` 折叠
>    - Inline 重命名：`Enter`/`Esc`/`onBlur`/`stopPropagation` 4 个细节缺一不可
>    - "流式状态指示"：列表项动画绿点提示用户哪个对话正在生成
>    - 智能滚动锁定：底部吸附 + 用户上滑解锁
> 
> 6. **Markdown 渲染**：`react-markdown` + `remark-gfm` + `react-syntax-highlighter`，含代码块一键复制
> 
> **工程化**
> - 0 lint 错误、0 类型错误，TypeScript 全程严格模式
> - 完整的 [4000 字技术复盘](https://github.com/312cangcang/ai-chatbot/blob/main/docs/BLOG.md)，覆盖核心踩坑与思考
> - 清晰的 git 历史 + MIT License + 详细 README

---

## 版本 4：一句话标语（适合放 LinkedIn headline / 个人主页 hero）

> "4 days from `create-next-app` to a production-grade ChatGPT clone — no SDK shortcuts, hand-written SSE, multi-conversation, abortable streams."

或中文：

> "4 天，从 `create-next-app` 到一个产品级 ChatGPT 仿品 —— 不抄 SDK 捷径，手写 SSE 协议、多对话管理、可中断流式。"

---

## 面试时怎么讲（30 秒电梯演讲）

> "我用 4 天从零写了一个流式多对话 Web 应用，特意不用 Vercel AI SDK 那种封装框架，目的是搞清楚 SSE 协议在前后端是怎么打通的——比如 TCP 一次 read 可能不是一条完整消息，UTF-8 中文 3 字节可能被切到两次 read，Nginx 默认会缓冲流式响应——这些只有手写一次才会真正遇到。
> 
> 状态层面我做了一个我比较得意的设计：流式过程中允许用户切换到别的对话，原对话的回复仍在后台静默累积，切回来看到完整结果——这是 ChatGPT 的真实行为，关键在于流式开始时**捕获目标对话 id**而不是用 current 引用。
> 
> 这个项目让我对 LLM 应用底层有了一手理解，再用 SDK 时就知道每个 API 在抽象什么。"

---

## 给招聘官看的"硬指标"

如果你的简历筛选偏向数字党，这些是可量化的点：

- **代码量**：~ 1100 行 TypeScript（不含依赖）
- **0 错误**：lint / type-check 全绿
- **特性数**：10+ 项产品级功能（流式、可中断、多对话、持久化、Markdown、代码高亮、复制、滚动锁定、侧边栏折叠、内联重命名、状态指示动画）
- **文档**：4000 字技术复盘博客 + 详细 README + License
- **开发周期**：4 天 / 个人

---

## 仓库链接整理

| 用途 | 链接 |
|---|---|
| 仓库主页 | https://github.com/312cangcang/ai-chatbot |
| 技术博客 | https://github.com/312cangcang/ai-chatbot/blob/main/docs/BLOG.md |
| 在线体验 | （部署到 Vercel 后补充） |

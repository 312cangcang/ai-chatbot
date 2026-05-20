# AI Chatbot Web · 升级为 Web Agent 🤖

> 从零手写的 ChatGPT 式流式对话 Web 应用 —— **不依赖 Vercel AI SDK / LangChain 等框架**，搞懂 LLM 应用的底层协议、流式 SSE、以及 **Function Calling（工具调用）** 完整闭环。

[![Live Demo](https://img.shields.io/badge/Live_Demo-▶_Try_it_now-success?style=for-the-badge&logo=vercel)](https://ai-chatbot-one-rust.vercel.app)
[![Tech Blog](https://img.shields.io/badge/Tech_Blog-📝_4000_words-blue?style=for-the-badge)](./docs/BLOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)

🌐 **在线 Demo**：<https://ai-chatbot-one-rust.vercel.app>
🔗 **技术复盘博客**：[`docs/BLOG.md`](./docs/BLOG.md)（含 Day 1-5 完整踩坑过程）

---

## 这是什么？

5 天，从 `create-next-app` 到一个具备以下特性的产品形态：

### Day 1-4：聊天 Web App
- 🌊 **流式输出**：手写 SSE 协议，逐字打字机效果
- 💬 **多对话管理**：左侧栏切换 / 新建 / 删除 / 重命名
- ⏸️ **可中断生成**：`AbortController` 实现"停止"按钮
- 💾 **本地持久化**：`localStorage` 自动保存全部对话和侧边栏状态
- 🎨 **Markdown 渲染**：表格、列表、代码高亮、一键复制
- 📱 **可折叠侧边栏**：丝滑动画
- 🟢 **流式状态指示**：跨对话切换时，原对话列表项有动画小绿点
- 🧹 **空对话不持久化**：刷新自动清理

### Day 5：升级为 Web Agent ⚡
- 🛠️ **Function Calling（工具调用）**：基于 OpenAI Tool Calling 协议
- 🔁 **多轮 Tool Loop**：`while` 循环 + `MAX_ROUNDS=5` 防死循环
- ⚡ **同轮工具并行**：`Promise.all` 并行执行同一轮里互不依赖的工具
- 🌊 **流式 + 工具混合 SSE 协议**：自定义 `type` 字段区分 `text` / `tool_start` / `tool_result`
- 🎨 **工具调用 UI 卡片**：转圈 → 完成 → 可展开看 args/result
- 🧰 **内置工具**：`get_current_time`（实时时间）、`calculator`（精确计算）、`get_weather`（天气查询）

## 为什么手写而不用框架？

> 当线上 SSE 帧停在那不动，你能分清是前端 reader 卡死、后端 controller 没 close、还是 Nginx 把流缓冲了吗？

封装解决不了这种问题。手写一遍，才能知道每一层协议是什么样子。

详见博客：[**4 天，从 0 写一个 ChatGPT 式的流式多对话 Web App——踩坑、思考与复盘**](./docs/BLOG.md)

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS |
| 模型 API | DeepSeek（OpenAI 兼容协议） |
| Markdown | `react-markdown` + `remark-gfm` + `react-syntax-highlighter` |
| 流式协议 | 手写 SSE（`ReadableStream` + `TextEncoder` / `TextDecoder`） |

## 核心技术点

### 1. 流式协议的"四层穿透"

```
LLM SDK 异步迭代器
   ↓ 拿到 chunk.choices[0].delta.content
ReadableStream 服务端
   ↓ TextEncoder 编码 + SSE 格式（"data: ...\n\n"）
HTTP 响应（含 X-Accel-Buffering: no 防 Nginx 缓冲）
   ↓ 浏览器 fetch().body.getReader()
TextDecoder({ stream: true }) + buffer 切分
   ↓ 处理 TCP 粘包 + UTF-8 多字节跨包
增量渲染到 React 状态
```

### 2. 流式中切换对话的状态设计

发消息时**捕获目标对话 id**，而非依赖当前 `currentId`：

```ts
async function send() {
  const targetConvId = currentId  // ← 关键：捕获快照
  // ... 后续 setConversations 都用 targetConvId 定位
  // 用户切到别的对话不影响这个流的最终归位
}
```

### 3. 单一数据源的状态模型

```ts
const [conversations, setConversations] = useState<Conversation[]>([])
const [currentId, setCurrentId] = useState<string | null>(null)
const current = useMemo(  // ← 派生，不另立 state
  () => conversations.find(c => c.id === currentId) ?? null,
  [conversations, currentId],
)
```

### 4. 持久化的水合保护

```ts
const [hydrated, setHydrated] = useState(false)

// 写盘 effect
useEffect(() => {
  if (!hydrated) return  // ← 没读完不能写！否则空数组洗掉已有数据
  const toSave = conversations.filter(c => c.messages.length > 0)
  localStorage.setItem(KEY, JSON.stringify(toSave))
}, [conversations, hydrated])
```

### 5. Tool Calling：把 Chatbot 升级为 Agent ⚡（Day 5 新增）

**核心思想**：LLM 不直接执行任何工具，它只负责"喊单"——后端代码真正执行工具，把结果塞回 `messages`，再次调用 LLM 总结。

```ts
// route.ts 核心循环（精简版）
let round = 0
while (round++ < MAX_ROUNDS) {
  const stream = await openai.chat.completions.create({ messages, tools, stream: true })

  // 流式接收：文字直接转发 SSE，工具调用累积起来
  const toolCalls: ToolCall[] = []
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    if (delta?.content) sendSSE({ type: 'text', content: delta.content })
    if (delta?.tool_calls) accumulateToolCalls(toolCalls, delta.tool_calls)
  }

  if (toolCalls.length === 0) break  // AI 不再喊工具 → 结束

  // 把"喊单"塞回 messages
  messages.push({ role: 'assistant', tool_calls: toolCalls })

  // 同一轮内的多个工具并行执行
  const results = await Promise.all(
    toolCalls.map(async (call) => {
      sendSSE({ type: 'tool_start', name: call.function.name, args: ... })
      const result = await TOOL_IMPL[call.function.name](JSON.parse(call.function.arguments))
      sendSSE({ type: 'tool_result', name: call.function.name, result })
      return { tool_call_id: call.id, content: JSON.stringify(result) }
    })
  )

  // 把每个工具结果按 tool_call_id 一一对应塞回（OpenAI 协议要求）
  results.forEach(r => messages.push({ role: 'tool', ...r }))
}
```

**多轮调用 messages 演变示例**（"北京气温×2+5"）：
```js
[
  { role: 'user', content: '北京气温×2+5' },
  { role: 'assistant', tool_calls: [{ id: 'A', name: 'get_weather', ... }] },  // 第 1 轮喊单
  { role: 'tool', tool_call_id: 'A', content: '{"temperature":12}' },           // 工具回单
  { role: 'assistant', tool_calls: [{ id: 'B', name: 'calculator', ... }] },   // 第 2 轮喊单
  { role: 'tool', tool_call_id: 'B', content: '{"result":29}' },                // 工具回单
  { role: 'assistant', content: '北京气温 12°C，×2+5=29°C' },                   // 第 3 轮总结
]
```

**扩展 SSE 协议**（让前端区分文字 / 工具事件）：
```
data: { "type": "text", "content": "你" }
data: { "type": "tool_start", "name": "get_weather", "args": { "city": "北京" } }
data: { "type": "tool_result", "name": "get_weather", "result": { "temperature": 12 } }
data: [DONE]
```

**前端按 `type` 分发**到不同的 UI（text → 追加到气泡 / tool_start → 加转圈卡片 / tool_result → 卡片变 ✓ 完成）。详见 [`src/app/components/ToolInvocations.tsx`](./src/app/components/ToolInvocations.tsx)。

## 项目结构

```
src/app/
├── page.tsx                       # 主页：UI + 状态管理 + 流式消费 + 工具事件分发
├── layout.tsx                     # 根布局
├── globals.css                    # 全局样式
├── api/
│   └── chat/
│       ├── route.ts               # /api/chat：Tool Calling 多轮循环 + 扩展 SSE 协议
│       └── tools.ts               # 工具集：实现 + JSON Schema（Day 5 新增）
└── components/
    ├── MarkdownMessage.tsx        # Markdown 渲染 + 代码块复制
    └── ToolInvocations.tsx        # 工具调用 UI 卡片（Day 5 新增）

docs/
├── BLOG.md                        # 技术复盘博客（Day 1-5）
└── RESUME.md                      # 简历项目描述（4 个版本）
```

## 启动

```bash
# 1. 克隆
git clone https://github.com/312cangcang/ai-chatbot.git
cd ai-chatbot

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local  # 或自己创建
```

`.env.local` 内容：

```env
OPENAI_API_KEY=sk-xxxxxxxx
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

> 也可换成 OpenAI 官方 / 月之暗面 / 智谱 / 任何 OpenAI 兼容 API（需支持 Function Calling）。

```bash
# 4. 启动
npm run dev
# 打开 http://localhost:3000
```

### 试试这些 prompt 看 Agent 表现 🎯

| Prompt | 期望行为 |
|---|---|
| 你好 | 纯聊天，不调工具 |
| 现在几点了？ | 调 `get_current_time` |
| 帮我算 (12345 + 6789) × 7 | 调 `calculator` |
| 北京天气怎么样？ | 调 `get_weather` |
| 北京气温×2+5 是多少？ | **多轮**：先 `get_weather` → 再 `calculator` |
| 北京和上海现在分别几点？ | **同轮并行**：一次 2 个 `get_current_time` |

## 学习记录（5 天迭代节奏）

| Day | 主题 | 关键产出 |
|---|---|---|
| 1 | 跑通最简一问一答 | API Route + 一次性返回 |
| 2 | 流式输出 | SSE 协议端到端 + Markdown + 代码高亮 |
| 3 | 体验打磨 | `AbortController` 中断 / 滚动锁定 / 复制按钮 |
| 4 | 多对话 | 状态形状重构 / 侧边栏 / 持久化 / 内联重命名 / 状态指示 |
| **5** | **升级为 Agent** | **Tool Calling 多轮循环 / 工具并行 / 扩展 SSE 协议 / 工具卡片 UI** |

每一天的踩坑详情都在 [`docs/BLOG.md`](./docs/BLOG.md)。

## 下一步路线图

- [x] **Day 5**：Tool Calling，让 chatbot 升级成 Agent ✅
- [x] 部署到 Vercel ✅
- [ ] **Day 6**：接入 RAG（向量检索 + 文档问答）
- [ ] **Day 7**：把 Tool Calling 扩展到真实 API（和风天气、SerpAPI 搜索等）
- [ ] 把流式渲染优化成"流式中纯文本，结束后切完整 Markdown"以避免长代码回复掉帧
- [ ] 服务端监听 `req.signal.aborted`，取消下游 LLM 调用避免烧 token
- [ ] e2e 测试覆盖核心流程（流式 / 切换 / 删除 / 工具调用）

## License

MIT

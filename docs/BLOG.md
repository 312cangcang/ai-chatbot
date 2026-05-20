# 4 天，从 0 写一个 ChatGPT 式的流式多对话 Web App——踩坑、思考与复盘

> 不用 Vercel AI SDK，不用 LangChain，不用任何 chatbot 模板，从 `create-next-app` 开始一行行写。  
> 因为我想搞懂："那个打字机一样吐字的效果，到底是怎么实现的？"

仓库：<https://github.com/312cangcang/ai-chatbot>  
技术栈：Next.js 14 (App Router) + React 18 + Tailwind + DeepSeek API（OpenAI 兼容协议）

---

## 为什么不用框架？

市面上 30 秒就能跑起来的方案太多了：
- **Vercel AI SDK** 一个 `useChat()` 钩子搞定流式
- **LangChain.js** 把对话、工具、记忆全包了
- **shadcn/ui chat template** 直接就有现成 UI

但这些封装解决不了一个问题——**当线上出 bug，你打开 devtools 看到一段 SSE 帧停在那不动，你知道是前端 reader 卡死了，还是后端 controller 没 close？还是 Nginx 把流缓冲了？**

所以我决定**手写一遍**，把每一层协议都摸清楚。事后证明这 4 天比看 10 篇文章学到的东西多。

---

## Day 1：先跑通最简单的一问一答

### 目标
点击发送 → 后端调 LLM → 拿回完整回复一次性渲染。

### 关键点：API Route 的 `runtime`

Next.js App Router 的 API Route 默认跑在 Node.js Runtime，但很多教程告诉你 LLM 要用 `edge` runtime——**别听他们的**：

```ts
export const runtime = 'nodejs'
```

Edge Runtime 限制非常多（没有 `Buffer`、部分 Node API 缺失、冷启动行为不同），第一版稳定优先。后面真有性能问题再优化。

### 第一个坑：流式生成 vs 一次性返回

第一版我直接 `await client.chat.completions.create({ stream: false })`，等十几秒拿到完整字符串，前端一次性塞进去。

**问题**：用户体验差到爆。等 15 秒看到一坨墙，跟 GPT 体验完全不在一个量级。

但流式没那么简单——它涉及 4 个层次的协议拼接，先收手，Day 2 专门搞它。

---

## Day 2：流式的"四层协议"

这是最值得讲的一天。我把它拆成 4 层，每层都踩了坑。

### 层 1：LLM SDK 的异步迭代器

```ts
const llmStream = await client.chat.completions.create({
  model: 'deepseek-chat',
  messages: [...],
  stream: true,  // ← 关键
})

for await (const chunk of llmStream) {
  const delta = chunk.choices[0]?.delta?.content ?? ''
  // delta 可能是 1 个字、几个字、空字符串、甚至只有 role 字段
}
```

**坑**：`delta.content` 不一定每次都有。第一个 chunk 通常只有 `delta.role: 'assistant'`，没有 content；最后一个 chunk 是 `finish_reason: 'stop'`，也没 content。**记得 `?? ''` 兜底**，不然 `undefined` 拼字符串会出现 `'undefined'`。

### 层 2：服务端用 ReadableStream 转发

OpenAI SDK 给的是 JS 异步迭代器，HTTP 响应需要的是字节流。要用 `ReadableStream` + `TextEncoder` 桥接：

```ts
const encoder = new TextEncoder()
const sseStream = new ReadableStream({
  async start(controller) {
    for await (const chunk of llmStream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        const payload = `data: ${JSON.stringify({ content: delta })}\n\n`
        controller.enqueue(encoder.encode(payload))
      }
    }
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller.close()
  },
})

return new Response(sseStream, {
  headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',  // ← 这一行的故事见下面
  },
})
```

### 层 3：SSE 协议格式

Server-Sent Events 协议特别简单，简单到我第一次写错了都没发现：

```
data: {"content":"你"}\n\n
data: {"content":"好"}\n\n
data: [DONE]\n\n
```

**两个 `\n` 是消息分隔符**，少一个浏览器永远等下一个字节，体现为"页面卡住"。我有次手抖写成 `\n`，定位了半小时。

### 层 4：前端 fetch + ReadableStream Reader

这是踩坑最多的一层：

```ts
const response = await fetch('/api/chat', {...})
const reader = response.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''  // ← 必须有这个 buffer！

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  buffer += decoder.decode(value, { stream: true })
  
  // 按 \n\n 切分完整的 SSE 消息
  const parts = buffer.split('\n\n')
  buffer = parts.pop()!  // 最后一段可能不完整，留到下一轮
  
  for (const part of parts) {
    if (!part.startsWith('data: ')) continue
    const data = part.slice(6)
    if (data === '[DONE]') return
    const { content } = JSON.parse(data)
    setMessages(prev => /* 把 content 拼到最后一条 assistant 消息 */)
  }
}
```

#### 坑 1：TCP 不保证一帧 = 一次 read

我最早的代码是：

```ts
// ❌ 错误版本
const text = decoder.decode(value)
const data = text.slice(6, -2)  // 假设每次 read 就是一条完整消息
```

跑起来偶尔出现 `JSON.parse` 报错。原因——TCP 是字节流，**一次 `reader.read()` 拿到的字节可能是**：
- 半条消息
- 一条半消息
- 三条消息粘在一起

必须用 buffer 累积，按 `\n\n` 切分，最后一段留下来等下一轮。这本质上和**网络编程里的 TCP 粘包/拆包**是同一个问题。

#### 坑 2：`TextDecoder` 的 `stream: true` 选项

中文 UTF-8 编码占 3 字节。如果一个汉字"好"被 TCP 拆到两次 `read()`：
- 第 1 次：前 2 字节
- 第 2 次：第 3 字节

普通 `decoder.decode(value)` 会在第 1 次解码出 `'\uFFFD'`（替换字符 ）。`{ stream: true }` 让 decoder **保留未完成的字节**，下次接着解。**这一行不加，中文一定乱码**。

#### 坑 3：Nginx 的缓冲（部署才会暴露）

本地跑得好好的，部署到服务器后变成"等 5 秒一次性出现一段"。

**Nginx 默认开启 `proxy_buffering`**，会把后端的输出攒一会再吐给浏览器。两种解法：

1. 改 nginx.conf：`proxy_buffering off;`（运维不一定让你改）
2. 后端响应头加：`X-Accel-Buffering: no`（更便携，Nginx 看到这个会自动关掉这条连接的 buffering）

我选了 2，写在 Response headers 里。**这种坑只有部署到生产才会冒出来，本地永远复现不了**。

---

## Day 3：可中断 + Markdown + 滚动

打字机有了，但还差几样让它"像 ChatGPT"。

### `AbortController`：取消正在生成的请求

`fetch` 一旦发出就停不下来？错——`AbortController` 可以：

```ts
const abortRef = useRef<AbortController | null>(null)

async function send() {
  const controller = new AbortController()
  abortRef.current = controller
  
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
    signal: controller.signal,  // ← 关键
  })
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      // ...
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return  // 主动取消，不当报错
    throw e
  }
}

function stop() {
  abortRef.current?.abort()
}
```

**但服务端没法马上"听见"abort**。原理：浏览器关掉 TCP 连接 → Node.js 的 Request 触发 `close` 事件 → 我们应该停掉 OpenAI 的迭代。

我没在第一版加这个监听，结果**用户点了停止，但服务端还在烧 token**，因为 `for await (const chunk of llmStream)` 还在跑。这是个真实的钱漏洞。在生产里要监听 `req.signal.aborted` 然后 `break`。

### Markdown + 代码高亮：增量渲染的性能

`react-markdown` + `react-syntax-highlighter` 组合很常用，但流式场景下有坑——**每收到 1 个字就重新解析一遍 Markdown AST + 代码高亮 AST**。

100 字的回复 = 100 次完整渲染。短消息没事，遇上几千字代码块的回复直接掉帧。

第一版我用 `useMemo` 试图缓存，但 `content` 每次都变，memo 永远 miss。**真正的解法**是：流式中只用纯文本简单渲染，**结束后再切换到完整 Markdown**。这次没做，留到下次优化。

### 滚动锁定：用户上滑后不要强制吸底

ChatGPT 的滚动行为：
- 默认吸底（新内容自动滚到底）
- 用户上滑读历史 → 解除吸底
- 滚回底部 → 重新吸底

实现：

```ts
const stickToBottomRef = useRef(true)

function handleScroll() {
  const el = scrollRef.current!
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottomRef.current = distFromBottom < 50  // 50px 容差
}

useEffect(() => {
  if (stickToBottomRef.current && scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }
}, [messages])
```

**为什么用 ref 而不是 state？** 因为这是个"读值不需要触发渲染"的场景，state 会带来无意义的重渲染。**该用 ref 时就用 ref**，不是所有可变值都该是 state。

---

## Day 4：多对话——状态形状的一次重构

这是最值得复盘的一天。Day 1~3 我有一个全局 `messages: Message[]`，所有逻辑围绕它转。Day 4 要做"多个对话各自独立"，看似简单实则**整个状态模型要重做**。

### 数据结构升级

```ts
// Day 3：
const [messages, setMessages] = useState<Message[]>([])

// Day 4：
type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}
const [conversations, setConversations] = useState<Conversation[]>([])
const [currentId, setCurrentId] = useState<string | null>(null)
```

### 第一坑：`current` 是派生数据，不是独立 state

我最早写成：

```ts
// ❌ 错误
const [current, setCurrent] = useState<Conversation | null>(null)

// 切换对话
function selectConversation(id: string) {
  setCurrentId(id)
  setCurrent(conversations.find(c => c.id === id) ?? null)  // 同步两个 state，地狱开始
}
```

发消息时要改 `current.messages` 还是 `conversations[i].messages`？两个都改？哪个先改？很快就出现"消息显示了但保存的是旧的"的不一致。

**正解**：`current` 用 `useMemo` 派生：

```ts
const current = useMemo(
  () => conversations.find(c => c.id === currentId) ?? null,
  [conversations, currentId],
)
```

**单一数据源（Single Source of Truth）**——消息只活在 `conversations` 里，`current` 只是一个"指针"。改 messages 永远只改一个地方。

这条原则适用于一切 React 状态设计。**别让派生数据有自己的 state**。

### 第二坑：流式中切换对话

用户在对话 A 发消息 → 流式还在跑 → 切到对话 B → 后端继续吐字给谁？

错误版本：往 `current` 里写。但用户切走后 `current` 已经是对话 B 了，A 的回复被错误地拼到 B。

**正解**：流式开始时**捕获目标对话 id**，整个回调里都用这个 id：

```ts
async function send() {
  const targetConvId = currentId  // ← 捕获，不是用 current
  
  // ... fetch & reader loop ...
  
  function appendDelta(delta: string) {
    setConversations(prev => 
      prev.map(c => 
        c.id === targetConvId  // ← 永远写到目标对话
          ? { ...c, messages: [...c.messages, /* 拼接 */] }
          : c
      )
    )
  }
}
```

这样用户切到 B 之后，A 的回复**仍在静默累积**，切回 A 看到完整结果。这是 ChatGPT 的真实行为。

### 第三坑：流式中删除当前对话

更恶心的边界 case：流式还没结束 → 用户删了当前对话 → setConversations 找不到 targetConvId → 静默失败。技术上不会崩，但用户体验诡异。

我的处理是**禁止操作**：

```ts
if (loading && id === currentId) {
  alert('当前对话正在生成中，请先停止再删除')
  return
}
```

不是最优雅，但是最稳。生产代码里我会换成更友好的 toast。

### "懒创建"模式

用户反复点"+ 新建对话"会怎样？产生 N 个空对话堆在列表里。

```ts
function handleNewConversation() {
  if (current && current.messages.length === 0) return  // 当前空了就不创建
  createConversation()
}
```

加上**保存时过滤空对话**：

```ts
const toSave = conversations.filter(c => c.messages.length > 0)
localStorage.setItem(KEY, JSON.stringify(toSave))
```

效果：内存里允许有空对话（用户可以填东西），但磁盘上不存。**刷新自动清理**——是不是很优雅？这种"内存允许，存盘过滤"的小心思值得记下。

### Tailwind `group` + `group-hover`：列表项的删除按钮

ChatGPT 那种"hover 列表项才出现垃圾桶"的效果，**不需要写 hover state**：

```tsx
<div className="group relative ...">
  <span className="truncate">{title}</span>
  <button className="opacity-0 group-hover:opacity-100 transition-opacity">
    🗑
  </button>
</div>
```

父加 `group`，子用 `group-hover:xxx` 响应父的 hover。**Tailwind 把"父子联动 hover"压成了一行**。第一次见时我惊了好久。

### Inline 重命名的 4 个不能少的细节

```tsx
<input
  ref={renameInputRef}
  value={renamingValue}
  onChange={e => setRenamingValue(e.target.value)}
  onKeyDown={e => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') cancelRename()
  }}
  onBlur={commitRename}
  onClick={e => e.stopPropagation()}  // ← 不加这行：点 input 会冒泡到列表项 onClick → 切换对话 → 编辑态丢失
/>
```

进入编辑态后还要：

```ts
useEffect(() => {
  if (renamingId) {
    setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()  // 全选，方便覆盖输入
    }, 0)
  }
}, [renamingId])
```

**生产级 UI 中"看似简单"的功能往往就是靠这一堆边界处理撑起来的。**写完这个我才明白为什么 Notion / Linear 那么贵——他们处理对了上百个这种细节。

---

## 代码质量上的一些自我要求

写完之后回头看，有几个习惯帮我减少了很多 bug：

### 1. 永远 `useMemo` 派生数据，不另立 state

前面已经讲了。这条原则单独拎出来再强调一遍，因为太重要。

### 2. ref vs state 的判断标准

> **会被渲染读取吗？** 是 → state；不是 → ref。

`stickToBottomRef`、`abortRef`、`renameInputRef` 都是这一类。

### 3. 持久化和水合的分离

```ts
const [hydrated, setHydrated] = useState(false)

// 读 localStorage
useEffect(() => {
  // ... setConversations(parsed)
  setHydrated(true)
}, [])

// 写 localStorage
useEffect(() => {
  if (!hydrated) return  // ← 没 hydrate 完别写！
  localStorage.setItem(KEY, JSON.stringify(conversations))
}, [conversations, hydrated])
```

**第一次渲染时 `conversations` 是 `[]`，如果直接写 localStorage 会把已存的数据洗成空数组**。这个坑教科书很少讲，但每次做客户端持久化都会遇到。

### 4. 版本化 storage key

```ts
const STORAGE_KEY = 'chatbot:conversations:v2'  // ← 加个 v2
```

数据结构升级时旧数据会反序列化失败。换个 key，旧数据"自然失效"，比写迁移代码省事 10 倍。

---

## 学到的几件大事

1. **协议感**比框架更值钱。SSE、TCP 粘包、UTF-8 多字节切分、HTTP 响应头——这些不是"前端知识"或"后端知识"，是**写真实应用的基本功**。
2. **用框架前先手写一遍**。不为了不用框架，是为了搞清楚框架在抽象什么。下次用 Vercel AI SDK 时，我能秒懂它每个 API 的含义。
3. **状态形状一旦错就处处错**。`Conversation[]` 还是 `currentId + messages` 这种决定，影响的是后面 90% 代码的写法。开新功能前先想清楚状态怎么放。
4. **边界 case 才是产品**。基础功能两小时能写完，剩下三天都在处理"流式中切换"、"流式中删除"、"刷新后水合"、"多字节切分"。**生产级和玩具的区别就在这里**。
5. **持续的、可审视的代码组织**。我每个 Day 都用一个 `task` 概念把改动收敛成"一次状态形状改造 + 一次 UI 改造 + 一次打磨"，不混着写。这让我在 Day 4 重写一半状态时不慌。

---

## 下一步

- **Day 5：Tool Calling**——让 AI 调用工具，从 chatbot 升级成 Agent
- ~~部署到 Vercel，把 SSE 在真实生产环境上跑一跑~~ ✅ 已部署
- 加个 e2e 测试覆盖核心流程

---

## 在线试玩 & 完整代码

- 🌐 **Live Demo**：<https://ai-chatbot-one-rust.vercel.app>（DeepSeek 接口，流式响应实时蹦字，欢迎随便玩）
- 📦 **GitHub 仓库**：<https://github.com/312cangcang/ai-chatbot>（4 天迭代历史完整保留，欢迎 Star ⭐）

### 部署到 Vercel 也踩到一个坑

部署时被一个**默认 10 秒超时**坑了——Vercel Hobby 计划的 Serverless Function **默认 10s 就被强制 kill**，流式聊天动辄 30~60s，超了直接断流。

解决：在 route handler 里显式声明：

```ts
export const runtime = 'nodejs'
export const maxDuration = 60  // Hobby 上限 60s，Pro 300s
```

再次印证那条原则：**默认值才是最大的坑**。文档里写得很小，不踩一次永远不会主动去配。


代码全部开源：<https://github.com/312cangcang/ai-chatbot>，欢迎 PR / Issue / Star ⭐

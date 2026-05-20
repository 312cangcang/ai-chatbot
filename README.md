# AI Chatbot Web

> 一个从零手写的 ChatGPT 式流式对话 Web 应用 —— **不依赖 Vercel AI SDK / LangChain 等框架**，目的是搞懂 LLM 应用的底层协议与工程实现。

🔗 **技术复盘博客**：[`docs/BLOG.md`](./docs/BLOG.md)（4000 字，含完整踩坑过程）

---

## 这是什么？

四天，从 `create-next-app` 到一个具备以下特性的产品形态：

- 🌊 **流式输出**：手写 SSE 协议，逐字打字机效果
- 💬 **多对话管理**：左侧栏切换 / 新建 / 删除 / 重命名
- ⏸️ **可中断生成**：`AbortController` 实现"停止"按钮
- 💾 **本地持久化**：`localStorage` 自动保存全部对话和侧边栏状态
- 🎨 **Markdown 渲染**：表格、列表、代码高亮、一键复制
- 📱 **可折叠侧边栏**：丝滑动画
- 🟢 **流式状态指示**：跨对话切换时，原对话列表项有动画小绿点
- 🧹 **空对话不持久化**：刷新自动清理

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

## 项目结构

```
src/app/
├── page.tsx               # 主页：UI + 状态管理 + 流式消费（~760 行）
├── layout.tsx             # 根布局
├── globals.css            # 全局样式
├── api/
│   └── chat/
│       └── route.ts       # /api/chat：调 LLM 并转发为 SSE
└── components/
    └── MarkdownMessage.tsx  # Markdown 渲染 + 代码块复制

docs/
├── BLOG.md                # 4000 字技术复盘博客
└── RESUME.md              # 简历项目描述（4 个版本）
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

> 也可换成 OpenAI 官方 / 月之暗面 / 智谱 / 任何 OpenAI 兼容 API。

```bash
# 4. 启动
npm run dev
# 打开 http://localhost:3000
```

## 学习记录（4 天迭代节奏）

| Day | 主题 | 关键产出 |
|---|---|---|
| 1 | 跑通最简一问一答 | API Route + 一次性返回 |
| 2 | 流式输出 | SSE 协议端到端 + Markdown + 代码高亮 |
| 3 | 体验打磨 | `AbortController` 中断 / 滚动锁定 / 复制按钮 |
| 4 | 多对话 | 状态形状重构 / 侧边栏 / 持久化 / 内联重命名 / 状态指示 |

每一天的踩坑详情都在 [`docs/BLOG.md`](./docs/BLOG.md)。

## 下一步路线图

- [ ] **Day 5**：Tool Calling，让 chatbot 升级成 Agent
- [ ] 部署到 Vercel
- [ ] 把流式渲染优化成"流式中纯文本，结束后切完整 Markdown"以避免长代码回复掉帧
- [ ] 服务端监听 `req.signal.aborted`，取消下游 LLM 调用避免烧 token
- [ ] e2e 测试覆盖核心流程（流式 / 切换 / 删除）

## License

MIT

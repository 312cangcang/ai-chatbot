# AI Chatbot Web

一个基于 **Next.js 15 + DeepSeek API** 的流式对话 Web 应用。从零手写，**不用任何 chatbot 框架**，目的是真正搞懂"流式 + 多对话 + 持久化"是怎么跑起来的。

## ✨ 功能

- 🌊 **SSE 流式响应**：逐字吐出，无等待感
- 💬 **多对话管理**：左侧栏切换、新建、删除、重命名
- 💾 **本地持久化**：`localStorage` 自动保存所有对话和侧边栏状态
- 🎨 **Markdown 渲染**：代码高亮、表格、列表完整支持
- 📋 **代码块一键复制**
- ⏸️ **可中断生成**：点"停止"立刻断流
- 📱 **可折叠侧边栏**：丝滑动画
- 🟢 **流式状态指示**：在哪个对话里正在生成，列表项有动画小绿点
- 🔑 **当前对话标记**：左侧蓝色竖条 + 高亮背景
- 🧹 **空对话不持久化**：刷新自动清理空白对话项

## 🛠️ 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS |
| 模型 API | DeepSeek（OpenAI SDK 兼容协议） |
| Markdown | `react-markdown` + `remark-gfm` + `react-syntax-highlighter` |
| 流式协议 | SSE（手写 ReadableStream + TextDecoder 解析） |

## 🚀 启动

```bash
# 安装依赖
npm install

# 配置环境变量（创建 .env.local）
echo "DEEPSEEK_API_KEY=你的key" > .env.local

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000

### 环境变量说明

```env
# .env.local（不会被提交到仓库）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

## 📁 项目结构

```
src/
└─ app/
   ├─ page.tsx              # 主页：UI + 状态管理 + 流式消费
   ├─ layout.tsx            # 根布局
   ├─ globals.css           # 全局样式
   └─ api/
      └─ chat/
         └─ route.ts        # /api/chat：调 DeepSeek 并转发 SSE
```

## 🎓 学习记录（4 天）

- **Day 1**：搭起 Next.js + 跑通最简单的"发消息→拿回复"
- **Day 2**：流式输出（SSE）+ Markdown 渲染 + 代码高亮
- **Day 3**：可中断 (`AbortController`)、复制按钮、滚动锁定
- **Day 4**：多对话列表、侧边栏、持久化、重命名、流式状态指示

## 📝 License

MIT

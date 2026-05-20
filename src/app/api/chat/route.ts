/**
 * 后端 API Route：POST /api/chat
 *
 * Day 2：流式 SSE 版本
 *
 * 工作流程：
 *   1. 浏览器 POST /api/chat（带上完整对话历史 messages）
 *   2. 服务端调 LLM 时打开 stream:true，拿到一个异步可迭代的 chunk 流
 *   3. 把每个 chunk 的增量文字（delta.content）按 SSE 格式写到响应里
 *      —— 浏览器侧用 ReadableStream 一边收一边渲染，达到"打字机"效果
 *
 * SSE 格式约定（自定义，两端配合即可）：
 *   data: {"content":"你"}\n\n
 *   data: {"content":"好"}\n\n
 *   data: [DONE]\n\n
 */

import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

const MODEL = process.env.OPENAI_MODEL || 'deepseek-chat'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 让 Next.js 用 Node.js Runtime（OpenAI SDK 在 Edge Runtime 也能跑，但 Node 更稳）
export const runtime = 'nodejs'

// Vercel Serverless Function 最大执行时长（秒）
//   Hobby (免费版) 上限 60s，Pro 300s，Enterprise 900s
//   流式聊天经常超 10s，必须显式声明，否则被默认 10s 截断
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages 必须是数组' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 1. 调 LLM，打开流式
    const llmStream = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个友好、乐于助人的 AI 助手，用简洁的中文回答。' },
        ...messages,
      ],
      stream: true,
    })

    // 2. 构造一个 ReadableStream，往里面持续 enqueue SSE 数据
    //    TextEncoder：把 JS 字符串转成字节（Uint8Array），HTTP 流必须传字节
    const encoder = new TextEncoder()

    const sseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of llmStream) {
            // chunk 大概长这样：
            //   { choices: [{ delta: { content: '你' } }] }
            //   每次只带新增的几个字（甚至 1 个字）
            const delta = chunk.choices[0]?.delta?.content ?? ''
            if (delta) {
              // 按 SSE 格式写：data: {...}\n\n
              const payload = `data: ${JSON.stringify({ content: delta })}\n\n`
              controller.enqueue(encoder.encode(payload))
            }
          }
          // 全部生成完，发一个结束标记
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          console.error('[/api/chat] 流式生成失败:', err)
          const message = err instanceof Error ? err.message : '未知错误'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          )
          controller.close()
        }
      },
    })

    // 3. 用 SSE 标准 Content-Type 返回这个流
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // 避免 Nginx 等代理缓冲（部署时常见坑）
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    console.error('[/api/chat] 调用失败:', err)
    const message = err instanceof Error ? err.message : '未知错误'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

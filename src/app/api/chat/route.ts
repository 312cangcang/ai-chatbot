/**
 * 后端 API Route：POST /api/chat
 *
 * Day 5：Tool Calling + 流式 SSE
 *
 * 工作流程（关键升级！）：
 *   1. 浏览器 POST /api/chat（带完整对话历史 messages）
 *   2. 服务端调 LLM 时同时打开 stream:true + tools:[...]
 *   3. **多轮循环**：
 *      - 如果 LLM 返回 tool_calls → 执行工具 → 把结果塞回 messages → 再调 LLM
 *      - 如果 LLM 返回普通文字 → 流式吐给前端 → 结束
 *   4. 整个过程通过 SSE 实时推送给前端，让用户看到 AI 在「思考-调工具-继续思考」
 *
 * SSE 协议（多事件类型）：
 *   data: {"type":"text","content":"你好"}             文字增量
 *   data: {"type":"tool_start","name":"...","args":{}}  开始调工具
 *   data: {"type":"tool_result","name":"...","result":...} 工具完成
 *   data: {"type":"error","error":"..."}               出错
 *   data: [DONE]                                       全部结束
 */

import OpenAI from 'openai'
import { TOOL_IMPL, TOOLS_SCHEMA } from './tools'
import { getProviderConfig, getModelInfo } from '@/lib/providers'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 工具调用循环最大轮数（防止 LLM 无限循环调工具）
const MAX_TOOL_ROUNDS = 5

export const runtime = 'nodejs'
// Vercel Hobby 上限 60s
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages: ChatMessage[]
      provider?: string
      model?: string
    }
    const { messages, provider: providerId, model: modelId } = body

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages 必须是数组' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // —— 根据请求体里的 provider/model 选客户端和模型 ——
    let providerCfg
    try {
      providerCfg = getProviderConfig(providerId)
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: e instanceof Error ? e.message : '供应商配置错误',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const client = new OpenAI({
      apiKey: providerCfg.apiKey,
      baseURL: providerCfg.baseURL,
    })

    // 选模型：优先用前端指定的；否则用该供应商第一个模型
    const finalModelId =
      (modelId && providerCfg.models.find((m) => m.id === modelId)?.id) ||
      providerCfg.models[0]?.id ||
      'gpt-3.5-turbo'

    // 该模型是否支持 Function Calling（决定是否注入 tools）
    const modelInfo = getModelInfo(providerId, finalModelId)
    const supportsTool = modelInfo?.supportsToolCalling ?? true

    // 调试：打印当前请求实际使用的供应商和模型
    console.log(
      `[chat] provider=${providerCfg.id} model=${finalModelId} baseURL=${providerCfg.baseURL} supportsTool=${supportsTool}`,
    )

    const encoder = new TextEncoder()

    const sseStream = new ReadableStream({
      async start(controller) {
        // SSE 写入辅助函数
        const send = (event: object) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          )
        }

        try {
          // 动态 system prompt：根据当前选用的 provider/model 注入身份
          // 这样切到 Qwen 时模型就不会自称 "DeepSeek"（因训练数据污染导致）
          const systemPrompt = [
            `你是基于 ${providerCfg.label} 的 AI 助手，当前运行的模型是 ${finalModelId}。`,
            `当用户问"你是什么模型/你是谁/你的开发者"时，请如实回答上述信息，不要冒充其他模型。`,
            `请用友好、简洁的中文回答用户。`,
            supportsTool
              ? `当需要查询实时数据（时间、天气）或精确计算时，请主动调用对应工具。`
              : `（当前模型不支持工具调用，请基于已有知识直接作答。）`,
          ].join('\n')

          // OpenAI SDK 的消息类型比较严格，这里用 any 灵活处理
          // (因为要往里 push tool_calls / tool 角色的消息)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const conversation: any[] = [
            {
              role: 'system',
              content: systemPrompt,
            },
            ...messages,
          ]

          // ============== 工具调用循环 ==============
          // 不支持工具的模型只跑一轮纯流式
          const maxRounds = supportsTool ? MAX_TOOL_ROUNDS : 1
          for (let round = 0; round < maxRounds; round++) {
            const llmStream = await client.chat.completions.create({
              model: finalModelId,
              messages: conversation,
              ...(supportsTool
                ? { tools: TOOLS_SCHEMA, tool_choice: 'auto' as const }
                : {}),
              stream: true,
            })

            // 用于累积本轮收到的内容
            let assistantContent = ''
            // tool_calls 在流式里是按 index 分块到达的，需要拼起来
            // 例如：先收到 [{index:0, id:'...', function:{name:'get_weather'}}]
            //       再收到 [{index:0, function:{arguments:'{"ci'}}]
            //       再收到 [{index:0, function:{arguments:'ty":"北京"}'}}]
            const toolCallsAccum: {
              id: string
              type: 'function'
              function: { name: string; arguments: string }
            }[] = []

            for await (const chunk of llmStream) {
              const delta = chunk.choices[0]?.delta
              if (!delta) continue

              // 1. 收到文字增量 → 立刻流给前端
              if (delta.content) {
                assistantContent += delta.content
                send({ type: 'text', content: delta.content })
              }

              // 2. 收到工具调用增量 → 累积起来
              if (delta.tool_calls) {
                for (const tcDelta of delta.tool_calls) {
                  const idx = tcDelta.index
                  if (!toolCallsAccum[idx]) {
                    toolCallsAccum[idx] = {
                      id: tcDelta.id ?? '',
                      type: 'function',
                      function: {
                        name: tcDelta.function?.name ?? '',
                        arguments: tcDelta.function?.arguments ?? '',
                      },
                    }
                  } else {
                    if (tcDelta.id) toolCallsAccum[idx].id = tcDelta.id
                    if (tcDelta.function?.name) {
                      toolCallsAccum[idx].function.name = tcDelta.function.name
                    }
                    if (tcDelta.function?.arguments) {
                      toolCallsAccum[idx].function.arguments +=
                        tcDelta.function.arguments
                    }
                  }
                }
              }
            }

            // ============== 本轮流结束，判断下一步 ==============

            // 情况 A：LLM 决定调用工具
            if (toolCallsAccum.length > 0) {
              // 把 assistant 这条（带 tool_calls）加入历史
              conversation.push({
                role: 'assistant',
                content: assistantContent || null,
                tool_calls: toolCallsAccum,
              })

              // 依次执行每个工具
              for (const tc of toolCallsAccum) {
                const fnName = tc.function.name
                let fnArgs: Record<string, unknown> = {}
                try {
                  fnArgs = tc.function.arguments
                    ? JSON.parse(tc.function.arguments)
                    : {}
                } catch {
                  // arguments 解析失败，给个空对象，让工具自己处理
                }

                // 通知前端：开始调工具
                send({ type: 'tool_start', name: fnName, args: fnArgs })

                const fn = TOOL_IMPL[fnName]
                const result = fn
                  ? fn(fnArgs)
                  : { error: `未知工具：${fnName}` }

                // 通知前端：工具执行完成
                send({ type: 'tool_result', name: fnName, result })

                // 把工具结果塞回对话历史，让 LLM 下一轮看到
                conversation.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                })
              }

              // 进入下一轮：LLM 看到工具结果后会继续生成（可能还要调更多工具，或者总结）
              continue
            }

            // 情况 B：LLM 给出了纯文字回答 → 流已经发完了，结束循环
            break
          }

          send({ type: 'done' })
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          console.error('[/api/chat] 流式生成失败:', err)
          const message = err instanceof Error ? err.message : '未知错误'
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: message })}\n\n`,
            ),
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      },
    })

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
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

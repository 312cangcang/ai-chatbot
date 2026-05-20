/**
 * 工具调用展示组件（Day 5）
 *
 * 在 assistant 消息气泡上方/内部，展示一组"工具调用记录"：
 *   - 调用中：转圈圈 + 工具名 + 参数
 *   - 已完成：✓ + 工具名 + 参数 + 结果（可折叠）
 *
 * UI 风格参考 ChatGPT/Claude 的 tool use 展示
 */
'use client'

import { useState } from 'react'

export type ToolInvocationData = {
  name: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'done'
}

const TOOL_LABEL: Record<string, { label: string; emoji: string }> = {
  get_current_time: { label: '查询当前时间', emoji: '🕐' },
  calculator: { label: '精确计算', emoji: '🧮' },
  get_weather: { label: '查询天气', emoji: '🌤️' },
}

function ToolItem({ invocation }: { invocation: ToolInvocationData }) {
  const [expanded, setExpanded] = useState(false)
  const meta = TOOL_LABEL[invocation.name] ?? {
    label: invocation.name,
    emoji: '🔧',
  }
  const isRunning = invocation.status === 'running'

  // 简短的参数预览：取第一个值的字符串形式（最多 30 字符）
  const argPreview = (() => {
    const values = Object.values(invocation.args ?? {})
    if (values.length === 0) return ''
    const first = String(values[0] ?? '')
    return first.length > 30 ? first.slice(0, 30) + '…' : first
  })()

  // 结果预览
  const resultPreview = (() => {
    if (invocation.result === undefined || invocation.result === null) return ''
    if (typeof invocation.result === 'object') {
      const r = invocation.result as Record<string, unknown>
      if ('error' in r) return `错误：${String(r.error)}`
      // 拿前 1-2 个有意义的字段拼一下
      const keyValues = Object.entries(r)
        .slice(0, 3)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('，')
      return keyValues
    }
    return String(invocation.result)
  })()

  return (
    <div
      className={`rounded-lg border text-xs transition ${
        isRunning
          ? 'border-blue-200 bg-blue-50/50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        <span className="text-base leading-none">{meta.emoji}</span>
        <span className="font-medium text-gray-700">
          {isRunning ? '调用工具中：' : '已调用：'}
          {meta.label}
        </span>
        {argPreview && (
          <span className="truncate text-gray-500">
            （{argPreview}）
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-gray-400">
          {isRunning ? (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span>运行中</span>
            </>
          ) : (
            <>
              <span className="text-green-600">✓</span>
              <span className="text-gray-500">{expanded ? '收起' : '详情'}</span>
            </>
          )}
        </span>
      </button>

      {expanded && !isRunning && (
        <div className="space-y-1.5 border-t border-gray-200 px-3 py-2 font-mono text-[11px]">
          <div>
            <span className="text-gray-500">📥 入参：</span>
            <code className="break-all text-gray-700">
              {JSON.stringify(invocation.args)}
            </code>
          </div>
          <div>
            <span className="text-gray-500">📤 结果：</span>
            <code className="break-all text-gray-700">
              {typeof invocation.result === 'object'
                ? JSON.stringify(invocation.result, null, 0)
                : String(invocation.result)}
            </code>
          </div>
          {!expanded && resultPreview && (
            <div className="text-gray-600">{resultPreview}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ToolInvocations({
  invocations,
}: {
  invocations: ToolInvocationData[]
}) {
  if (!invocations || invocations.length === 0) return null
  return (
    <div className="mb-2 space-y-1.5">
      {invocations.map((inv, i) => (
        <ToolItem key={i} invocation={inv} />
      ))}
    </div>
  )
}

/**
 * 模型选择下拉
 *
 * 用法：
 *   <ModelPicker
 *     providers={providers}
 *     value={{ providerId, modelId }}
 *     onChange={(v) => setSelected(v)}
 *     disabled={loading}
 *   />
 *
 * 视觉：一个紧凑的胶囊按钮，点开是 "供应商 → 模型" 两级菜单。
 */
'use client'

import { useEffect, useRef, useState } from 'react'

export type PublicModel = {
  id: string
  label: string
  supportsToolCalling: boolean
  hint?: string
}

export type PublicProvider = {
  id: string
  label: string
  homepage?: string
  models: PublicModel[]
}

export type ModelSelection = {
  providerId: string
  modelId: string
}

type Props = {
  providers: PublicProvider[]
  value: ModelSelection | null
  onChange: (v: ModelSelection) => void
  disabled?: boolean
}

export default function ModelPicker({
  providers,
  value,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 点外面关闭
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (providers.length === 0) {
    return (
      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
        ⚠️ 未配置任何 API Key
      </span>
    )
  }

  const currentProvider =
    providers.find((p) => p.id === value?.providerId) ?? providers[0]
  const currentModel =
    currentProvider.models.find((m) => m.id === value?.modelId) ??
    currentProvider.models[0]

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        title={
          disabled
            ? '生成中无法切换模型'
            : `${currentProvider.label} · ${currentModel.label}`
        }
      >
        <span className="text-blue-500">⚡</span>
        <span className="max-w-[180px] truncate">
          {currentProvider.label} · {currentModel.label}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 max-h-[70vh] overflow-y-auto rounded-lg border bg-white shadow-lg">
          {providers.map((p) => (
            <div key={p.id} className="border-b last:border-b-0">
              <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-500">
                {p.label}
              </div>
              {p.models.map((m) => {
                const active =
                  p.id === value?.providerId && m.id === value?.modelId
                return (
                  <button
                    key={`${p.id}/${m.id}`}
                    type="button"
                    onClick={() => {
                      onChange({ providerId: p.id, modelId: m.id })
                      setOpen(false)
                    }}
                    className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{m.label}</span>
                        {m.supportsToolCalling ? (
                          <span
                            className="shrink-0 rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-700"
                            title="支持工具调用"
                          >
                            🛠
                          </span>
                        ) : (
                          <span
                            className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500"
                            title="不支持工具调用"
                          >
                            纯聊天
                          </span>
                        )}
                      </div>
                      {m.hint && (
                        <div className="mt-0.5 truncate text-xs text-gray-400">
                          {m.hint}
                        </div>
                      )}
                    </div>
                    {active && (
                      <span className="mt-0.5 shrink-0 text-blue-500">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

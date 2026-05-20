/**
 * 聊天页面（Day 4 任务 F：收尾打磨）
 *
 * 任务 F 增量：
 *   - 侧边栏可折叠（顶部按钮 + 主区按钮，未展开时主区可点开）
 *   - 重命名对话（双击标题进入 inline 编辑）
 *   - 流式中的对话项显示动画"●"指示
 *   - 当前项左侧加竖条标记（更醒目）
 *   - 空对话不持久化（保存时过滤）
 *   - 保留懒创建：点新建时若当前已是空对话则不重复创建
 */
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import MarkdownMessage from './components/MarkdownMessage'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}

const STORAGE_KEY_CONVERSATIONS = 'chatbot:conversations:v2'
const STORAGE_KEY_CURRENT_ID = 'chatbot:current-id:v2'
const STORAGE_KEY_SIDEBAR_OPEN = 'chatbot:sidebar-open:v2'
const MAX_MESSAGES_PER_CONV = 100
const MAX_CONVERSATIONS = 50

function newConvId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return '新对话'
  const text = firstUser.content.trim().replace(/\s+/g, ' ')
  return text.length > 20 ? text.slice(0, 20) + '…' : text || '新对话'
}

function formatRelativeDate(ts: number): string {
  const now = new Date()
  const d = new Date(ts)
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  if (ts >= startOfToday) return '今天'
  if (ts >= startOfToday - dayMs) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // 侧边栏开关
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 正在重命名的对话 id（null 表示没人在编辑）
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')

  // 流式时锁定的对话 id（用于在列表项显示"●"动画）
  const [streamingConvId, setStreamingConvId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const current = useMemo(
    () => conversations.find((c) => c.id === currentId) ?? null,
    [conversations, currentId],
  )
  const messages = current?.messages ?? []

  // —— 挂载后从 localStorage 读取 ——
  useEffect(() => {
    try {
      const rawConvs = localStorage.getItem(STORAGE_KEY_CONVERSATIONS)
      const rawCurId = localStorage.getItem(STORAGE_KEY_CURRENT_ID)
      const rawSidebar = localStorage.getItem(STORAGE_KEY_SIDEBAR_OPEN)
      if (rawConvs) {
        const parsed = JSON.parse(rawConvs) as Conversation[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed)
          const validId =
            rawCurId && parsed.some((c) => c.id === rawCurId)
              ? rawCurId
              : parsed[0].id
          setCurrentId(validId)
        }
      }
      if (rawSidebar !== null) {
        setSidebarOpen(rawSidebar === '1')
      }
    } catch (e) {
      console.warn('读取历史对话失败:', e)
    } finally {
      setHydrated(true)
    }
  }, [])

  // —— 持久化 conversations / currentId（空对话不存盘）——
  useEffect(() => {
    if (!hydrated) return
    try {
      const toSave = conversations
        .filter((c) => c.messages.length > 0) // ★ 空对话不持久化
        .slice(0, MAX_CONVERSATIONS)
        .map((c) => ({
          ...c,
          messages: c.messages.slice(-MAX_MESSAGES_PER_CONV),
        }))
      localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(toSave))
      localStorage.setItem(STORAGE_KEY_CURRENT_ID, currentId ?? '')
    } catch (e) {
      console.warn('保存对话失败:', e)
    }
  }, [conversations, currentId, hydrated])

  // —— 持久化 sidebarOpen ——
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY_SIDEBAR_OPEN, sidebarOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarOpen, hydrated])

  function updateConvMessages(
    targetId: string,
    updater: (prev: Message[]) => Message[],
  ) {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== targetId) return c
        const nextMessages = updater(c.messages)
        return {
          ...c,
          messages: nextMessages,
          updatedAt: Date.now(),
          title:
            c.title === '新对话' && nextMessages.some((m) => m.role === 'user')
              ? deriveTitle(nextMessages)
              : c.title,
        }
      }),
    )
  }

  function createConversation(): Conversation {
    const conv: Conversation = {
      id: newConvId(),
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }
    setConversations((prev) => [conv, ...prev])
    setCurrentId(conv.id)
    return conv
  }

  function handleNewConversation() {
    if (loading) return
    if (current && current.messages.length === 0) return
    createConversation()
  }

  function selectConversation(id: string) {
    if (id === currentId) return
    // 切换时如果当前正在重命名其他对话，取消编辑
    setRenamingId(null)
    setCurrentId(id)
  }

  function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (loading && id === currentId) {
      alert('当前对话正在生成中，请先停止再删除')
      return
    }
    if (!confirm('确定删除这个对话吗？')) return

    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (id === currentId) {
        setCurrentId(next.length > 0 ? next[0].id : null)
      }
      return next
    })
  }

  // —— 重命名相关 ——
  function startRename(c: Conversation, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(c.id)
    setRenamingValue(c.title)
    // 下一帧聚焦 + 全选
    setTimeout(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }, 0)
  }

  function commitRename() {
    if (!renamingId) return
    const trimmed = renamingValue.trim()
    setConversations((prev) =>
      prev.map((c) =>
        c.id === renamingId
          ? { ...c, title: trimmed || '新对话', updatedAt: Date.now() }
          : c,
      ),
    )
    setRenamingId(null)
    setRenamingValue('')
  }

  function cancelRename() {
    setRenamingId(null)
    setRenamingValue('')
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }

  function clearHistory() {
    if (loading) return
    if (!current || current.messages.length === 0) return
    if (!confirm('确定清空当前对话的所有聊天记录吗？')) return
    updateConvMessages(current.id, () => [])
  }

  // 滚动相关
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const recheck = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distanceFromBottom < 80
    }
    const onWheel = () => requestAnimationFrame(recheck)
    const onTouchMove = () => requestAnimationFrame(recheck)
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(
          e.key,
        )
      ) {
        requestAnimationFrame(recheck)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!stickToBottomRef.current) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    stickToBottomRef.current = true
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [currentId])

  async function streamReply(targetConvId: string, historyForApi: Message[]) {
    setLoading(true)
    setStreamingConvId(targetConvId)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const evt of events) {
          const line = evt.trim()
          if (!line.startsWith('data:')) continue

          const data = line.slice(5).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as { content?: string; error?: string }
            if (parsed.error) {
              throw new Error(parsed.error)
            }
            if (parsed.content) {
              updateConvMessages(targetConvId, (prevMessages) => {
                const copy = [...prevMessages]
                const last = copy[copy.length - 1]
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content + parsed.content,
                  }
                }
                return copy
              })
            }
          } catch (e) {
            console.warn('SSE parse error:', e, 'raw:', data)
          }
        }
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      if (!isAbort) {
        const msg = err instanceof Error ? err.message : '请求失败'
        updateConvMessages(targetConvId, (prevMessages) => {
          const copy = [...prevMessages]
          const last = copy[copy.length - 1]
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = {
              role: 'assistant',
              content: last.content
                ? last.content + `\n\n❌ 出错了：${msg}`
                : `❌ 出错了：${msg}`,
            }
          }
          return copy
        })
      }
    } finally {
      setLoading(false)
      setStreamingConvId(null)
      abortRef.current = null
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    let conv = current
    if (!conv) {
      conv = createConversation()
    }
    const targetId = conv.id

    const userMsg: Message = { role: 'user', content: text }
    const placeholder: Message = { role: 'assistant', content: '' }

    updateConvMessages(targetId, (prev) => [...prev, userMsg, placeholder])
    setInput('')

    await streamReply(targetId, [...conv.messages, userMsg])
  }

  async function regenerate() {
    if (loading || !current) return
    const msgs = current.messages
    const lastIdx = msgs.length - 1
    if (lastIdx < 0 || msgs[lastIdx].role !== 'assistant') return

    const historyWithoutLastReply = msgs.slice(0, lastIdx)
    if (
      historyWithoutLastReply.length === 0 ||
      historyWithoutLastReply[historyWithoutLastReply.length - 1].role !== 'user'
    ) {
      return
    }

    const targetId = current.id
    const placeholder: Message = { role: 'assistant', content: '' }
    updateConvMessages(targetId, () => [...historyWithoutLastReply, placeholder])

    await streamReply(targetId, historyWithoutLastReply)
  }

  function stopGenerating() {
    abortRef.current?.abort()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <main className="flex h-screen bg-gray-50">
      {/* ==================== 左侧栏 ==================== */}
      <aside
        className={`flex flex-col overflow-hidden border-r bg-white transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-64' : 'w-0 border-r-0'
        }`}
      >
        {/* 顶部：折叠按钮 + 新建按钮 */}
        <div className="flex items-center gap-2 border-b p-3">
          <button
            onClick={() => setSidebarOpen(false)}
            className="shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100"
            title="收起侧边栏"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
          <button
            onClick={handleNewConversation}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            title={loading ? '生成中无法新建' : '新建对话'}
          >
            <span className="text-lg leading-none">+</span>
            <span>新建对话</span>
          </button>
        </div>

        {/* 中间：对话列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              还没有对话，点上方「新建」开始吧
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => {
                const isActive = c.id === currentId
                const isStreaming = streamingConvId === c.id
                const isRenaming = renamingId === c.id
                return (
                  <li key={c.id}>
                    <div
                      onClick={() => !isRenaming && selectConversation(c.id)}
                      className={`group relative cursor-pointer rounded-lg px-3 py-2 transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {/* 当前项左侧的竖条标记 */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-blue-500" />
                      )}

                      <div className="flex items-center justify-between gap-2">
                        {isRenaming ? (
                          <input
                            ref={renameInputRef}
                            value={renamingValue}
                            onChange={(e) => setRenamingValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={commitRename}
                            onClick={(e) => e.stopPropagation()}
                            maxLength={50}
                            className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        ) : (
                          <span
                            className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium"
                            onDoubleClick={(e) => startRename(c, e)}
                            title="双击重命名"
                          >
                            {isStreaming && (
                              <span
                                className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500"
                                title="正在生成"
                              />
                            )}
                            <span className="truncate">
                              {c.title || '新对话'}
                            </span>
                          </span>
                        )}

                        {!isRenaming && (
                          <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                            {/* 重命名按钮 */}
                            <button
                              onClick={(e) => startRename(c, e)}
                              className="rounded p-1 text-gray-400 transition hover:bg-blue-100 hover:text-blue-600"
                              title="重命名"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>
                            {/* 删除按钮 */}
                            <button
                              onClick={(e) => deleteConversation(c.id, e)}
                              className="rounded p-1 text-gray-400 transition hover:bg-red-100 hover:text-red-600"
                              title="删除对话"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-xs text-gray-400">
                        <span>{formatRelativeDate(c.updatedAt)}</span>
                        <span>{c.messages.length} 条</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 底部：计数 */}
        <div className="border-t px-3 py-2 text-center text-xs text-gray-400">
          {conversations.length} / {MAX_CONVERSATIONS} 个对话
        </div>
      </aside>

      {/* ==================== 右侧：聊天主区 ==================== */}
      <section className="flex flex-1 flex-col">
        {/* 顶部标题栏 */}
        <header className="border-b bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* 侧边栏收起时显示展开按钮 */}
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="shrink-0 rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100"
                  title="展开侧边栏"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                </button>
              )}
              <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-gray-800 sm:text-xl">
                <span className="shrink-0">💬</span>
                <span className="truncate">
                  {current?.title || 'AI ChatBot'}
                </span>
                <span className="hidden shrink-0 text-sm font-normal text-gray-500 sm:inline">
                  · DeepSeek
                </span>
              </h1>
            </div>
            <button
              onClick={clearHistory}
              disabled={loading || !current || current.messages.length === 0}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-600"
              title="清空当前对话的消息"
            >
              🗑️ 清空
            </button>
          </div>
        </header>

        {/* 消息列表 */}
        <div
          ref={scrollRef}
          className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-2 text-4xl">🤖</div>
                <p>
                  {current
                    ? '开始跟 AI 聊天吧！'
                    : '点左侧"新建对话"开始聊天'}
                </p>
                <p className="mt-1 text-xs">
                  提示：Enter 发送，Shift+Enter 换行
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1
                const isStreaming =
                  loading && isLast && m.role === 'assistant'
                const canRegenerate =
                  isLast && m.role === 'assistant' && !loading && m.content !== ''
                return (
                  <li
                    key={i}
                    className={`flex flex-col ${
                      m.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                        m.role === 'user'
                          ? 'whitespace-pre-wrap bg-blue-500 text-white'
                          : 'bg-white text-gray-800'
                      }`}
                    >
                      {isStreaming && m.content === '' ? (
                        <span className="inline-flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]"></span>
                          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]"></span>
                          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></span>
                        </span>
                      ) : m.role === 'assistant' ? (
                        <>
                          <MarkdownMessage content={m.content} />
                          {isStreaming && (
                            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-500 align-middle" />
                          )}
                        </>
                      ) : (
                        m.content
                      )}
                    </div>
                    {canRegenerate && (
                      <button
                        onClick={regenerate}
                        className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                        title="对同一个问题重新生成回答"
                      >
                        <span>🔄</span>
                        <span>重新生成</span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 底部输入栏 */}
        <div className="border-t bg-white px-4 py-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <textarea
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={1}
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            {loading ? (
              <button
                onClick={stopGenerating}
                className="rounded-xl bg-red-500 px-6 py-2 font-medium text-white shadow-sm transition hover:bg-red-600"
              >
                停止
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="rounded-xl bg-blue-500 px-6 py-2 font-medium text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                发送
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

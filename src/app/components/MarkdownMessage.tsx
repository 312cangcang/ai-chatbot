/**
 * MarkdownMessage：把 LLM 返回的 Markdown 字符串渲染成漂亮的 React 组件
 *
 * 用到的库：
 *   - react-markdown：核心渲染器，把 Markdown 字符串转成 React 元素
 *   - remark-gfm：GitHub Flavored Markdown 插件（支持表格、删除线、任务列表等）
 *   - react-syntax-highlighter：代码块语法高亮（VSCode 风格的彩色着色）
 *
 * 设计要点：
 *   - 通过 `components` prop 自定义每种 Markdown 元素的渲染方式
 *   - 代码块（```js ... ```）→ 用 SyntaxHighlighter 着色
 *   - 行内代码（`xxx`）→ 用浅灰底加 monospace 字体
 *   - 链接 → 加蓝色 + 下划线 + 新标签打开
 */
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

type Props = {
  content: string
}

export default function MarkdownMessage({ content }: Props) {
  return (
    <div className="markdown-body text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ============ 代码（行内 + 块级） ============
          code(props) {
            const { className, children, ...rest } = props
            // ReactMarkdown 通过 className="language-xxx" 区分代码块和行内代码
            const match = /language-(\w+)/.exec(className || '')
            const isBlock = !!match

            if (isBlock) {
              // 代码块：交给 SyntaxHighlighter 渲染
              return (
                <SyntaxHighlighter
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={oneDark as any}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: '0.5em 0',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            }

            // 行内代码 `xxx`
            return (
              <code
                className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[13px] text-pink-600"
                {...rest}
              >
                {children}
              </code>
            )
          },

          // ============ 链接 ============
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {children}
              </a>
            )
          },

          // ============ 标题 ============
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-xl font-bold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-lg font-bold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-base font-bold">{children}</h3>
          ),

          // ============ 段落 ============
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,

          // ============ 列表 ============
          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="my-0.5">{children}</li>,

          // ============ 引用 ============
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-gray-300 pl-3 text-gray-600">
              {children}
            </blockquote>
          ),

          // ============ 表格（remark-gfm 提供） ============
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="border-collapse border border-gray-300 text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 bg-gray-100 px-3 py-1 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-3 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// src/renderer/components/chat/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 text-sm">{children}</ol>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        code: ({ children, className }) => {
          const isInline = !className
          return isInline ? (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {children}
            </code>
          ) : (
            <pre className="mb-2 overflow-x-auto rounded-8 bg-slate-900 p-3 text-xs text-slate-50">
              <code>{children}</code>
            </pre>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

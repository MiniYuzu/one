// src/renderer/components/chat/UserBubble.tsx
interface UserBubbleProps {
  content: string
}

export function UserBubble({ content }: UserBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-16 bg-indigo-500 px-4 py-3 text-white">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

const EMOJIS = ['🤤', '🫦', '😮‍💨', '🧀']

interface ReactionBarProps {
  targetType: 'activity' | 'interaction'
  targetId: string
  initialCounts?: Record<string, number>
  initialUserReactions?: string[]
}

export default function ReactionBar({
  targetType,
  targetId,
  initialCounts = {},
  initialUserReactions = []
}: ReactionBarProps) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts)
  const [userReactions, setUserReactions] = useState<string[]>(initialUserReactions)
  const [loading, setLoading] = useState(false)

  const toggleReaction = async (emoji: string) => {
    if (loading) return
    setLoading(true)

    // Optimistic update
    const wasReacted = userReactions.includes(emoji)
    if (wasReacted) {
      setUserReactions(prev => prev.filter(e => e !== emoji))
      setCounts(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] || 0) - 1) }))
    } else {
      setUserReactions(prev => [...prev, emoji])
      setCounts(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }))
    }

    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, emoji }),
      })
    } catch (e) {
      // Revert on error
      if (wasReacted) {
        setUserReactions(prev => [...prev, emoji])
        setCounts(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }))
      } else {
        setUserReactions(prev => prev.filter(e => e !== emoji))
        setCounts(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] || 0) - 1) }))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {EMOJIS.map(emoji => {
        const count = counts[emoji] || 0
        const isReacted = userReactions.includes(emoji)

        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            disabled={loading}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm transition-all
              ${isReacted
                ? 'bg-pink-500/30 border border-pink-500/50'
                : 'bg-white/10 border border-white/10 hover:bg-white/20 hover:border-white/30'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-base">{emoji}</span>
            {count > 0 && (
              <span className={`text-xs font-medium ${isReacted ? 'text-pink-400' : 'text-white/60'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

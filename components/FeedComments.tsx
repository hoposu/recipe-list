'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ReactionBar from './ReactionBar'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: {
    display_name: string | null
    email: string
    avatar_url: string | null
  }
}

interface FeedCommentsProps {
  activityId: string
}

export default function FeedComments({ activityId }: FeedCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close comments when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowComments(false)
      }
    }

    if (showComments) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showComments])

  useEffect(() => {
    if (showComments) {
      fetchComments()
    }
  }, [activityId, showComments])

  const fetchComments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/activity-comments?activity_id=${activityId}`)
      const data = await res.json()
      if (data.comments) setComments(data.comments)
    } catch (e) {
      console.error('Error fetching comments:', e)
    } finally {
      setLoading(false)
    }
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/activity-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId, content: newComment }),
      })
      const data = await res.json()
      if (data.comment) {
        setComments(prev => [...prev, data.comment])
        setNewComment('')
      }
    } catch (e) {
      console.error('Error posting comment:', e)
    } finally {
      setSubmitting(false)
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div ref={containerRef} className="mt-3 pt-3 border-t border-white/10">
      {/* Toggle comments button */}
      <button
        onClick={() => setShowComments(!showComments)}
        className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-2"
      >
        <span>💬</span>
        <span>
          {showComments ? 'Hide comments' : `Comments${comments.length > 0 ? ` (${comments.length})` : ''}`}
        </span>
      </button>

      {showComments && (
        <div className="mt-3 space-y-3">
          {/* Comments list */}
          {loading ? (
            <p className="text-sm text-white/40">Loading...</p>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map(comment => {
                const userName = comment.profiles?.display_name || comment.profiles?.email?.split('@')[0] || 'Someone'
                return (
                  <div key={comment.id} className="flex gap-2">
                    <Link href={`/profile/${comment.user_id}`} className="flex-shrink-0">
                      {comment.profiles?.avatar_url ? (
                        <img
                          src={comment.profiles.avatar_url}
                          alt={userName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="bg-white/5 rounded-2xl px-4 py-2">
                        <Link
                          href={`/profile/${comment.user_id}`}
                          className="text-sm font-medium text-white hover:text-pink-400 transition-colors"
                        >
                          {userName}
                        </Link>
                        <p className="text-sm text-white/80">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-2">
                        <span className="text-xs text-white/40">{formatTimeAgo(comment.created_at)}</span>
                        <ReactionBar targetType="activity" targetId={comment.id} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-white/40">No comments yet. Be the first!</p>
          )}

          {/* Add comment form */}
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
            >
              {submitting ? '...' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

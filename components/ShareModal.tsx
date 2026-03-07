'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface ShareModalProps {
  listId: string
  listName: string
  onClose: () => void
}

export default function ShareModal({ listId, listName, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setMessage(null)

    try {
      // Look up user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (profileError || !profile) {
        setMessage({ type: 'error', text: 'No user found with that email. They need to sign up first.' })
        setLoading(false)
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('shopping_list_members')
        .select('id')
        .eq('list_id', listId)
        .eq('user_id', profile.id)
        .single()

      if (existing) {
        setMessage({ type: 'error', text: 'This user already has access to this list.' })
        setLoading(false)
        return
      }

      // Add as member
      const { error: memberError } = await supabase
        .from('shopping_list_members')
        .insert({
          list_id: listId,
          user_id: profile.id,
          role: role,
        })

      if (memberError) throw memberError

      setMessage({ type: 'success', text: `Shared with ${email}!` })
      setEmail('')
    } catch (error) {
      console.error('Share error:', error)
      setMessage({ type: 'error', text: 'Failed to share. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Share List
            </h2>
            <p className="text-sm text-zinc-400">
              {listName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleShare} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Permission
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white focus:ring-2 focus:ring-violet-500"
            >
              <option value="editor">Can edit (check off items)</option>
              <option value="viewer">View only</option>
            </select>
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex-1 py-2 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-700">
          <p className="text-xs text-zinc-400">
            People you share with will see this list in their dashboard and can check off items in real-time.
          </p>
        </div>
      </div>
    </div>
  )
}

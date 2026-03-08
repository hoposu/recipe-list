'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface ShareModalProps {
  listId: string
  listName: string
  onClose: () => void
}

interface UserWithSharedCount {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  sharedCount: number
  alreadyHasAccess: boolean
}

export default function ShareModal({ listId, listName, onClose }: ShareModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [users, setUsers] = useState<UserWithSharedCount[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  // Fetch all users with their shared list counts
  useEffect(() => {
    const fetchUsers = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) return

      // Get all profiles except current user
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .neq('id', currentUser.id)

      if (!profiles || profiles.length === 0) {
        setLoadingUsers(false)
        return
      }

      // Get lists owned by current user
      const { data: ownedLists } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('owner_id', currentUser.id)

      const ownedListIds = ownedLists?.map(l => l.id) || []

      // Get all members of current user's lists
      const { data: members } = ownedListIds.length > 0
        ? await supabase
            .from('shopping_list_members')
            .select('user_id, list_id')
            .in('list_id', ownedListIds)
            .neq('user_id', currentUser.id)
        : { data: [] }

      // Get members who already have access to THIS list
      const { data: currentListMembers } = await supabase
        .from('shopping_list_members')
        .select('user_id')
        .eq('list_id', listId)

      const currentListMemberIds = new Set(currentListMembers?.map(m => m.user_id) || [])

      // Count shared lists per user
      const sharedCounts = new Map<string, number>()
      for (const member of members || []) {
        sharedCounts.set(member.user_id, (sharedCounts.get(member.user_id) || 0) + 1)
      }

      // Build user list with shared counts
      const usersWithCounts: UserWithSharedCount[] = profiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        sharedCount: sharedCounts.get(profile.id) || 0,
        alreadyHasAccess: currentListMemberIds.has(profile.id),
      }))

      // Sort by shared count descending
      usersWithCounts.sort((a, b) => b.sharedCount - a.sharedCount)

      setUsers(usersWithCounts)
      setLoadingUsers(false)
    }

    fetchUsers()
  }, [supabase, listId])

  const handleShare = async () => {
    if (!selectedUserId) return

    setLoading(true)
    setMessage(null)

    try {
      // Add as member
      const { error: memberError } = await supabase
        .from('shopping_list_members')
        .insert({
          list_id: listId,
          user_id: selectedUserId,
          role: role,
        })

      if (memberError) throw memberError

      const sharedUser = users.find(u => u.id === selectedUserId)
      setMessage({ type: 'success', text: `Shared with ${sharedUser?.display_name || sharedUser?.email}!` })

      // Update the user's status in the list
      setUsers(prev => prev.map(u =>
        u.id === selectedUserId ? { ...u, alreadyHasAccess: true, sharedCount: u.sharedCount + 1 } : u
      ))
      setSelectedUserId(null)
    } catch (error) {
      console.error('Share error:', error)
      setMessage({ type: 'error', text: 'Failed to share. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="heading-serif text-2xl text-white">
              Share List
            </h2>
            <p className="text-sm text-white/50 mt-1">
              {listName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* User selection */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Select a person to share with
            </label>

            {loadingUsers ? (
              <div className="text-white/40 text-sm py-4 text-center">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-white/40 text-sm py-4 text-center">No other users found</div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-xl bg-white/5 border border-white/10">
                {users.map((user) => {
                  const displayName = user.display_name || user.email.split('@')[0]
                  const isSelected = selectedUserId === user.id

                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={user.alreadyHasAccess}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full px-4 py-3 text-left transition-all flex items-center gap-3 border-b border-white/5 last:border-b-0
                        ${user.alreadyHasAccess
                          ? 'opacity-50 cursor-not-allowed'
                          : isSelected
                            ? 'bg-pink-500/20 border-pink-500/30'
                            : 'hover:bg-white/10'
                        }
                      `}
                    >
                      {/* Avatar */}
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {displayName}
                        </p>
                        {user.display_name && (
                          <p className="text-white/40 text-xs truncate">{user.email}</p>
                        )}
                      </div>

                      {/* Shared count or status */}
                      {user.alreadyHasAccess ? (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
                          Has access
                        </span>
                      ) : user.sharedCount > 0 ? (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full border border-purple-500/30">
                          {user.sharedCount} {user.sharedCount === 1 ? 'list' : 'lists'}
                        </span>
                      ) : null}

                      {/* Selection indicator */}
                      {isSelected && !user.alreadyHasAccess && (
                        <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Permission selector - only show when user selected */}
          {selectedUser && !selectedUser.alreadyHasAccess && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Permission
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
              >
                <option value="editor">Can edit (check off items)</option>
                <option value="viewer">View only</option>
              </select>
            </div>
          )}

          {message && (
            <div className={`text-sm px-4 py-3 rounded-xl ${
              message.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={loading || !selectedUserId || selectedUser?.alreadyHasAccess}
              className="flex-1 py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 disabled:bg-white/30 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 glass-button text-white/80 hover:text-white rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40">
            People you share with will see this list in their profile and can check off items in real-time.
          </p>
        </div>
      </div>
    </div>
  )
}

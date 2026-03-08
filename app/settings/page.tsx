'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'

interface Tag {
  id: string
  name: string
  color_class: string
}

// Available color options for new tags
const TAG_COLORS = [
  { name: 'Green', class: 'bg-green-600/30 text-green-400 border-green-600/50' },
  { name: 'Amber', class: 'bg-amber-600/30 text-amber-400 border-amber-600/50' },
  { name: 'Yellow', class: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50' },
  { name: 'Cyan', class: 'bg-cyan-600/30 text-cyan-400 border-cyan-600/50' },
  { name: 'Red', class: 'bg-red-600/30 text-red-400 border-red-600/50' },
  { name: 'Pink', class: 'bg-pink-600/30 text-pink-400 border-pink-600/50' },
  { name: 'Orange', class: 'bg-orange-600/30 text-orange-400 border-orange-600/50' },
  { name: 'Fuchsia', class: 'bg-fuchsia-600/30 text-fuchsia-400 border-fuchsia-600/50' },
  { name: 'Indigo', class: 'bg-indigo-600/30 text-indigo-400 border-indigo-600/50' },
  { name: 'Rose', class: 'bg-rose-600/30 text-rose-400 border-rose-600/50' },
  { name: 'Violet', class: 'bg-violet-600/30 text-violet-400 border-violet-600/50' },
  { name: 'Blue', class: 'bg-blue-600/30 text-blue-400 border-blue-600/50' },
]

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].class)
  const [creatingTag, setCreatingTag] = useState(false)
  const [deletingTag, setDeletingTag] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setEmail(user.email || '')

      // Fetch profile including admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, is_admin')
        .eq('id', user.id)
        .single()

      if (profile) {
        setDisplayName(profile.display_name || '')
        setAvatarUrl(profile.avatar_url || null)
        setIsAdmin(profile.is_admin === true)
      }

      // Fetch tags for admin section
      const { data: tagsData } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      setTags(tagsData || [])

      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'Profile updated!' })
    }

    setSaving(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Upload to storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setMessage({ type: 'error', text: 'Failed to upload: ' + uploadError.message })
      setUploading(false)
      return
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const newAvatarUrl = urlData.publicUrl + '?t=' + Date.now() // Cache bust

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: newAvatarUrl })
      .eq('id', user.id)

    if (updateError) {
      setMessage({ type: 'error', text: 'Failed to save avatar: ' + updateError.message })
    } else {
      setAvatarUrl(newAvatarUrl)
      setMessage({ type: 'success', text: 'Avatar updated!' })
    }

    setUploading(false)
  }

  const removeAvatar = async () => {
    setSaving(true)
    setMessage(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to remove avatar: ' + error.message })
    } else {
      setAvatarUrl(null)
      setMessage({ type: 'success', text: 'Avatar removed!' })
    }

    setSaving(false)
  }

  // Admin: Create a new tag
  const createTag = async () => {
    if (!newTagName.trim() || !isAdmin) return
    setCreatingTag(true)
    setMessage(null)

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color_class: newTagColor,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to create tag' })
      } else {
        setTags(prev => [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name)))
        setNewTagName('')
        setMessage({ type: 'success', text: `Tag "${data.tag.name}" created!` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create tag' })
    }

    setCreatingTag(false)
  }

  // Admin: Delete a tag
  const deleteTag = async (tagName: string) => {
    if (!isAdmin) return
    setDeletingTag(tagName)
    setMessage(null)

    try {
      const response = await fetch(`/api/tags?name=${encodeURIComponent(tagName)}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete tag' })
      } else {
        setTags(prev => prev.filter(t => t.name !== tagName))
        setMessage({
          type: 'success',
          text: `Tag "${tagName}" deleted! Removed from ${data.recipesUpdated} recipe(s).`
        })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete tag' })
    }

    setDeletingTag(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <Logo />
            <div className="flex items-center gap-4">
              <Link
                href="/explore"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Explore
              </Link>
              <Link
                href="/profile"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Dashboard
              </Link>
              <span className="text-sm text-white font-medium">Settings</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          Profile Settings
        </h1>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-red-600/20 text-red-400 border border-red-600/30'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-6">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Profile Picture
            </label>
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-violet-600 flex items-center justify-center text-white text-2xl font-bold">
                  {displayName ? displayName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {avatarUrl && (
                  <button
                    onClick={removeAvatar}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., DillyDilly"
              className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500 mt-1">
              This is how your name will appear to others
            </p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-400 cursor-not-allowed"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Admin Section - Tag Management */}
        {isAdmin && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-red-600/30 text-red-400 text-xs rounded">Admin</span>
              Tag Management
            </h2>

            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-6">
              {/* Existing Tags */}
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-3">
                  Existing Tags ({tags.length})
                </h3>
                {tags.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No tags yet. Create one below.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className={`group flex items-center gap-1 text-sm px-3 py-1 rounded-full border ${tag.color_class}`}
                      >
                        <span>{tag.name}</span>
                        <button
                          onClick={() => deleteTag(tag.name)}
                          disabled={deletingTag === tag.name}
                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 disabled:text-zinc-500"
                          title="Delete this tag"
                        >
                          {deletingTag === tag.name ? '...' : '×'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create New Tag */}
              <div className="border-t border-zinc-700 pt-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">
                  Create New Tag
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Tag Name</label>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="e.g., Quick, Healthy, Italian"
                      className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setNewTagColor(color.class)}
                          className={`px-3 py-1 text-xs rounded-full border transition-all ${color.class} ${
                            newTagColor === color.class ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-800' : ''
                          }`}
                        >
                          {color.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={createTag}
                      disabled={creatingTag || !newTagName.trim()}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-600 disabled:text-zinc-400 text-white font-medium rounded-lg transition-colors"
                    >
                      {creatingTag ? 'Creating...' : 'Create Tag'}
                    </button>
                    {newTagName && (
                      <span className={`text-sm px-3 py-1 rounded-full border ${newTagColor}`}>
                        Preview: {newTagName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-500">
                Deleting a tag will remove it from all recipes that use it.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import ShareModal from '@/components/ShareModal'
import { ShoppingListSkeleton } from '@/components/Skeleton'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ShoppingListItem {
  id: string
  ingredient_name: string
  quantity: number | null
  unit: string | null
  category: string | null
  checked: boolean
}

interface ShoppingList {
  id: string
  name: string
  owner_id: string
  created_at: string
}

interface Member {
  user_id: string
  role: string
  profiles: {
    email: string
    display_name: string | null
    avatar_url: string | null
  }
}

interface LinkedRecipe {
  id: string
  title: string
}

const categoryOrder = ['produce', 'dairy', 'meat', 'seafood', 'bakery', 'frozen', 'pantry', 'beverages', 'other']

const categoryEmojis: Record<string, string> = {
  produce: '🥬',
  dairy: '🧀',
  meat: '🥩',
  seafood: '🐟',
  bakery: '🥖',
  frozen: '🧊',
  pantry: '🥫',
  beverages: '🥤',
  other: '📦',
}

export default function ShoppingListPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [linkedRecipes, setLinkedRecipes] = useState<LinkedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchList = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: listData } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('id', listId)
      .single()

    setList(listData)
    setIsOwner(listData?.owner_id === user?.id)

    const { data: itemsData } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('category')

    setItems(itemsData || [])

    // Fetch members
    const { data: membersData } = await supabase
      .from('shopping_list_members')
      .select('user_id, role')
      .eq('list_id', listId)

    // Fetch profiles for members
    const memberUserIds = membersData?.map(m => m.user_id) || []
    let membersWithProfiles: Member[] = []
    if (memberUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', memberUserIds)

      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || [])
      membersWithProfiles = (membersData || []).map(m => ({
        user_id: m.user_id,
        role: m.role,
        profiles: profileMap.get(m.user_id) || { email: '', display_name: null, avatar_url: null }
      }))
    }

    setMembers(membersWithProfiles)

    // Fetch linked recipes
    const { data: recipesData } = await supabase
      .from('shopping_list_recipes')
      .select(`
        recipes (
          id,
          title
        )
      `)
      .eq('list_id', listId)

    const recipes = recipesData?.map(r => (r.recipes as unknown as LinkedRecipe)).filter(Boolean) || []
    setLinkedRecipes(recipes)

    setLoading(false)
  }, [listId, supabase])

  // Set up real-time subscription
  useEffect(() => {
    fetchList()

    // Subscribe to changes on shopping_list_items for this list
    const channel = supabase
      .channel(`shopping_list_${listId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          const updatedItem = payload.new as ShoppingListItem
          setItems(prev =>
            prev.map(item =>
              item.id === updatedItem.id ? updatedItem : item
            )
          )
          setSyncing(true)
          setTimeout(() => setSyncing(false), 500)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          const newItem = payload.new as ShoppingListItem
          setItems(prev => [...prev, newItem])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          const deletedItem = payload.old as ShoppingListItem
          setItems(prev => prev.filter(item => item.id !== deletedItem.id))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [listId, supabase, fetchList])

  const toggleItem = async (itemId: string, currentChecked: boolean) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, checked: !currentChecked } : item
      )
    )

    await supabase
      .from('shopping_list_items')
      .update({ checked: !currentChecked })
      .eq('id', itemId)
  }

  const deleteList = async () => {
    if (!isOwner || !list) return
    setDeleting(true)

    await supabase
      .from('shopping_list_items')
      .delete()
      .eq('list_id', list.id)

    await supabase
      .from('shopping_list_members')
      .delete()
      .eq('list_id', list.id)

    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', list.id)

    if (!error) {
      router.push('/profile')
      router.refresh()
    } else {
      setDeleting(false)
      alert('Failed to delete list')
    }
  }

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim() || !list) return

    setAddingItem(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: newItem, error } = await supabase
      .from('shopping_list_items')
      .insert({
        list_id: list.id,
        ingredient_name: newItemName.trim(),
        category: 'other',
        checked: false,
        added_by: user?.id,
      })
      .select()
      .single()

    if (!error && newItem) {
      setItems(prev => [...prev, newItem])
      setNewItemName('')
    }
    setAddingItem(false)
  }

  const checkedCount = items.filter(i => i.checked).length
  const totalCount = items.length
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {} as Record<string, ShoppingListItem[]>)

  if (loading) {
    return <ShoppingListSkeleton />
  }

  if (!list) {
    return (
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center glass-card p-8">
            <p className="text-white/50 mb-4">Shopping list not found</p>
            <Link href="/profile" className="text-pink-400 hover:text-pink-300">
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Aurora background */}
      <div className="aurora-bg" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b border-white/10 rounded-none">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/feed" className="flex items-center gap-2">
              <span className="heading-serif text-2xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Recipe Pals
              </span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/explore" className="glass-button text-sm text-white/90 hover:text-white">
                Explore
              </Link>
              <Link href="/profile" className="glass-button text-sm text-white/90 hover:text-white">
                Profile
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* List Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="heading-serif text-4xl text-white mb-2">
                {list.name}
              </h1>
              <p className="text-white/40 text-sm">
                Created {new Date(list.created_at).toLocaleDateString()}
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-4 py-2 bg-white text-black font-semibold text-sm rounded-xl hover:bg-white/90 transition-colors"
                >
                  Share
                </button>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 glass-button text-red-400 hover:text-red-300 text-sm rounded-xl transition-colors"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2 glass-card px-3 py-2 rounded-xl">
                    <span className="text-sm text-white/60">Sure?</span>
                    <button
                      onClick={deleteList}
                      disabled={deleting}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-red-800 text-white text-xs font-medium rounded-lg"
                    >
                      {deleting ? '...' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="px-2 py-1 text-xs text-white/40 hover:text-white/80"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Member Avatars */}
          {members.length > 0 && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((member) => {
                  const name = member.profiles?.display_name || member.profiles?.email || 'U'
                  return member.profiles?.avatar_url ? (
                    <img
                      key={member.user_id}
                      src={member.profiles.avatar_url}
                      alt={name}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-black/50"
                    />
                  ) : (
                    <div
                      key={member.user_id}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium ring-2 ring-black/50"
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )
                })}
                {members.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-medium ring-2 ring-black/50">
                    +{members.length - 5}
                  </div>
                )}
              </div>
              <span className="text-white/40 text-sm">
                {members.length} {members.length === 1 ? 'person' : 'people'}
              </span>
            </div>
          )}
        </div>

        {/* Linked Recipes */}
        {linkedRecipes.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <p className="text-sm text-white/40 mb-3">Recipes in this list</p>
            <div className="flex flex-wrap gap-2">
              {linkedRecipes.map(recipe => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="px-3 py-1.5 bg-pink-500/20 text-pink-400 text-sm rounded-full hover:bg-pink-500/30 transition-colors border border-pink-500/30"
                >
                  {recipe.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="glass-card p-5 mb-6">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white/50 flex items-center gap-2">
              Progress
              {syncing && (
                <span className="inline-flex items-center text-xs text-pink-400">
                  <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse mr-1" />
                  syncing
                </span>
              )}
            </span>
            <span className="font-medium text-white">
              {checkedCount} of {totalCount} items
            </span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progress === 100 && totalCount > 0 && (
            <p className="text-emerald-400 text-sm mt-3 font-medium text-center">
              All done! Great job!
            </p>
          )}
        </div>

        {/* Shopping List Items */}
        <div className="glass-card p-6">
          {items.length === 0 ? (
            <p className="text-center text-white/40 py-8">
              No items in this list yet
            </p>
          ) : (
            <div className="space-y-6">
              {categoryOrder.map(category => {
                const categoryItems = groupedItems[category]
                if (!categoryItems || categoryItems.length === 0) return null

                return (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <span>{categoryEmojis[category] || '📦'}</span>
                      <span>{category}</span>
                    </h3>
                    <div className="space-y-2">
                      {categoryItems.map(item => (
                        <label
                          key={item.id}
                          className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                            item.checked
                              ? 'bg-white/5'
                              : 'bg-white/10 hover:bg-white/15'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleItem(item.id, item.checked)}
                            className="sr-only"
                          />
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all ${
                            item.checked
                              ? 'bg-gradient-to-r from-pink-500 to-purple-500 border-transparent text-white'
                              : 'border-white/30'
                          }`}>
                            {item.checked && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`flex-1 ${
                            item.checked
                              ? 'line-through text-white/30'
                              : 'text-white'
                          }`}>
                            {item.ingredient_name}
                          </span>
                          {(item.quantity || item.unit) && (
                            <span className={`text-sm ml-2 ${
                              item.checked
                                ? 'text-white/20'
                                : 'text-white/50'
                            }`}>
                              {item.quantity && item.unit
                                ? `${item.quantity} ${item.unit}`
                                : item.quantity || ''}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Item Form */}
          <form onSubmit={addItem} className="mt-6 pt-6 border-t border-white/10">
            <div className="flex gap-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add an item..."
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent text-sm"
                disabled={addingItem}
              />
              <button
                type="submit"
                disabled={addingItem || !newItemName.trim()}
                className="px-6 py-3 bg-white text-black font-semibold text-sm rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {addingItem ? '...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          listId={listId}
          listName={list.name}
          onClose={() => {
            setShowShareModal(false)
            fetchList()
          }}
        />
      )}
    </div>
  )
}

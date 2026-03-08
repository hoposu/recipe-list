'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import ShareModal from '@/components/ShareModal'
import Logo from '@/components/Logo'
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
  }
}

interface LinkedRecipe {
  id: string
  title: string
}

const categoryOrder = ['produce', 'dairy', 'meat', 'seafood', 'bakery', 'frozen', 'pantry', 'beverages', 'other']

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
      .select(`
        user_id,
        role,
        profiles (
          email,
          display_name
        )
      `)
      .eq('list_id', listId)

    setMembers(membersData as unknown as Member[] || [])

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
          // Update the item in local state
          const updatedItem = payload.new as ShoppingListItem
          setItems(prev =>
            prev.map(item =>
              item.id === updatedItem.id ? updatedItem : item
            )
          )
          // Show sync indicator briefly
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

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [listId, supabase, fetchList])

  const toggleItem = async (itemId: string, currentChecked: boolean) => {
    // Optimistic update
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, checked: !currentChecked } : item
      )
    )

    // Update in database
    await supabase
      .from('shopping_list_items')
      .update({ checked: !currentChecked })
      .eq('id', itemId)
  }

  const deleteList = async () => {
    if (!isOwner || !list) return
    setDeleting(true)

    // Delete items first
    await supabase
      .from('shopping_list_items')
      .delete()
      .eq('list_id', list.id)

    // Delete members
    await supabase
      .from('shopping_list_members')
      .delete()
      .eq('list_id', list.id)

    // Delete list
    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', list.id)

    if (!error) {
      router.push('/dashboard')
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
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">Shopping list not found</p>
          <Link href="/dashboard" className="text-violet-400 hover:text-violet-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm text-violet-400 hover:text-violet-300">
              Explore
            </Link>
            <Link href="/dashboard" className="text-sm text-violet-400 hover:text-violet-300">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {list.name}
            </h1>
            <p className="text-sm text-zinc-400">
              Created {new Date(list.created_at).toLocaleDateString()}
            </p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Share
              </button>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 border border-red-600 text-red-400 hover:bg-red-600/20 text-sm font-semibold rounded-lg transition-colors"
                >
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-zinc-700 rounded-lg px-3 py-2">
                  <span className="text-sm text-zinc-300">Sure?</span>
                  <button
                    onClick={deleteList}
                    disabled={deleting}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-xs font-medium rounded"
                  >
                    {deleting ? '...' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shared With */}
        {members.length > 1 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-6">
            <p className="text-sm text-zinc-400">
              Shared with:{' '}
              {members
                .filter(m => m.role !== 'owner')
                .map(m => m.profiles?.email || 'Unknown')
                .join(', ')}
            </p>
          </div>
        )}

        {/* Linked Recipes */}
        {linkedRecipes.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-6">
            <p className="text-sm text-zinc-400 mb-2">Recipes in this list:</p>
            <div className="flex flex-wrap gap-2">
              {linkedRecipes.map(recipe => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="px-3 py-1 bg-violet-600/20 text-violet-400 text-sm rounded-lg hover:bg-violet-600/30 transition-colors"
                >
                  {recipe.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400 flex items-center gap-2">
              Progress
              {syncing && (
                <span className="inline-flex items-center text-xs text-violet-400">
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse mr-1" />
                  syncing
                </span>
              )}
            </span>
            <span className="font-medium text-zinc-200">
              {checkedCount} of {totalCount} items
            </span>
          </div>
          <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Shopping List Items */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
          {items.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">
              No items in this list yet
            </p>
          ) : (
            <div className="space-y-6">
              {categoryOrder.map(category => {
                const categoryItems = groupedItems[category]
                if (!categoryItems || categoryItems.length === 0) return null

                return (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {categoryItems.map(item => (
                        <label
                          key={item.id}
                          className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                            item.checked
                              ? 'bg-zinc-700/30'
                              : 'bg-zinc-700/50 hover:bg-zinc-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleItem(item.id, item.checked)}
                            className="sr-only"
                          />
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 transition-colors ${
                            item.checked
                              ? 'bg-violet-500 border-violet-500 text-white'
                              : 'border-zinc-600'
                          }`}>
                            {item.checked && '✓'}
                          </div>
                          <span className={`flex-1 ${
                            item.checked
                              ? 'line-through text-zinc-500'
                              : 'text-zinc-200'
                          }`}>
                            {item.ingredient_name}
                          </span>
                          <span className={`text-sm ${
                            item.checked
                              ? 'text-zinc-500'
                              : 'text-zinc-400'
                          }`}>
                            {item.quantity && item.unit
                              ? `${item.quantity} ${item.unit}`
                              : item.quantity || ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Item Form */}
          <form onSubmit={addItem} className="mt-6 pt-4 border-t border-zinc-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add an item..."
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                disabled={addingItem}
              />
              <button
                type="submit"
                disabled={addingItem || !newItemName.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white text-sm font-semibold rounded-lg transition-colors"
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
            fetchList() // Refresh members list
          }}
        />
      )}
    </div>
  )
}

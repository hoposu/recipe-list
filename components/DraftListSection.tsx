'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useDraftList } from '@/hooks/useDraftList'
import { createClient } from '@/lib/supabase'

export default function DraftListSection() {
  const { draftRecipes, removeRecipe, clearDraft, count } = useDraftList()
  const [savingList, setSavingList] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  if (count === 0) {
    return null
  }

  const handleCreateList = async () => {
    if (draftRecipes.length === 0) return
    setSavingList(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch ingredients for all recipes
      const recipeIds = draftRecipes.map(r => r.id)
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('recipe_id, name, quantity, unit, category')
        .in('recipe_id', recipeIds)

      // Create shopping list
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .insert({
          owner_id: user.id,
          name: `Shopping List - ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single()

      if (listError) throw listError

      // Add owner as member
      await supabase
        .from('shopping_list_members')
        .insert({ list_id: list.id, user_id: user.id, role: 'owner' })

      // Consolidate ingredients
      const consolidated = new Map<string, {
        name: string
        quantity: number
        unit: string | null
        category: string
      }>()

      for (const ing of ingredients || []) {
        const key = `${ing.name.toLowerCase()}_${(ing.unit || '').toLowerCase()}`
        if (consolidated.has(key)) {
          const existing = consolidated.get(key)!
          existing.quantity += ing.quantity || 1
        } else {
          consolidated.set(key, {
            name: ing.name,
            quantity: ing.quantity || 1,
            unit: ing.unit,
            category: ing.category || 'other',
          })
        }
      }

      // Add items to shopping list
      const items = Array.from(consolidated.values()).map(ing => ({
        list_id: list.id,
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        checked: false,
        added_by: user.id,
      }))

      if (items.length > 0) {
        await supabase
          .from('shopping_list_items')
          .insert(items)
      }

      // Link recipes
      const recipeLinks = recipeIds.map(recipeId => ({
        list_id: list.id,
        recipe_id: recipeId,
      }))

      await supabase
        .from('shopping_list_recipes')
        .insert(recipeLinks)

      clearDraft()
      router.push(`/shopping-lists/${list.id}`)
    } catch (error) {
      console.error('Error creating list:', error)
      alert('Failed to create shopping list')
    } finally {
      setSavingList(false)
    }
  }

  return (
    <div className="bg-violet-900/20 border border-violet-500/30 rounded-2xl p-6 mb-8">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Draft Recipe List
          </h2>
          <p className="text-sm text-violet-300">
            {count} recipe{count !== 1 ? 's' : ''} ready to become a shopping list
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearDraft}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-300"
          >
            Clear
          </button>
          <button
            onClick={handleCreateList}
            disabled={savingList}
            className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {savingList ? 'Creating...' : 'Create Shopping List'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {draftRecipes.map(recipe => (
          <div
            key={recipe.id}
            className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2"
          >
            {recipe.image_url ? (
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-10 h-10 object-cover rounded"
              />
            ) : (
              <div className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center">
                🍽
              </div>
            )}
            <div className="min-w-0">
              <Link
                href={`/recipes/${recipe.id}`}
                className="text-sm text-white hover:text-violet-400 truncate block max-w-40"
              >
                {recipe.title}
              </Link>
            </div>
            <button
              onClick={() => removeRecipe(recipe.id)}
              className="text-zinc-400 hover:text-red-400 ml-1 flex-shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Add more recipes from the{' '}
        <Link href="/explore" className="text-violet-400 hover:text-violet-300">
          Explore page
        </Link>
      </p>
    </div>
  )
}

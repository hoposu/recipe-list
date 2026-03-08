'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Recipe {
  id: string
  title: string
  image_url: string | null
  ingredients: {
    id: string
    name: string
    quantity: number | null
    unit: string | null
    category: string
  }[]
}

export default function NewShoppingListPage() {
  const [name, setName] = useState('')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function fetchRecipes() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('recipes')
        .select(`
          id,
          title,
          image_url,
          ingredients (
            id,
            name,
            quantity,
            unit,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setRecipes(data || [])
      setLoading(false)
    }
    fetchRecipes()
  }, [supabase])

  const toggleRecipe = (id: string) => {
    setSelectedRecipes(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const handleCreate = async () => {
    if (!name.trim() || selectedRecipes.length === 0) return

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create the shopping list
      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .insert({ owner_id: user.id, name: name.trim() })
        .select()
        .single()

      if (listError) throw listError

      // Add owner as a member
      const { error: memberError } = await supabase
        .from('shopping_list_members')
        .insert({ list_id: list.id, user_id: user.id, role: 'owner' })

      if (memberError) throw memberError

      // Consolidate ingredients from selected recipes
      const selectedRecipeData = recipes.filter(r => selectedRecipes.includes(r.id))
      const consolidatedIngredients = consolidateIngredients(selectedRecipeData)

      // Add items to shopping list
      const items = consolidatedIngredients.map(ing => ({
        list_id: list.id,
        ingredient_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        checked: false,
        added_by: user.id,
      }))

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('shopping_list_items')
          .insert(items)

        if (itemsError) throw itemsError
      }

      // Link recipes to shopping list
      const recipeLinks = selectedRecipes.map(recipeId => ({
        list_id: list.id,
        recipe_id: recipeId,
      }))

      const { error: linkError } = await supabase
        .from('shopping_list_recipes')
        .insert(recipeLinks)

      if (linkError) throw linkError

      router.push(`/shopping-lists/${list.id}`)
    } catch (error: any) {
      console.error('Error creating list:', error)
      const message = error?.message || error?.toString() || 'Unknown error'
      alert(`Failed to create shopping list: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Aurora background */}
      <div className="aurora-bg" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b border-white/10 rounded-none">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/feed" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-lg">🦛</span>
              </div>
              <span className="text-xl font-semibold text-white">Recipe Pals</span>
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
        {/* Page Header */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="heading-serif text-4xl text-white mb-2">
            Create Shopping List
          </h1>
          <p className="text-white/50">
            Select recipes to add their ingredients to your list
          </p>
        </div>

        <div className="glass-card p-6 space-y-6">
          {/* List Name */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              List Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Groceries, Dinner Party"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
            />
          </div>

          {/* Recipe Selection */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-3">
              Select Recipes to Include
            </label>
            {loading ? (
              <div className="text-white/40 text-center py-8">Loading recipes...</div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8 glass-card bg-white/5">
                <div className="text-4xl mb-3">🍳</div>
                <p className="text-white/50 mb-4">No recipes yet</p>
                <Link
                  href="/recipes/new"
                  className="text-pink-400 hover:text-pink-300 font-medium"
                >
                  Add your first recipe
                </Link>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {recipes.map(recipe => {
                  const isSelected = selectedRecipes.includes(recipe.id)
                  return (
                    <label
                      key={recipe.id}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-pink-500/20 border-2 border-pink-500/50'
                          : 'bg-white/10 border-2 border-transparent hover:bg-white/15'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecipe(recipe.id)}
                        className="sr-only"
                      />

                      {/* Recipe Image */}
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                          <span className="text-2xl">🍽</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {recipe.title}
                        </p>
                        <p className="text-sm text-white/40">
                          {recipe.ingredients?.length || 0} ingredients
                        </p>
                      </div>

                      {/* Selection indicator */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-pink-500 to-purple-500 border-transparent text-white'
                          : 'border-white/30'
                      }`}>
                        {isSelected && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedRecipes.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
              <span className="text-pink-400">
                {selectedRecipes.length} recipe{selectedRecipes.length > 1 ? 's' : ''} selected
              </span>
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || selectedRecipes.length === 0}
            className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
          >
            {saving ? 'Creating...' : 'Create Shopping List'}
          </button>
        </div>
      </main>
    </div>
  )
}

// Consolidate ingredients from multiple recipes
function consolidateIngredients(recipes: Recipe[]) {
  const map = new Map<string, {
    name: string
    quantity: number
    unit: string | null
    category: string
  }>()

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients || []) {
      const key = `${ing.name.toLowerCase()}_${(ing.unit || '').toLowerCase()}`

      if (map.has(key)) {
        const existing = map.get(key)!
        existing.quantity += ing.quantity || 1
      } else {
        map.set(key, {
          name: ing.name,
          quantity: ing.quantity || 1,
          unit: ing.unit,
          category: ing.category || 'other',
        })
      }
    }
  }

  return Array.from(map.values())
}

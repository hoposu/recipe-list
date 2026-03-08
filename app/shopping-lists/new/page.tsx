'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'

interface Recipe {
  id: string
  title: string
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
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm text-violet-400 hover:text-violet-300">
              Explore
            </Link>
            <Link href="/profile" className="text-sm text-violet-400 hover:text-violet-300">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          Create Shopping List
        </h1>

        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 space-y-6">
          {/* List Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              List Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Groceries, Dinner Party"
              className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Recipe Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Select Recipes to Include
            </label>
            {loading ? (
              <p className="text-zinc-500">Loading recipes...</p>
            ) : recipes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-zinc-500 mb-3">No recipes yet.</p>
                <Link
                  href="/recipes/new"
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  Add your first recipe →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recipes.map(recipe => (
                  <label
                    key={recipe.id}
                    className={`flex items-center p-4 rounded-xl cursor-pointer transition-colors ${
                      selectedRecipes.includes(recipe.id)
                        ? 'bg-violet-900/30 border-2 border-violet-500'
                        : 'bg-zinc-700/50 border-2 border-transparent hover:bg-zinc-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipes.includes(recipe.id)}
                      onChange={() => toggleRecipe(recipe.id)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {recipe.title}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {recipe.ingredients?.length || 0} ingredients
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedRecipes.includes(recipe.id)
                        ? 'bg-violet-500 border-violet-500 text-white'
                        : 'border-zinc-600'
                    }`}>
                      {selectedRecipes.includes(recipe.id) && '✓'}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedRecipes.length > 0 && (
            <p className="text-sm text-violet-400">
              {selectedRecipes.length} recipe{selectedRecipes.length > 1 ? 's' : ''} selected
            </p>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || selectedRecipes.length === 0}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-semibold rounded-lg transition-colors"
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
      // Create a key based on name + unit (lowercase for comparison)
      const key = `${ing.name.toLowerCase()}_${(ing.unit || '').toLowerCase()}`

      if (map.has(key)) {
        // Add quantities
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

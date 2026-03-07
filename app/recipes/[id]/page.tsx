'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Ingredient {
  id: string
  name: string
  quantity: number | null
  unit: string | null
  category: string
}

interface Recipe {
  id: string
  title: string
  source_url: string | null
  source_type: string
  visibility: 'private' | 'friends' | 'public'
  created_at: string
  user_id: string
  profiles: {
    email: string
    display_name: string | null
  }
}

const categoryOrder = ['produce', 'dairy', 'meat', 'seafood', 'bakery', 'frozen', 'pantry', 'beverages', 'other']

export default function RecipeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const recipeId = params.id as string
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchRecipe() {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: recipeData } = await supabase
        .from('recipes')
        .select(`
          *,
          profiles:user_id (
            email,
            display_name
          )
        `)
        .eq('id', recipeId)
        .single()

      setRecipe(recipeData)
      setIsOwner(recipeData?.user_id === user?.id)

      const { data: ingredientsData } = await supabase
        .from('ingredients')
        .select('*')
        .eq('recipe_id', recipeId)

      setIngredients(ingredientsData || [])
      setLoading(false)
    }
    fetchRecipe()
  }, [recipeId, supabase])

  const updateVisibility = async (newVisibility: 'private' | 'friends' | 'public') => {
    if (!isOwner || !recipe) return
    setSaving(true)

    const { error } = await supabase
      .from('recipes')
      .update({ visibility: newVisibility })
      .eq('id', recipe.id)

    if (!error) {
      setRecipe({ ...recipe, visibility: newVisibility })
    }
    setSaving(false)
  }

  const deleteRecipe = async () => {
    if (!isOwner || !recipe) return
    setDeleting(true)

    // Delete ingredients first (cascade)
    await supabase
      .from('ingredients')
      .delete()
      .eq('recipe_id', recipe.id)

    // Delete recipe
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipe.id)

    if (!error) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setDeleting(false)
      alert('Failed to delete recipe')
    }
  }

  // Group ingredients by category
  const groupedIngredients = ingredients.reduce((acc, ing) => {
    const cat = ing.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(ing)
    return acc
  }, {} as Record<string, Ingredient[]>)

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">Recipe not found</p>
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
          <Link href="/dashboard" className="text-xl font-bold text-white">
            Recipe List
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Recipe Header */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {recipe.title}
              </h1>
              {!isOwner && (
                <p className="text-sm text-zinc-400">
                  by {recipe.profiles?.display_name || recipe.profiles?.email}
                </p>
              )}
            </div>
            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                View Original →
              </a>
            )}
          </div>

          {/* Visibility Toggle (Owner only) */}
          {isOwner && (
            <div className="border-t border-zinc-700 pt-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Who can see this recipe?
              </label>
              <div className="flex gap-2">
                {(['private', 'friends', 'public'] as const).map((vis) => (
                  <button
                    key={vis}
                    onClick={() => updateVisibility(vis)}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      recipe.visibility === vis
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    {vis === 'private' && 'Only me'}
                    {vis === 'friends' && 'Friends'}
                    {vis === 'public' && 'Everyone'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {recipe.visibility === 'private' && 'Only you can see this recipe'}
                {recipe.visibility === 'friends' && 'Other users can see this recipe'}
                {recipe.visibility === 'public' && 'Anyone can see this recipe'}
              </p>

              {/* Delete Button */}
              <div className="mt-4 pt-4 border-t border-zinc-700">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Delete this recipe
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">Are you sure?</span>
                    <button
                      onClick={deleteRecipe}
                      disabled={deleting}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm font-medium rounded-lg"
                    >
                      {deleting ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ingredients */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Ingredients ({ingredients.length})
          </h2>

          {ingredients.length === 0 ? (
            <p className="text-zinc-500 text-center py-4">No ingredients</p>
          ) : (
            <div className="space-y-4">
              {categoryOrder.map(category => {
                const items = groupedIngredients[category]
                if (!items || items.length === 0) return null

                return (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      {category}
                    </h3>
                    <ul className="space-y-1">
                      {items.map((ing) => (
                        <li
                          key={ing.id}
                          className="flex justify-between py-2 px-3 bg-zinc-700/50 rounded-lg"
                        >
                          <span className="text-zinc-200">
                            {ing.name}
                          </span>
                          <span className="text-sm text-zinc-400">
                            {ing.quantity && ing.unit
                              ? `${ing.quantity} ${ing.unit}`
                              : ing.quantity || ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

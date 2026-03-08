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

interface Interaction {
  id: string
  user_id: string
  type: 'rating' | 'comment' | 'adjustment' | 'cooked'
  rating: number | null
  content: string | null
  created_at: string
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
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Interaction form state
  const [interactionType, setInteractionType] = useState<'comment' | 'adjustment' | 'cooked'>('comment')
  const [interactionContent, setInteractionContent] = useState('')
  const [interactionRating, setInteractionRating] = useState(5)
  const [submittingInteraction, setSubmittingInteraction] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchRecipe() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

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

      // Check if saved
      if (user && recipeData) {
        const { data: savedData } = await supabase
          .from('saved_recipes')
          .select('id')
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId)
          .maybeSingle()

        setIsSaved(!!savedData)
      }

      const { data: ingredientsData } = await supabase
        .from('ingredients')
        .select('*')
        .eq('recipe_id', recipeId)

      setIngredients(ingredientsData || [])

      // Fetch interactions
      const { data: interactionsData } = await supabase
        .from('recipe_interactions')
        .select(`
          *,
          profiles:user_id (
            email,
            display_name
          )
        `)
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false })

      setInteractions(interactionsData as Interaction[] || [])
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

    await supabase.from('ingredients').delete().eq('recipe_id', recipe.id)
    await supabase.from('recipe_interactions').delete().eq('recipe_id', recipe.id)
    await supabase.from('saved_recipes').delete().eq('recipe_id', recipe.id)

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

  const toggleSave = async () => {
    if (!currentUserId || !recipe) return
    setSaving(true)

    if (isSaved) {
      await supabase
        .from('saved_recipes')
        .delete()
        .eq('user_id', currentUserId)
        .eq('recipe_id', recipe.id)
      setIsSaved(false)
    } else {
      await supabase
        .from('saved_recipes')
        .insert({ user_id: currentUserId, recipe_id: recipe.id })
      setIsSaved(true)
    }
    setSaving(false)
  }

  const submitInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || !recipe) return

    setSubmittingInteraction(true)

    const { data, error } = await supabase
      .from('recipe_interactions')
      .insert({
        user_id: currentUserId,
        recipe_id: recipe.id,
        type: interactionType,
        rating: interactionType === 'cooked' ? interactionRating : null,
        content: interactionContent || null,
      })
      .select(`
        *,
        profiles:user_id (
          email,
          display_name
        )
      `)
      .single()

    if (!error && data) {
      setInteractions(prev => [data as Interaction, ...prev])
      setInteractionContent('')
      setInteractionRating(5)

      // Log activity for "cooked" interactions
      if (interactionType === 'cooked') {
        await supabase
          .from('activities')
          .insert({
            user_id: currentUserId,
            type: 'cooked',
            recipe_id: recipe.id,
            interaction_id: data.id,
          })
      }
    }
    setSubmittingInteraction(false)
  }

  // Group ingredients by category
  const groupedIngredients = ingredients.reduce((acc, ing) => {
    const cat = ing.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(ing)
    return acc
  }, {} as Record<string, Ingredient[]>)

  // Calculate average rating
  const cookedInteractions = interactions.filter(i => i.type === 'cooked' && i.rating)
  const avgRating = cookedInteractions.length > 0
    ? (cookedInteractions.reduce((sum, i) => sum + (i.rating || 0), 0) / cookedInteractions.length).toFixed(1)
    : null

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Recipe Header */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {recipe.title}
              </h1>
              <p className="text-sm text-zinc-400">
                by {recipe.profiles?.display_name || recipe.profiles?.email}
              </p>
              {avgRating && (
                <p className="text-sm text-yellow-400 mt-1">
                  {'★'.repeat(Math.round(Number(avgRating)))} {avgRating} ({cookedInteractions.length} cook{cookedInteractions.length !== 1 ? 's' : ''})
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
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
              {/* Save Button (for non-owners) */}
              {!isOwner && (
                <button
                  onClick={toggleSave}
                  disabled={saving}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isSaved
                      ? 'bg-violet-600 text-white'
                      : 'border border-violet-500 text-violet-400 hover:bg-violet-600/20'
                  }`}
                >
                  {saving ? '...' : isSaved ? '✓ Saved' : '+ Save Recipe'}
                </button>
              )}
            </div>
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
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
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

        {/* Add Interaction */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Share Your Experience
          </h2>

          <form onSubmit={submitInteraction} className="space-y-4">
            {/* Type Selector */}
            <div className="flex gap-2">
              {[
                { value: 'cooked', label: 'I made this!' },
                { value: 'comment', label: 'Comment' },
                { value: 'adjustment', label: 'Adjustment' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setInteractionType(opt.value as typeof interactionType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    interactionType === opt.value
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Rating (only for "cooked") */}
            {interactionType === 'cooked' && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Your Rating
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setInteractionRating(star)}
                      className={`text-2xl transition-colors ${
                        star <= interactionRating ? 'text-yellow-400' : 'text-zinc-600'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {interactionType === 'cooked' && 'How did it turn out? (optional)'}
                {interactionType === 'comment' && 'Your comment'}
                {interactionType === 'adjustment' && 'What did you change?'}
              </label>
              <textarea
                value={interactionContent}
                onChange={(e) => setInteractionContent(e.target.value)}
                placeholder={
                  interactionType === 'cooked' ? 'Share your experience...' :
                  interactionType === 'comment' ? 'Add a comment...' :
                  'e.g., I used chicken instead of beef...'
                }
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingInteraction || (interactionType !== 'cooked' && !interactionContent.trim())}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-semibold rounded-lg transition-colors"
            >
              {submittingInteraction ? 'Posting...' : 'Post'}
            </button>
          </form>
        </div>

        {/* Interactions List */}
        {interactions.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Community ({interactions.length})
            </h2>

            <div className="space-y-4">
              {interactions.map((interaction) => (
                <div
                  key={interaction.id}
                  className="p-4 bg-zinc-700/50 rounded-xl"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-white">
                        {interaction.profiles?.display_name || interaction.profiles?.email}
                      </span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        interaction.type === 'cooked' ? 'bg-green-600/30 text-green-400' :
                        interaction.type === 'adjustment' ? 'bg-orange-600/30 text-orange-400' :
                        'bg-zinc-600 text-zinc-300'
                      }`}>
                        {interaction.type === 'cooked' && '🍳 Made this'}
                        {interaction.type === 'comment' && '💬 Comment'}
                        {interaction.type === 'adjustment' && '✏️ Adjustment'}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(interaction.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {interaction.type === 'cooked' && interaction.rating && (
                    <p className="text-yellow-400 text-sm mb-1">
                      {'★'.repeat(interaction.rating)}{'☆'.repeat(5 - interaction.rating)}
                    </p>
                  )}

                  {interaction.content && (
                    <p className="text-zinc-300 text-sm">
                      {interaction.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

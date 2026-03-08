'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'
import { useDraftList } from '@/hooks/useDraftList'

interface Recipe {
  id: string
  title: string
  image_url: string | null
  tags: string[]
  created_at: string
  user_id: string
  visibility: string
  creator: {
    email: string
    display_name: string | null
  }
  avgRating: number | null
  timesCookedTotal: number
  myRating: number | null
  iCooked: boolean
  wantToCook: boolean
}

const ALL_TAGS = ['Vegetarian', 'Soup', 'Chicken', 'Seafood', 'Beef', 'Pork', 'Breakfast', 'Sweet', 'Savory', 'Holiday'] as const

const tagColors: Record<string, string> = {
  Vegetarian: 'bg-green-600/30 text-green-400 border-green-600/50',
  Soup: 'bg-amber-600/30 text-amber-400 border-amber-600/50',
  Chicken: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50',
  Seafood: 'bg-cyan-600/30 text-cyan-400 border-cyan-600/50',
  Beef: 'bg-red-600/30 text-red-400 border-red-600/50',
  Pork: 'bg-pink-600/30 text-pink-400 border-pink-600/50',
  Breakfast: 'bg-orange-600/30 text-orange-400 border-orange-600/50',
  Sweet: 'bg-fuchsia-600/30 text-fuchsia-400 border-fuchsia-600/50',
  Savory: 'bg-indigo-600/30 text-indigo-400 border-indigo-600/50',
  Holiday: 'bg-rose-600/30 text-rose-400 border-rose-600/50',
}

type SortOption = 'recent' | 'rating' | 'times_cooked' | 'my_rating'
type FilterCooked = 'all' | 'cooked' | 'not_cooked'
type FilterWantToCook = 'all' | 'want' | 'not_want'

export default function ExplorePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [debugMsg, setDebugMsg] = useState<string>('')

  // Filters
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [filterCreator, setFilterCreator] = useState<string>('all')
  const [filterCooked, setFilterCooked] = useState<FilterCooked>('all')
  const [filterWantToCook, setFilterWantToCook] = useState<FilterWantToCook>('all')
  const [minRating, setMinRating] = useState<number>(0)
  const [filterTags, setFilterTags] = useState<string[]>([])

  // Draft recipe list
  const { draftRecipes, addRecipe, removeRecipe, clearDraft, isInDraft, count: draftCount } = useDraftList()
  const [showDraftPanel, setShowDraftPanel] = useState(false)
  const [savingList, setSavingList] = useState(false)

  // Unique creators for filter dropdown
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([])

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function fetchRecipes() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      // Fetch all recipes (RLS should handle visibility)
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('id, title, image_url, tags, created_at, user_id, visibility')
        .order('created_at', { ascending: false })

      console.log('Recipes fetched:', recipesData?.length, 'Error:', recipesError)

      if (recipesError) {
        console.error('Error fetching recipes:', recipesError)
        setDebugMsg(`Error: ${recipesError.message} (${recipesError.code})`)
        setLoading(false)
        return
      }

      if (!recipesData || recipesData.length === 0) {
        console.log('No recipes found')
        setDebugMsg('No recipes returned from query. Check RLS policies on recipes table.')
        setLoading(false)
        return
      }

      // Fetch profiles separately
      const userIds = [...new Set(recipesData.map(r => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds)

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      // Get all recipe IDs
      const recipeIds = recipesData.map(r => r.id)

      // Fetch all cooked interactions for these recipes
      const { data: interactions } = await supabase
        .from('recipe_interactions')
        .select('recipe_id, user_id, rating')
        .eq('type', 'cooked')
        .in('recipe_id', recipeIds.length > 0 ? recipeIds : ['none'])

      // Fetch want_to_cook entries for current user (handle if table doesn't exist)
      let wantToCookSet = new Set<string>()
      try {
        const { data: wantToCookData } = await supabase
          .from('want_to_cook')
          .select('recipe_id')
          .eq('user_id', user.id)
        wantToCookSet = new Set(wantToCookData?.map(w => w.recipe_id) || [])
      } catch (e) {
        console.log('want_to_cook table may not exist yet')
      }

      // Process recipes with aggregated data
      const processedRecipes: Recipe[] = recipesData.map(recipe => {
        const recipeInteractions = interactions?.filter(i => i.recipe_id === recipe.id) || []
        const ratingsWithValues = recipeInteractions.filter(i => i.rating !== null)
        const avgRating = ratingsWithValues.length > 0
          ? ratingsWithValues.reduce((sum, i) => sum + (i.rating || 0), 0) / ratingsWithValues.length
          : null
        const myInteraction = recipeInteractions.find(i => i.user_id === user.id)
        const profile = profileMap.get(recipe.user_id)

        return {
          id: recipe.id,
          title: recipe.title,
          image_url: recipe.image_url,
          tags: (recipe as any).tags || [],
          created_at: recipe.created_at,
          user_id: recipe.user_id,
          visibility: recipe.visibility,
          creator: {
            email: profile?.email || 'Unknown',
            display_name: profile?.display_name || null,
          },
          avgRating,
          timesCookedTotal: recipeInteractions.length,
          myRating: myInteraction?.rating || null,
          iCooked: !!myInteraction,
          wantToCook: wantToCookSet.has(recipe.id),
        }
      })

      setRecipes(processedRecipes)

      // Extract unique creators
      const uniqueCreators = new Map<string, string>()
      processedRecipes.forEach(r => {
        if (!uniqueCreators.has(r.user_id)) {
          uniqueCreators.set(r.user_id, r.creator.display_name || r.creator.email)
        }
      })
      setCreators(Array.from(uniqueCreators.entries()).map(([id, name]) => ({ id, name })))

      setLoading(false)
    }

    fetchRecipes()
  }, [supabase, router])

  const toggleWantToCook = async (recipeId: string, currentState: boolean) => {
    if (!currentUserId) return

    try {
      if (currentState) {
        // Remove from want to cook
        await supabase
          .from('want_to_cook')
          .delete()
          .eq('user_id', currentUserId)
          .eq('recipe_id', recipeId)
      } else {
        // Add to want to cook
        const { error } = await supabase
          .from('want_to_cook')
          .insert({ user_id: currentUserId, recipe_id: recipeId })

        if (error) {
          console.error('Error adding to want_to_cook:', error)
          alert('Could not save. Make sure the want_to_cook table exists.')
          return
        }
      }

      // Update local state
      setRecipes(prev => prev.map(r =>
        r.id === recipeId ? { ...r, wantToCook: !currentState } : r
      ))
    } catch (e) {
      console.error('Error toggling want to cook:', e)
    }
  }

  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    let result = [...recipes]

    // Filter by creator
    if (filterCreator !== 'all') {
      result = result.filter(r => r.user_id === filterCreator)
    }

    // Filter by cooked status
    if (filterCooked === 'cooked') {
      result = result.filter(r => r.iCooked)
    } else if (filterCooked === 'not_cooked') {
      result = result.filter(r => !r.iCooked)
    }

    // Filter by want to cook
    if (filterWantToCook === 'want') {
      result = result.filter(r => r.wantToCook)
    } else if (filterWantToCook === 'not_want') {
      result = result.filter(r => !r.wantToCook)
    }

    // Filter by minimum rating
    if (minRating > 0) {
      result = result.filter(r => r.avgRating !== null && r.avgRating >= minRating)
    }

    // Filter by tags (recipe must have ALL selected tags)
    if (filterTags.length > 0) {
      result = result.filter(r =>
        filterTags.every(tag => r.tags.includes(tag))
      )
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        break
      case 'times_cooked':
        result.sort((a, b) => b.timesCookedTotal - a.timesCookedTotal)
        break
      case 'my_rating':
        result.sort((a, b) => (b.myRating || 0) - (a.myRating || 0))
        break
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }

    return result
  }, [recipes, sortBy, filterCreator, filterCooked, filterWantToCook, minRating, filterTags])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <p className="text-zinc-500">Loading recipes...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <Logo />
            <div className="flex items-center gap-4">
              <span className="text-sm text-white font-medium">Explore</span>
              <Link
                href="/dashboard"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">
            Explore Recipes
          </h1>
          <Link
            href="/recipes/new"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Add Recipe
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Sort By */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value="recent">Most Recent</option>
                <option value="rating">Avg Rating</option>
                <option value="times_cooked">Times Cooked</option>
                <option value="my_rating">My Rating</option>
              </select>
            </div>

            {/* Min Rating */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Min Rating
              </label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value={0}>Any</option>
                <option value={1}>1+ stars</option>
                <option value={2}>2+ stars</option>
                <option value={3}>3+ stars</option>
                <option value={4}>4+ stars</option>
                <option value={5}>5 stars</option>
              </select>
            </div>

            {/* Creator */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Creator
              </label>
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Creators</option>
                {creators.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Cooked Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Cooked?
              </label>
              <select
                value={filterCooked}
                onChange={(e) => setFilterCooked(e.target.value as FilterCooked)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All</option>
                <option value="cooked">I've Cooked</option>
                <option value="not_cooked">Not Cooked Yet</option>
              </select>
            </div>

            {/* Want to Cook */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Want to Cook
              </label>
              <select
                value={filterWantToCook}
                onChange={(e) => setFilterWantToCook(e.target.value as FilterWantToCook)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All</option>
                <option value="want">Want to Cook</option>
                <option value="not_want">Not Marked</option>
              </select>
            </div>

            {/* Results count */}
            <div className="flex items-end">
              <p className="text-sm text-zinc-400 pb-2">
                {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Tag Filters */}
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Filter by Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map(tag => {
                const isSelected = filterTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      setFilterTags(prev =>
                        isSelected
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      )
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      isSelected
                        ? tagColors[tag]
                        : 'bg-zinc-700/50 text-zinc-400 border-zinc-600 hover:bg-zinc-700'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
              {filterTags.length > 0 && (
                <button
                  onClick={() => setFilterTags([])}
                  className="text-xs px-3 py-1.5 text-zinc-500 hover:text-zinc-300"
                >
                  Clear tags
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recipe Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden hover:border-zinc-600 transition-colors"
              >
                {/* Image */}
                <Link href={`/recipes/${recipe.id}`}>
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-zinc-700 flex items-center justify-center">
                      <span className="text-4xl">🍽</span>
                    </div>
                  )}
                </Link>

                <div className="p-4">
                  {/* Title and Creator */}
                  <Link href={`/recipes/${recipe.id}`}>
                    <h3 className="font-semibold text-white hover:text-violet-400 transition-colors truncate">
                      {recipe.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-zinc-400 truncate">
                    by {recipe.creator.display_name || recipe.creator.email}
                  </p>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className={`text-xs px-1.5 py-0.5 rounded ${tagColors[tag]?.replace(' border-', ' ').split(' ').slice(0, 2).join(' ') || 'bg-zinc-600/30 text-zinc-400'}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {recipe.tags.length > 3 && (
                        <span className="text-xs text-zinc-500">
                          +{recipe.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    {recipe.avgRating !== null && (
                      <span className="text-yellow-400">
                        {'★'.repeat(Math.round(recipe.avgRating))} {recipe.avgRating.toFixed(1)}
                      </span>
                    )}
                    {recipe.timesCookedTotal > 0 && (
                      <span className="text-zinc-400">
                        {recipe.timesCookedTotal} cook{recipe.timesCookedTotal !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* User status badges */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {recipe.iCooked && (
                      <span className="text-xs px-2 py-1 bg-green-600/30 text-green-400 rounded">
                        Cooked {recipe.myRating && `(${recipe.myRating}★)`}
                      </span>
                    )}
                    {recipe.user_id === currentUserId && (
                      <span className="text-xs px-2 py-1 bg-violet-600/30 text-violet-400 rounded">
                        My Recipe
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => toggleWantToCook(recipe.id, recipe.wantToCook)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                        recipe.wantToCook
                          ? 'bg-orange-600/30 text-orange-400 border border-orange-600/50'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {recipe.wantToCook ? '♥ Saved' : '+ Save'}
                    </button>
                    <button
                      onClick={() => {
                        if (isInDraft(recipe.id)) {
                          removeRecipe(recipe.id)
                        } else {
                          addRecipe({
                            id: recipe.id,
                            title: recipe.title,
                            image_url: recipe.image_url,
                          })
                        }
                      }}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isInDraft(recipe.id)
                          ? 'bg-violet-600/30 text-violet-400 border border-violet-600/50'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {isInDraft(recipe.id) ? '✓ In List' : '+ Add to List'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <p className="text-zinc-400 mb-2">
              {recipes.length === 0 ? 'No recipes found.' : 'No recipes match your filters.'}
            </p>
            {debugMsg && (
              <p className="text-xs text-red-400 mb-4 font-mono bg-zinc-900 p-2 rounded">
                {debugMsg}
              </p>
            )}
            {recipes.length > 0 && (
              <button
                onClick={() => {
                  setSortBy('recent')
                  setFilterCreator('all')
                  setFilterCooked('all')
                  setFilterWantToCook('all')
                  setMinRating(0)
                  setFilterTags([])
                }}
                className="text-violet-400 hover:text-violet-300 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Floating Draft List Panel */}
      {draftCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-800 border-t border-zinc-700 shadow-lg z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowDraftPanel(!showDraftPanel)}
                className="flex items-center gap-3 text-white"
              >
                <span className="bg-violet-600 text-white text-sm font-bold px-2.5 py-1 rounded-full">
                  {draftCount}
                </span>
                <span className="font-medium">
                  Recipe{draftCount !== 1 ? 's' : ''} in draft list
                </span>
                <span className="text-zinc-400 text-sm">
                  {showDraftPanel ? '▼' : '▲'}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearDraft}
                  className="text-sm text-zinc-400 hover:text-zinc-300"
                >
                  Clear
                </button>
                <button
                  onClick={async () => {
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
                  }}
                  disabled={savingList}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {savingList ? 'Creating...' : 'Create Shopping List'}
                </button>
              </div>
            </div>

            {/* Expanded panel */}
            {showDraftPanel && (
              <div className="mt-3 pt-3 border-t border-zinc-700">
                <div className="flex flex-wrap gap-2">
                  {draftRecipes.map(recipe => (
                    <div
                      key={recipe.id}
                      className="flex items-center gap-2 bg-zinc-700/50 rounded-lg px-3 py-2"
                    >
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-8 h-8 object-cover rounded"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-zinc-600 rounded flex items-center justify-center text-sm">
                          🍽
                        </div>
                      )}
                      <span className="text-sm text-white truncate max-w-32">
                        {recipe.title}
                      </span>
                      <button
                        onClick={() => removeRecipe(recipe.id)}
                        className="text-zinc-400 hover:text-red-400 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

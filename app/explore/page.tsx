'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
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

interface Tag {
  id: string
  name: string
  color_class: string
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

  // Available tags from database
  const [availableTags, setAvailableTags] = useState<Tag[]>([])

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

      // Fetch available tags from database
      const { data: tagsData } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      setAvailableTags(tagsData || [])

      // Fetch all recipes (RLS should handle visibility)
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('id, title, image_url, tags, created_at, user_id, visibility')
        .order('created_at', { ascending: false })

      if (recipesError) {
        console.error('Error fetching recipes:', recipesError)
        setDebugMsg(`Error: ${recipesError.message} (${recipesError.code})`)
        setLoading(false)
        return
      }

      if (!recipesData || recipesData.length === 0) {
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

      // Fetch want_to_cook entries for current user
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
        await supabase
          .from('want_to_cook')
          .delete()
          .eq('user_id', currentUserId)
          .eq('recipe_id', recipeId)
      } else {
        const { error } = await supabase
          .from('want_to_cook')
          .insert({ user_id: currentUserId, recipe_id: recipeId })

        if (error) {
          console.error('Error adding to want_to_cook:', error)
          alert('Could not save. Make sure the want_to_cook table exists.')
          return
        }
      }

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

    if (filterCreator !== 'all') {
      result = result.filter(r => r.user_id === filterCreator)
    }

    if (filterCooked === 'cooked') {
      result = result.filter(r => r.iCooked)
    } else if (filterCooked === 'not_cooked') {
      result = result.filter(r => !r.iCooked)
    }

    if (filterWantToCook === 'want') {
      result = result.filter(r => r.wantToCook)
    } else if (filterWantToCook === 'not_want') {
      result = result.filter(r => !r.wantToCook)
    }

    if (minRating > 0) {
      result = result.filter(r => r.avgRating !== null && r.avgRating >= minRating)
    }

    if (filterTags.length > 0) {
      result = result.filter(r =>
        filterTags.every(tag => r.tags.includes(tag))
      )
    }

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

  const createShoppingList = async () => {
    if (draftRecipes.length === 0) return
    setSavingList(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const recipeIds = draftRecipes.map(r => r.id)
      const { data: ingredients } = await supabase
        .from('ingredients')
        .select('recipe_id, name, quantity, unit, category')
        .in('recipe_id', recipeIds)

      const { data: list, error: listError } = await supabase
        .from('shopping_lists')
        .insert({
          owner_id: user.id,
          name: `Shopping List - ${new Date().toLocaleDateString()}`,
        })
        .select()
        .single()

      if (listError) throw listError

      await supabase
        .from('shopping_list_members')
        .insert({ list_id: list.id, user_id: user.id, role: 'owner' })

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

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="aurora-bg" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="glass-card px-8 py-6">
            <p className="text-white/60">Loading recipes...</p>
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
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/feed" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-lg">🦛</span>
              </div>
              <span className="text-xl font-semibold text-white">Recipe Pals</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/profile" className="glass-button text-sm text-white/90 hover:text-white">
                Profile
              </Link>
              <Link href="/settings" className="glass-button text-sm text-white/90 hover:text-white">
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 pb-32">
        {/* Header Section */}
        <div className="mb-10 animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="heading-serif text-5xl md:text-6xl text-white mb-3">
                Explore
              </h1>
              <p className="text-white/60 text-lg">
                Discover recipes from the community
              </p>
            </div>
            <Link
              href="/recipes/new"
              className="glass-button glass-button-active text-sm flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Recipe</span>
            </Link>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="glass-card p-6 mb-8">
          {/* Sort & Filter Row */}
          <div className="flex flex-wrap gap-3 mb-6">
            {/* Sort Pills */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">Sort:</span>
              {[
                { value: 'recent', label: 'Recent' },
                { value: 'rating', label: 'Top Rated' },
                { value: 'times_cooked', label: 'Most Cooked' },
                { value: 'my_rating', label: 'My Favorites' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value as SortOption)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    sortBy === option.value
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Min Rating */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">
                Min Rating
              </label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
              >
                <option value={0} className="bg-zinc-900">Any</option>
                <option value={1} className="bg-zinc-900">1+ stars</option>
                <option value={2} className="bg-zinc-900">2+ stars</option>
                <option value={3} className="bg-zinc-900">3+ stars</option>
                <option value={4} className="bg-zinc-900">4+ stars</option>
                <option value={5} className="bg-zinc-900">5 stars</option>
              </select>
            </div>

            {/* Creator */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">
                Creator
              </label>
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
              >
                <option value="all" className="bg-zinc-900">All Creators</option>
                {creators.map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                ))}
              </select>
            </div>

            {/* Cooked Status */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">
                Cooked?
              </label>
              <select
                value={filterCooked}
                onChange={(e) => setFilterCooked(e.target.value as FilterCooked)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
              >
                <option value="all" className="bg-zinc-900">All</option>
                <option value="cooked" className="bg-zinc-900">I've Cooked</option>
                <option value="not_cooked" className="bg-zinc-900">Not Cooked Yet</option>
              </select>
            </div>

            {/* Want to Cook */}
            <div>
              <label className="block text-xs font-medium text-white/40 mb-2">
                Saved
              </label>
              <select
                value={filterWantToCook}
                onChange={(e) => setFilterWantToCook(e.target.value as FilterWantToCook)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent"
              >
                <option value="all" className="bg-zinc-900">All</option>
                <option value="want" className="bg-zinc-900">Saved Recipes</option>
                <option value="not_want" className="bg-zinc-900">Not Saved</option>
              </select>
            </div>
          </div>

          {/* Tag Filters */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-white/40">
                Filter by Tags
              </label>
              <span className="text-sm text-white/40">
                {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => {
                const isSelected = filterTags.includes(tag.name)
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setFilterTags(prev =>
                        isSelected
                          ? prev.filter(t => t !== tag.name)
                          : [...prev, tag.name]
                      )
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {filterTags.length > 0 && (
                <button
                  onClick={() => setFilterTags([])}
                  className="px-4 py-2 text-sm text-white/40 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recipe Grid */}
        {filteredRecipes.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {filteredRecipes.map((recipe) => (
              <article
                key={recipe.id}
                className="glass-card glass-card-hover overflow-hidden group"
              >
                {/* Image */}
                <Link href={`/recipes/${recipe.id}`} className="block relative">
                  {recipe.image_url ? (
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover image-hover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <span className="text-5xl">🍽</span>
                    </div>
                  )}

                  {/* Overlay badges */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    {recipe.iCooked && (
                      <span className="px-2.5 py-1 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                        Cooked
                      </span>
                    )}
                    {recipe.user_id === currentUserId && (
                      <span className="px-2.5 py-1 bg-purple-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                        Yours
                      </span>
                    )}
                  </div>

                  {/* Rating badge */}
                  {recipe.avgRating !== null && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                      <span className="text-yellow-400 text-sm">★</span>
                      <span className="text-white text-sm font-medium">{recipe.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </Link>

                <div className="p-5">
                  {/* Title and Creator */}
                  <Link href={`/recipes/${recipe.id}`}>
                    <h3 className="text-lg font-semibold text-white group-hover:text-pink-400 transition-colors line-clamp-1">
                      {recipe.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-white/50 mt-1">
                    by <Link href={`/profile/${recipe.user_id}`} className="hover:text-pink-400 transition-colors">{recipe.creator.display_name || recipe.creator.email}</Link>
                  </p>

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {recipe.tags.slice(0, 3).map(tagName => (
                        <span key={tagName} className="tag-pill">
                          {tagName}
                        </span>
                      ))}
                      {recipe.tags.length > 3 && (
                        <span className="text-xs text-white/40">
                          +{recipe.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  {recipe.timesCookedTotal > 0 && (
                    <p className="text-sm text-white/40 mt-3">
                      {recipe.timesCookedTotal} cook{recipe.timesCookedTotal !== 1 ? 's' : ''}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => toggleWantToCook(recipe.id, recipe.wantToCook)}
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        recipe.wantToCook
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border border-white/10'
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
                      className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        isInDraft(recipe.id)
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white border border-white/10'
                      }`}
                    >
                      {isInDraft(recipe.id) ? '✓ In List' : '+ List'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-white/80 text-lg mb-2">
              {recipes.length === 0 ? 'No recipes found.' : 'No recipes match your filters.'}
            </p>
            {debugMsg && (
              <p className="text-xs text-red-400 mb-4 font-mono bg-red-500/10 p-3 rounded-xl">
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
                className="text-pink-400 hover:text-pink-300 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Floating Draft List Panel */}
      {draftCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 glass-card border-0 border-t border-white/10 rounded-none z-50">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowDraftPanel(!showDraftPanel)}
                className="flex items-center gap-3 text-white"
              >
                <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-bold px-3 py-1.5 rounded-full">
                  {draftCount}
                </span>
                <span className="font-medium">
                  Recipe{draftCount !== 1 ? 's' : ''} in draft list
                </span>
                <span className="text-white/40 text-sm">
                  {showDraftPanel ? '▼' : '▲'}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={clearDraft}
                  className="text-sm text-white/40 hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={createShoppingList}
                  disabled={savingList}
                  className="glass-button glass-button-active text-sm"
                >
                  {savingList ? 'Creating...' : 'Create Shopping List'}
                </button>
              </div>
            </div>

            {/* Expanded panel */}
            {showDraftPanel && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-3">
                  {draftRecipes.map(recipe => (
                    <div
                      key={recipe.id}
                      className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2"
                    >
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          className="w-10 h-10 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-lg">
                          🍽
                        </div>
                      )}
                      <span className="text-sm text-white truncate max-w-40">
                        {recipe.title}
                      </span>
                      <button
                        onClick={() => removeRecipe(recipe.id)}
                        className="text-white/40 hover:text-red-400 ml-1"
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

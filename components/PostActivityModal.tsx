'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface Recipe {
  id: string
  title: string
  image_url: string | null
}

interface PostActivityModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function PostActivityModal({ isOpen, onClose, onSuccess }: PostActivityModalProps) {
  const [step, setStep] = useState<'select' | 'details'>('select')
  const [recentListRecipes, setRecentListRecipes] = useState<Recipe[]>([])
  const [searchResults, setSearchResults] = useState<Recipe[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [rating, setRating] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [adjustments, setAdjustments] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  // Fetch recipes from most recent shopping list
  useEffect(() => {
    if (!isOpen) return

    async function fetchRecentListRecipes() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get most recent shopping list
        const { data: lists } = await supabase
          .from('shopping_lists')
          .select('id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (lists && lists.length > 0) {
          // Get recipes linked to this list
          const { data: linkedRecipes } = await supabase
            .from('shopping_list_recipes')
            .select('recipe_id')
            .eq('list_id', lists[0].id)

          if (linkedRecipes && linkedRecipes.length > 0) {
            const recipeIds = linkedRecipes.map(lr => lr.recipe_id)
            const { data: recipes } = await supabase
              .from('recipes')
              .select('id, title, image_url')
              .in('id', recipeIds)

            setRecentListRecipes(recipes || [])
          }
        }

        // If no recent list recipes, fetch user's own recipes
        if (recentListRecipes.length === 0) {
          const { data: userRecipes } = await supabase
            .from('recipes')
            .select('id, title, image_url')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6)

          setRecentListRecipes(userRecipes || [])
        }
      } catch (error) {
        console.error('Error fetching recipes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentListRecipes()
  }, [isOpen, supabase])

  // Search recipes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await supabase
          .from('recipes')
          .select('id, title, image_url')
          .ilike('title', `%${searchQuery}%`)
          .limit(10)

        setSearchResults(data || [])
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, supabase])

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Submit the activity
  const handleSubmit = async () => {
    if (!selectedRecipe || rating === 0) return

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let uploadedImageUrl: string | null = null

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('interaction-images')
          .upload(fileName, imageFile)

        if (uploadError) {
          console.error('Upload error:', uploadError)
        } else {
          const { data: urlData } = supabase.storage
            .from('interaction-images')
            .getPublicUrl(fileName)
          uploadedImageUrl = urlData.publicUrl
        }
      }

      // Build content string
      let content = ''
      if (comment.trim()) {
        content = comment.trim()
      }
      if (adjustments.trim()) {
        content += (content ? '\n\n' : '') + `[Adjustments] ${adjustments.trim()}`
      }

      // Create interaction
      const { data: interaction, error: interactionError } = await supabase
        .from('recipe_interactions')
        .insert({
          recipe_id: selectedRecipe.id,
          user_id: user.id,
          type: 'cooked',
          rating,
          content: content || null,
          image_url: uploadedImageUrl,
        })
        .select()
        .single()

      if (interactionError) throw interactionError

      // Create activity
      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          type: 'cooked',
          recipe_id: selectedRecipe.id,
          interaction_id: interaction.id,
        })

      if (activityError) throw activityError

      // Remove from want_to_cook if it was there
      await supabase
        .from('want_to_cook')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', selectedRecipe.id)

      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error posting activity:', error)
      alert('Failed to post activity. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep('select')
    setSelectedRecipe(null)
    setSearchQuery('')
    setSearchResults([])
    setRating(0)
    setComment('')
    setAdjustments('')
    setImageFile(null)
    setImagePreview(null)
    onClose()
  }

  const selectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe)
    setStep('details')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-800 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">
            {step === 'select' ? 'What did you cook?' : 'Share your experience'}
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'select' ? (
            <>
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipes..."
                  className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Search Results */}
              {searchQuery && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    Search Results
                  </h3>
                  {searching ? (
                    <p className="text-zinc-500 text-sm">Searching...</p>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map(recipe => (
                        <button
                          key={recipe.id}
                          onClick={() => selectRecipe(recipe)}
                          className="w-full flex items-center gap-3 p-3 bg-zinc-700/50 hover:bg-zinc-700 rounded-xl transition-colors text-left"
                        >
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.title}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-zinc-600 rounded-lg flex items-center justify-center">
                              🍽
                            </div>
                          )}
                          <span className="text-white font-medium truncate">
                            {recipe.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No recipes found</p>
                  )}
                </div>
              )}

              {/* Recent List Recipes */}
              {!searchQuery && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2">
                    {recentListRecipes.length > 0 ? 'From your recent list' : 'Your recipes'}
                  </h3>
                  {loading ? (
                    <p className="text-zinc-500 text-sm">Loading...</p>
                  ) : recentListRecipes.length > 0 ? (
                    <div className="space-y-2">
                      {recentListRecipes.map(recipe => (
                        <button
                          key={recipe.id}
                          onClick={() => selectRecipe(recipe)}
                          className="w-full flex items-center gap-3 p-3 bg-zinc-700/50 hover:bg-zinc-700 rounded-xl transition-colors text-left"
                        >
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.title}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-zinc-600 rounded-lg flex items-center justify-center">
                              🍽
                            </div>
                          )}
                          <span className="text-white font-medium truncate">
                            {recipe.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">
                      No recipes found. Search above to find a recipe.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Selected Recipe */}
              <div className="flex items-center gap-3 p-3 bg-zinc-700/50 rounded-xl mb-4">
                {selectedRecipe?.image_url ? (
                  <img
                    src={selectedRecipe.image_url}
                    alt={selectedRecipe.title}
                    className="w-14 h-14 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-14 h-14 bg-zinc-600 rounded-lg flex items-center justify-center">
                    🍽
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {selectedRecipe?.title}
                  </p>
                  <button
                    onClick={() => setStep('select')}
                    className="text-sm text-violet-400 hover:text-violet-300"
                  >
                    Change recipe
                  </button>
                </div>
              </div>

              {/* Rating */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Rating *
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-3xl transition-colors ${
                        star <= rating ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-500'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Comment
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was it? Any thoughts to share?"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              {/* Adjustments */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Adjustments Made
                </label>
                <textarea
                  value={adjustments}
                  onChange={(e) => setAdjustments(e.target.value)}
                  placeholder="Did you modify the recipe? Add more garlic, less salt..."
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              {/* Photo Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Photo
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                      }}
                      className="absolute top-2 right-2 bg-black/50 text-white w-8 h-8 rounded-full hover:bg-black/70"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-600 rounded-xl cursor-pointer hover:border-zinc-500 transition-colors">
                    <span className="text-zinc-400 text-sm">
                      Click to upload a photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="p-4 border-t border-zinc-700">
            <button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-colors"
            >
              {submitting ? 'Posting...' : 'Post to Activity Feed'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

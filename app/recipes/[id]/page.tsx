'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'
import ReactionBar from '@/components/ReactionBar'

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
  image_url: string | null
  source_url: string | null
  source_type: string
  visibility: 'private' | 'friends' | 'public'
  created_at: string
  user_id: string
  instructions: string[] | null
  total_time_minutes: number | null
  servings: number | null
  tags: string[]
  profiles: {
    email: string
    display_name: string | null
  }
}

interface Tag {
  id: string
  name: string
  color_class: string
}

interface Interaction {
  id: string
  user_id: string
  type: 'rating' | 'comment' | 'adjustment' | 'cooked'
  rating: number | null
  content: string | null
  image_url: string | null
  created_at: string
  profiles: {
    email: string
    display_name: string | null
    avatar_url: string | null
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [wantToCook, setWantToCook] = useState(false)
  const [hasCooked, setHasCooked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Interaction form state
  const [madeThis, setMadeThis] = useState(false)
  const [interactionContent, setInteractionContent] = useState('')
  const [adjustmentContent, setAdjustmentContent] = useState('')
  const [interactionRating, setInteractionRating] = useState(5)
  const [interactionImage, setInteractionImage] = useState<File | null>(null)
  const [interactionImagePreview, setInteractionImagePreview] = useState<string | null>(null)
  const [submittingInteraction, setSubmittingInteraction] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>('')

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editIngredients, setEditIngredients] = useState<Ingredient[]>([])
  const [savingEdits, setSavingEdits] = useState(false)
  const [newIngredient, setNewIngredient] = useState({ name: '', quantity: '', unit: '', category: 'other' })

  // Tag editing state
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [editTags, setEditTags] = useState<string[]>([])
  const [savingTags, setSavingTags] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchRecipe() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      // Check if user is admin
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        setIsAdmin(profile?.is_admin === true)
      }

      // Fetch available tags
      const { data: tagsData } = await supabase
        .from('tags')
        .select('*')
        .order('name')

      setAvailableTags(tagsData || [])

      // First try with profiles join
      let { data: recipeData, error: recipeError } = await supabase
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

      // If that fails, try without the profiles join
      if (recipeError || !recipeData) {
        console.log('First query failed, trying without profiles join')
        const { data: simpleRecipeData, error: simpleError } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', recipeId)
          .single()

        if (simpleRecipeData) {
          // Recipe exists but profiles join failed
          recipeData = { ...simpleRecipeData, profiles: { email: 'Unknown', display_name: null } }
          recipeError = null
          setDebugInfo(`Loaded recipe without profile data (profiles join failed)`)
        } else {
          recipeError = simpleError
        }
      }

      if (recipeError) {
        console.error('Recipe fetch error:', recipeError)
        console.log('User ID:', user?.id)
        console.log('Recipe ID:', recipeId)
        setDebugInfo(`Error: ${recipeError.message} | Code: ${recipeError.code} | User: ${user?.id || 'not logged in'} | Recipe: ${recipeId}`)
      } else if (!recipeData) {
        setDebugInfo(`No recipe data returned. User: ${user?.id || 'not logged in'} | Recipe: ${recipeId}`)
      }

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

        // Check if want to cook
        const { data: wantToCookData } = await supabase
          .from('want_to_cook')
          .select('id')
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId)
          .maybeSingle()

        setWantToCook(!!wantToCookData)

        // Check if user has cooked this recipe
        const { data: cookedData } = await supabase
          .from('recipe_interactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId)
          .eq('type', 'cooked')
          .maybeSingle()

        setHasCooked(!!cookedData)
      }

      const { data: ingredientsData } = await supabase
        .from('ingredients')
        .select('*')
        .eq('recipe_id', recipeId)

      setIngredients(ingredientsData || [])

      // Fetch interactions
      let { data: interactionsData, error: interactionsError } = await supabase
        .from('recipe_interactions')
        .select(`
          *,
          profiles:user_id (
            email,
            display_name,
            avatar_url
          )
        `)
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false })

      // Fallback: fetch without profiles join if it fails
      if (interactionsError || !interactionsData) {
        console.log('Interactions fetch failed, trying without profiles join:', interactionsError)
        const { data: simpleInteractions } = await supabase
          .from('recipe_interactions')
          .select('*')
          .eq('recipe_id', recipeId)
          .order('created_at', { ascending: false })

        interactionsData = simpleInteractions?.map(i => ({
          ...i,
          profiles: { email: 'Unknown', display_name: null, avatar_url: null }
        })) || []
      }

      console.log('Fetched interactions:', interactionsData?.length || 0)
      setInteractions(interactionsData as Interaction[] || [])
      setLoading(false)
    }
    fetchRecipe()
  }, [recipeId, supabase])

  // Helper: can edit means owner OR admin
  const canEdit = isOwner || isAdmin

  const updateVisibility = async (newVisibility: 'private' | 'friends' | 'public') => {
    if (!canEdit || !recipe) return
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
    if (!canEdit || !recipe) return
    setDeleting(true)

    await supabase.from('ingredients').delete().eq('recipe_id', recipe.id)
    await supabase.from('recipe_interactions').delete().eq('recipe_id', recipe.id)
    await supabase.from('saved_recipes').delete().eq('recipe_id', recipe.id)

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipe.id)

    if (!error) {
      router.push('/profile')
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

  const toggleWantToCook = async () => {
    if (!currentUserId || !recipe) return
    setSaving(true)

    if (wantToCook) {
      await supabase
        .from('want_to_cook')
        .delete()
        .eq('user_id', currentUserId)
        .eq('recipe_id', recipe.id)
      setWantToCook(false)
    } else {
      const { error } = await supabase
        .from('want_to_cook')
        .insert({ user_id: currentUserId, recipe_id: recipe.id })
      if (!error) {
        setWantToCook(true)
      }
    }
    setSaving(false)
  }

  // Enter edit mode
  const startEditing = () => {
    if (!recipe) return
    setEditTitle(recipe.title)
    setEditIngredients([...ingredients])
    setEditTags([...(recipe.tags || [])])
    setIsEditing(true)
  }

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditIngredients([])
    setEditTags([])
    setNewIngredient({ name: '', quantity: '', unit: '', category: 'other' })
  }

  // Toggle a tag in edit mode
  const toggleEditTag = (tagName: string) => {
    setEditTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    )
  }

  // Update ingredient in edit state
  const updateEditIngredient = (id: string, field: keyof Ingredient, value: string | number | null) => {
    setEditIngredients(prev => prev.map(ing =>
      ing.id === id ? { ...ing, [field]: value } : ing
    ))
  }

  // Remove ingredient from edit state
  const removeEditIngredient = (id: string) => {
    setEditIngredients(prev => prev.filter(ing => ing.id !== id))
  }

  // Add new ingredient
  const addNewIngredient = () => {
    if (!newIngredient.name.trim()) return
    const tempId = `new-${Date.now()}`
    setEditIngredients(prev => [...prev, {
      id: tempId,
      name: newIngredient.name.trim(),
      quantity: newIngredient.quantity ? parseFloat(newIngredient.quantity) : null,
      unit: newIngredient.unit || null,
      category: newIngredient.category,
    }])
    setNewIngredient({ name: '', quantity: '', unit: '', category: 'other' })
  }

  // Save all edits
  const saveEdits = async () => {
    if (!recipe || !canEdit) return
    setSavingEdits(true)

    try {
      // Check if title or tags changed
      const titleChanged = editTitle !== recipe.title
      const tagsChanged = JSON.stringify(editTags.sort()) !== JSON.stringify((recipe.tags || []).sort())

      // Update recipe title and/or tags
      if (titleChanged || tagsChanged) {
        const updates: { title?: string; tags?: string[] } = {}
        if (titleChanged) updates.title = editTitle
        if (tagsChanged) updates.tags = editTags

        const { error: updateError } = await supabase
          .from('recipes')
          .update(updates)
          .eq('id', recipe.id)

        if (updateError) throw updateError
        setRecipe({ ...recipe, ...(titleChanged ? { title: editTitle } : {}), ...(tagsChanged ? { tags: editTags } : {}) })
      }

      // Get current ingredient IDs
      const currentIds = ingredients.map(i => i.id)
      const editIds = editIngredients.map(i => i.id)

      // Delete removed ingredients
      const deletedIds = currentIds.filter(id => !editIds.includes(id))
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('ingredients')
          .delete()
          .in('id', deletedIds)
        if (deleteError) throw deleteError
      }

      // Update existing and add new ingredients
      for (const ing of editIngredients) {
        if (ing.id.startsWith('new-')) {
          // New ingredient
          const { error: insertError } = await supabase
            .from('ingredients')
            .insert({
              recipe_id: recipe.id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              category: ing.category,
            })
          if (insertError) throw insertError
        } else {
          // Existing ingredient - update
          const original = ingredients.find(i => i.id === ing.id)
          if (original && (
            original.name !== ing.name ||
            original.quantity !== ing.quantity ||
            original.unit !== ing.unit ||
            original.category !== ing.category
          )) {
            const { error: updateError } = await supabase
              .from('ingredients')
              .update({
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                category: ing.category,
              })
              .eq('id', ing.id)
            if (updateError) throw updateError
          }
        }
      }

      // Refresh ingredients from database
      const { data: refreshedIngredients } = await supabase
        .from('ingredients')
        .select('*')
        .eq('recipe_id', recipe.id)

      setIngredients(refreshedIngredients || [])
      setIsEditing(false)
      setEditTitle('')
      setEditIngredients([])
      setEditTags([])
    } catch (error) {
      console.error('Error saving edits:', error)
      alert('Failed to save changes')
    } finally {
      setSavingEdits(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setInteractionImage(file)
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setInteractionImagePreview(previewUrl)
    }
  }

  const removeImage = () => {
    setInteractionImage(null)
    if (interactionImagePreview) {
      URL.revokeObjectURL(interactionImagePreview)
      setInteractionImagePreview(null)
    }
  }

  const submitInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || !recipe) return

    // Must have "made this" checked OR have content OR have an image
    if (!madeThis && !interactionContent.trim() && !interactionImage) return

    setSubmittingInteraction(true)

    // Upload image if selected
    let uploadedImageUrl: string | null = null
    if (interactionImage) {
      const fileExt = interactionImage.name.split('.').pop()
      const fileName = `${currentUserId}/${recipe.id}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('interaction-images')
        .upload(fileName, interactionImage)

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        alert(`Failed to upload image: ${uploadError.message}`)
        setSubmittingInteraction(false)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('interaction-images')
        .getPublicUrl(fileName)

      uploadedImageUrl = urlData.publicUrl
    }

    // If "I made this" is checked, create a single cooked interaction with all info
    if (madeThis) {
      // Combine comment and adjustments into structured content
      const contentParts: string[] = []
      if (interactionContent.trim()) {
        contentParts.push(interactionContent.trim())
      }
      if (adjustmentContent.trim()) {
        contentParts.push(`[Adjustments] ${adjustmentContent.trim()}`)
      }

      const { data, error } = await supabase
        .from('recipe_interactions')
        .insert({
          user_id: currentUserId,
          recipe_id: recipe.id,
          type: 'cooked',
          rating: interactionRating,
          content: contentParts.length > 0 ? contentParts.join('\n\n') : null,
          image_url: uploadedImageUrl,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Error saving interaction:', error)
        alert(`Failed to save: ${error.message}`)
        setSubmittingInteraction(false)
        return
      }

      if (!data) {
        console.error('No data returned - likely RLS policy blocking insert')
        alert('Failed to save - please check database permissions')
        setSubmittingInteraction(false)
        return
      }

      if (data) {
        setInteractions(prev => [{ ...data, profiles: { email: 'You', display_name: null } } as Interaction, ...prev])

        // Log activity
        await supabase
          .from('activities')
          .insert({
            user_id: currentUserId,
            type: 'cooked',
            recipe_id: recipe.id,
            interaction_id: data.id,
          })

        // Remove from want_to_cook since they've now cooked it
        if (wantToCook) {
          await supabase
            .from('want_to_cook')
            .delete()
            .eq('user_id', currentUserId)
            .eq('recipe_id', recipe.id)
          setWantToCook(false)
        }

        // Mark as cooked
        setHasCooked(true)
      }
    } else if (interactionContent.trim() || uploadedImageUrl) {
      // Just a comment (no "made this")
      const { data, error } = await supabase
        .from('recipe_interactions')
        .insert({
          user_id: currentUserId,
          recipe_id: recipe.id,
          type: 'comment',
          rating: null,
          content: interactionContent || null,
          image_url: uploadedImageUrl,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Error saving comment:', error)
        alert(`Failed to save: ${error.message}`)
        setSubmittingInteraction(false)
        return
      }

      if (data) {
        setInteractions(prev => [{ ...data, profiles: { email: 'You', display_name: null } } as Interaction, ...prev])
      }
    }

    // Reset form
    setInteractionContent('')
    setAdjustmentContent('')
    setInteractionRating(5)
    setMadeThis(false)
    removeImage()
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
          {debugInfo && (
            <p className="text-xs text-red-400 mb-4 max-w-md mx-auto bg-zinc-800 p-3 rounded font-mono">
              {debugInfo}
            </p>
          )}
          <Link href="/profile" className="text-violet-400 hover:text-violet-300">
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Recipe Header */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden mb-6">
          {/* Recipe Image */}
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-64 object-cover"
            />
          )}

          <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold text-white bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-1 w-full focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              ) : (
                <h1 className="text-2xl font-bold text-white">
                  {recipe.title}
                </h1>
              )}
              <p className="text-sm text-zinc-400 mt-1">
                by {recipe.profiles?.display_name || recipe.profiles?.email}
              </p>
              {avgRating && (
                <p className="text-sm text-yellow-400 mt-1">
                  {'★'.repeat(Math.round(Number(avgRating)))} {avgRating} ({cookedInteractions.length} cook{cookedInteractions.length !== 1 ? 's' : ''})
                </p>
              )}
              {/* Time and Servings */}
              {(recipe.total_time_minutes || recipe.servings) && (
                <div className="flex gap-4 text-sm text-zinc-400 mt-2">
                  {recipe.total_time_minutes && (
                    <span>⏱ {recipe.total_time_minutes} min</span>
                  )}
                  {recipe.servings && (
                    <span>🍽 {recipe.servings} servings</span>
                  )}
                </div>
              )}
              {/* Tags - View or Edit mode */}
              {isEditing ? (
                <div className="mt-3">
                  <p className="text-xs text-zinc-400 mb-2">Tags (click to toggle):</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = editTags.includes(tag.name)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleEditTag(tag.name)}
                          className={`text-xs px-2 py-1 rounded-full border transition-all ${
                            isSelected
                              ? tag.color_class
                              : 'bg-zinc-700/50 text-zinc-500 border-zinc-600 hover:border-zinc-500'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                recipe.tags && recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {recipe.tags.map((tagName) => {
                      const tag = availableTags.find(t => t.name === tagName)
                      const colorClass = tag?.color_class || 'bg-zinc-600/30 text-zinc-400 border-zinc-600/50'
                      return (
                        <span
                          key={tagName}
                          className={`text-xs px-2 py-1 rounded-full border ${colorClass}`}
                        >
                          {tagName}
                        </span>
                      )
                    })}
                  </div>
                )
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Edit/Save/Cancel buttons for owner or admin */}
              {canEdit && (
                isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdits}
                      disabled={savingEdits}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {savingEdits ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={savingEdits}
                      className="px-4 py-2 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startEditing}
                    className="px-4 py-2 border border-violet-500 text-violet-400 hover:bg-violet-600/20 text-sm font-medium rounded-lg transition-colors"
                  >
                    Edit Recipe
                  </button>
                )
              )}
              {recipe.source_url && !isEditing && (
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
              {/* Want to Cook Button - shows if not cooked yet */}
              {!hasCooked && (
                <button
                  onClick={toggleWantToCook}
                  disabled={saving}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    wantToCook
                      ? 'bg-orange-600/30 text-orange-400 border border-orange-600/50'
                      : 'border border-zinc-600 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {saving ? '...' : wantToCook ? '♥ Want to Cook' : '+ Want to Cook'}
                </button>
              )}
              {/* Show cooked badge if they've cooked it */}
              {hasCooked && (
                <span className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600/30 text-green-400">
                  ✓ Cooked
                </span>
              )}
            </div>
          </div>

          {/* Visibility Toggle (Owner or Admin) */}
          {canEdit && (
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
        </div>

        {/* Ingredients */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Ingredients ({isEditing ? editIngredients.length : ingredients.length})
          </h2>

          {isEditing ? (
            // Edit Mode
            <div className="space-y-4">
              {/* Existing/edited ingredients */}
              <div className="space-y-2">
                {editIngredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center gap-2 py-2 px-3 bg-zinc-700/50 rounded-lg"
                  >
                    <input
                      type="number"
                      value={ing.quantity || ''}
                      onChange={(e) => updateEditIngredient(ing.id, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Qty"
                      step="0.25"
                      className="w-16 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white placeholder-zinc-400 focus:ring-1 focus:ring-violet-500"
                    />
                    <input
                      type="text"
                      value={ing.unit || ''}
                      onChange={(e) => updateEditIngredient(ing.id, 'unit', e.target.value || null)}
                      placeholder="unit"
                      className="w-20 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white placeholder-zinc-400 focus:ring-1 focus:ring-violet-500"
                    />
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateEditIngredient(ing.id, 'name', e.target.value)}
                      placeholder="Ingredient name"
                      className="flex-1 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white placeholder-zinc-400 focus:ring-1 focus:ring-violet-500"
                    />
                    <select
                      value={ing.category}
                      onChange={(e) => updateEditIngredient(ing.id, 'category', e.target.value)}
                      className="w-24 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white focus:ring-1 focus:ring-violet-500"
                    >
                      {categoryOrder.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeEditIngredient(ing.id)}
                      className="text-red-400 hover:text-red-300 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new ingredient */}
              <div className="border-t border-zinc-700 pt-4">
                <p className="text-sm text-zinc-400 mb-2">Add new ingredient:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="Qty"
                    step="0.25"
                    className="w-16 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white placeholder-zinc-400 focus:ring-1 focus:ring-violet-500"
                  />
                  <input
                    type="text"
                    value={newIngredient.unit}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="unit"
                    className="w-20 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white placeholder-zinc-400 focus:ring-1 focus:ring-violet-500"
                  />
                  <input
                    type="text"
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ingredient name"
                    className="flex-1 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white placeholder-zinc-400 focus:ring-1 focus:ring-violet-500"
                  />
                  <select
                    value={newIngredient.category}
                    onChange={(e) => setNewIngredient(prev => ({ ...prev, category: e.target.value }))}
                    className="w-24 px-2 py-1 text-sm bg-zinc-600 border border-zinc-500 rounded text-white focus:ring-1 focus:ring-violet-500"
                  >
                    {categoryOrder.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addNewIngredient}
                    disabled={!newIngredient.name.trim()}
                    className="px-3 py-1 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-600 disabled:text-zinc-400 text-white text-sm font-medium rounded transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // View Mode
            ingredients.length === 0 ? (
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
                            className="flex items-center gap-3 py-2 px-3 bg-zinc-700/50 rounded-lg"
                          >
                            <span className={`text-sm font-medium min-w-20 ${ing.quantity ? 'text-violet-400' : 'text-zinc-500 italic'}`}>
                              {ing.quantity && ing.unit
                                ? `${ing.quantity} ${ing.unit}`
                                : ing.quantity
                                ? `${ing.quantity}`
                                : 'to taste'}
                            </span>
                            <span className="text-zinc-200">
                              {ing.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Instructions
            </h2>
            <ol className="space-y-3">
              {recipe.instructions.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-zinc-300">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600/30 text-violet-400 flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{step.replace(/^Step \d+[:.]\s*/i, '')}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Add Interaction */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Share Your Experience
          </h2>

          <form onSubmit={submitInteraction} className="space-y-4">
            {/* "I made this" checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={madeThis}
                onChange={(e) => setMadeThis(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-zinc-200 font-medium">I made this!</span>
            </label>

            {/* Rating and adjustments - only shown when "I made this" is checked */}
            {madeThis && (
              <div className="pl-7 space-y-4 border-l-2 border-violet-600/50">
                {/* Rating */}
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

                {/* Adjustments field */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Any adjustments? (optional)
                  </label>
                  <textarea
                    value={adjustmentContent}
                    onChange={(e) => setAdjustmentContent(e.target.value)}
                    placeholder="e.g., I used chicken instead of beef, added extra garlic..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            )}

            {/* Comment - always shown */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {madeThis ? 'How did it turn out? (optional)' : 'Comment (optional)'}
              </label>
              <textarea
                value={interactionContent}
                onChange={(e) => setInteractionContent(e.target.value)}
                placeholder={madeThis ? 'Share your experience...' : 'Add a comment, question, or tip...'}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Add a photo (optional)
              </label>
              {interactionImagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={interactionImagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-sm font-bold"
                  >
                    x
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-600 rounded-lg cursor-pointer hover:border-violet-500 transition-colors">
                  <span className="text-xl">📷</span>
                  <span className="text-zinc-400 text-sm">
                    Click to upload a photo of your dish
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={submittingInteraction || (!madeThis && !interactionContent.trim() && !interactionImage)}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
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
                  <div className="flex gap-3">
                    {/* Avatar */}
                    {interaction.profiles?.avatar_url ? (
                      <img
                        src={interaction.profiles.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(interaction.profiles?.display_name || interaction.profiles?.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
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
                    <div className="text-sm space-y-2">
                      {interaction.content.split('\n\n').map((part, i) => {
                        if (part.startsWith('[Adjustments] ')) {
                          return (
                            <div key={i} className="bg-orange-600/10 border border-orange-600/30 rounded-lg p-2">
                              <span className="text-orange-400 font-medium text-xs">Adjustments: </span>
                              <span className="text-zinc-300">{part.replace('[Adjustments] ', '')}</span>
                            </div>
                          )
                        }
                        return <p key={i} className="text-zinc-300">{part}</p>
                      })}
                    </div>
                  )}

                  {interaction.image_url && (
                    <div className="mt-3">
                      <img
                        src={interaction.image_url}
                        alt="User submitted photo"
                        className="max-w-full h-auto max-h-64 rounded-lg object-cover"
                      />
                    </div>
                  )}

                  {/* Reactions */}
                  <ReactionBar targetType="interaction" targetId={interaction.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

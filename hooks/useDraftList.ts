'use client'

import { useState, useEffect, useCallback } from 'react'

export interface DraftRecipe {
  id: string
  title: string
  image_url: string | null
}

const STORAGE_KEY = 'recipe-pals-draft-list'

export function useDraftList() {
  const [draftRecipes, setDraftRecipes] = useState<DraftRecipe[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setDraftRecipes(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Error loading draft list:', e)
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage whenever draftRecipes changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftRecipes))
      } catch (e) {
        console.error('Error saving draft list:', e)
      }
    }
  }, [draftRecipes, isLoaded])

  const addRecipe = useCallback((recipe: DraftRecipe) => {
    setDraftRecipes(prev => {
      // Don't add duplicates
      if (prev.some(r => r.id === recipe.id)) {
        return prev
      }
      return [...prev, recipe]
    })
  }, [])

  const removeRecipe = useCallback((recipeId: string) => {
    setDraftRecipes(prev => prev.filter(r => r.id !== recipeId))
  }, [])

  const clearDraft = useCallback(() => {
    setDraftRecipes([])
  }, [])

  const isInDraft = useCallback((recipeId: string) => {
    return draftRecipes.some(r => r.id === recipeId)
  }, [draftRecipes])

  return {
    draftRecipes,
    addRecipe,
    removeRecipe,
    clearDraft,
    isInDraft,
    isLoaded,
    count: draftRecipes.length,
  }
}

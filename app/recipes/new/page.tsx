'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RecipeInput from '@/components/RecipeInput'
import IngredientList from '@/components/IngredientList'
import { createClient } from '@/lib/supabase'

interface Ingredient {
  name: string
  quantity: number | null
  unit: string | null
  category: string
}

interface ParsedRecipe {
  title: string
  ingredients: Ingredient[]
}

export default function NewRecipePage() {
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null)
  const [sourceType, setSourceType] = useState<string>('')
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRecipeParsed = (recipe: ParsedRecipe, type: string, url: string | null) => {
    setParsedRecipe(recipe)
    setSourceType(type)
    setSourceUrl(url)
  }

  const handleSave = async () => {
    if (!parsedRecipe) return

    setSaving(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Insert recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          title: parsedRecipe.title,
          source_url: sourceUrl,
          source_type: sourceType,
        })
        .select()
        .single()

      if (recipeError) throw recipeError

      // Insert ingredients
      const ingredientsToInsert = parsedRecipe.ingredients.map((ing) => ({
        recipe_id: recipe.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
      }))

      const { error: ingredientsError } = await supabase
        .from('ingredients')
        .insert(ingredientsToInsert)

      if (ingredientsError) throw ingredientsError

      // Log activity for new recipe
      await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          type: 'new_recipe',
          recipe_id: recipe.id,
        })

      // Success! Go back to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Error saving recipe:', error)
      alert('Failed to save recipe. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setParsedRecipe(null)
    setSourceType('')
    setSourceUrl(null)
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
            &larr; Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          Add New Recipe
        </h1>

        {!parsedRecipe ? (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <RecipeInput onRecipeParsed={handleRecipeParsed} />
          </div>
        ) : (
          <IngredientList
            title={parsedRecipe.title}
            ingredients={parsedRecipe.ingredients}
            onSave={handleSave}
            onCancel={handleCancel}
            saving={saving}
          />
        )}
      </main>
    </div>
  )
}

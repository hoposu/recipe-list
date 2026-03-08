'use client'

import { useState, useRef } from 'react'

interface Ingredient {
  name: string
  quantity: number | null
  unit: string | null
  category: string
}

interface ParsedRecipe {
  title: string
  image_url: string | null
  instructions: string[]
  total_time_minutes: number | null
  servings: number | null
  tags: string[]
  ingredients: Ingredient[]
}

interface RecipeInputProps {
  onRecipeParsed: (recipe: ParsedRecipe, sourceType: string, sourceUrl: string | null) => void
}

export default function RecipeInput({ onRecipeParsed }: RecipeInputProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseRecipe = async (recipeUrl?: string, imageBase64?: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/recipes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: recipeUrl,
          imageBase64,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse recipe')
      }

      onRecipeParsed(data.recipe, data.sourceType, data.sourceUrl)
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      parseRecipe(url.trim())
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await parseRecipe(undefined, base64)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => {
    setDragActive(false)
  }

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <form onSubmit={handleUrlSubmit}>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Paste a recipe URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.allrecipes.com/recipe/..."
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-600 bg-zinc-700 text-white placeholder-zinc-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Parsing...' : 'Parse'}
          </button>
        </div>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-zinc-800 text-zinc-500">or</span>
        </div>
      </div>

      {/* Image Upload */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragActive
            ? 'border-violet-500 bg-violet-900/20'
            : 'border-zinc-600 hover:border-violet-400'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
          disabled={loading}
        />
        <div className="text-4xl mb-2">📷</div>
        <p className="text-zinc-400">
          {loading ? 'Processing image...' : 'Drop an image here or click to upload'}
        </p>
        <p className="text-sm text-zinc-500 mt-1">
          Screenshot, photo of a cookbook, handwritten recipe
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}

'use client'

interface Ingredient {
  name: string
  quantity: number | null
  unit: string | null
  category: string
}

interface IngredientListProps {
  title: string
  imageUrl?: string | null
  ingredients: Ingredient[]
  instructions?: string[]
  totalTimeMinutes?: number | null
  servings?: number | null
  tags?: string[]
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}

const tagColors: Record<string, string> = {
  Vegetarian: 'bg-green-600/30 text-green-400',
  Soup: 'bg-amber-600/30 text-amber-400',
  Chicken: 'bg-yellow-600/30 text-yellow-400',
  Seafood: 'bg-cyan-600/30 text-cyan-400',
  Beef: 'bg-red-600/30 text-red-400',
  Pork: 'bg-pink-600/30 text-pink-400',
  Breakfast: 'bg-orange-600/30 text-orange-400',
  Sweet: 'bg-fuchsia-600/30 text-fuchsia-400',
  Savory: 'bg-indigo-600/30 text-indigo-400',
  Holiday: 'bg-rose-600/30 text-rose-400',
}

const categoryColors: Record<string, string> = {
  produce: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  dairy: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  meat: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  seafood: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  bakery: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  frozen: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  pantry: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  beverages: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300',
}

export default function IngredientList({
  title,
  imageUrl,
  ingredients,
  instructions,
  totalTimeMinutes,
  servings,
  tags,
  onSave,
  onCancel,
  saving = false
}: IngredientListProps) {
  // Group ingredients by category
  const grouped = ingredients.reduce((acc, ing) => {
    const cat = ing.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(ing)
    return acc
  }, {} as Record<string, Ingredient[]>)

  const categoryOrder = ['produce', 'dairy', 'meat', 'seafood', 'bakery', 'frozen', 'pantry', 'beverages', 'other']

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
      {/* Recipe Image */}
      {imageUrl && (
        <div className="mb-4 -mx-6 -mt-6">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-48 object-cover rounded-t-2xl"
          />
        </div>
      )}

      <h3 className="text-xl font-bold text-white mb-2">
        {title}
      </h3>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`text-xs px-2 py-1 rounded-full ${tagColors[tag] || 'bg-zinc-600/30 text-zinc-400'}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Recipe Info Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
          <div className="text-2xl mb-1">⏱</div>
          <div className="text-lg font-semibold text-white">
            {totalTimeMinutes ? `${totalTimeMinutes} min` : '—'}
          </div>
          <div className="text-xs text-zinc-400">Cook Time</div>
        </div>
        <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
          <div className="text-2xl mb-1">🍽</div>
          <div className="text-lg font-semibold text-white">
            {servings || '—'}
          </div>
          <div className="text-xs text-zinc-400">Servings</div>
        </div>
        <div className="bg-zinc-700/50 rounded-xl p-3 text-center">
          <div className="text-2xl mb-1">🥗</div>
          <div className="text-lg font-semibold text-white">
            {ingredients.length}
          </div>
          <div className="text-xs text-zinc-400">Ingredients</div>
        </div>
      </div>

      {/* Instructions */}
      {instructions && instructions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Instructions
          </h4>
          <ol className="space-y-2">
            {instructions.map((step, idx) => (
              <li key={idx} className="flex gap-3 text-sm text-zinc-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-600/30 text-violet-400 flex items-center justify-center text-xs font-medium">
                  {idx + 1}
                </span>
                <span>{step.replace(/^Step \d+[:.]\s*/i, '')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Ingredients */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Ingredients
        </h4>
        <div className="space-y-4">
        {categoryOrder.map((category) => {
          const items = grouped[category]
          if (!items || items.length === 0) return null

          return (
            <div key={category}>
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                {category}
              </h4>
              <ul className="space-y-1">
                {items.map((ing, idx) => {
                  const amount = ing.quantity && ing.unit
                    ? `${ing.quantity} ${ing.unit}`
                    : ing.quantity
                    ? `${ing.quantity}`
                    : null

                  return (
                    <li
                      key={idx}
                      className="flex items-center gap-3 py-2 px-3 bg-zinc-700/50 rounded-lg"
                    >
                      <span className={`text-sm font-medium min-w-20 ${amount ? 'text-violet-400' : 'text-zinc-500 italic'}`}>
                        {amount || 'to taste'}
                      </span>
                      <span className="text-zinc-200">
                        {ing.name}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-800 text-white font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Recipe'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="py-2 px-4 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

'use client'

interface Ingredient {
  name: string
  quantity: number | null
  unit: string | null
  category: string
}

interface IngredientListProps {
  title: string
  ingredients: Ingredient[]
  onSave: () => void
  onCancel: () => void
  saving?: boolean
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
  ingredients,
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
      <h3 className="text-xl font-bold text-white mb-4">
        {title}
      </h3>

      <div className="space-y-4 mb-6">
        {categoryOrder.map((category) => {
          const items = grouped[category]
          if (!items || items.length === 0) return null

          return (
            <div key={category}>
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                {category}
              </h4>
              <ul className="space-y-1">
                {items.map((ing, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 bg-zinc-700/50 rounded-lg"
                  >
                    <span className="text-zinc-200">
                      {ing.name}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {ing.quantity && ing.unit
                        ? `${ing.quantity} ${ing.unit}`
                        : ing.quantity
                        ? ing.quantity
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
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

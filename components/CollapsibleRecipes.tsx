'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Recipe {
  id: string
  title: string
  image_url: string | null
  tags: string[] | null
  visibility: string
  ingredients: { count: number }[]
}

interface CollapsibleRecipesProps {
  recipes: Recipe[]
}

export default function CollapsibleRecipes({ recipes }: CollapsibleRecipesProps) {
  const [expanded, setExpanded] = useState(false)

  // Show first 3 recipes (one row on lg) when collapsed
  const visibleRecipes = expanded ? recipes : recipes.slice(0, 3)
  const hasMore = recipes.length > 3

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {visibleRecipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recipes/${recipe.id}`}
            className="glass-card glass-card-hover overflow-hidden group"
          >
            {/* Image */}
            <div className="relative">
              {recipe.image_url ? (
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="w-full h-full object-cover image-hover"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 flex items-center justify-center">
                  <span className="text-5xl">🍽</span>
                </div>
              )}

              {/* Visibility badge */}
              {recipe.visibility !== 'private' && (
                <div className="absolute top-3 right-3">
                  <span className="px-2.5 py-1 bg-purple-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                    {recipe.visibility === 'public' ? 'Public' : 'Friends'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-5">
              <h3 className="text-lg font-semibold text-white group-hover:text-pink-400 transition-colors line-clamp-1">
                {recipe.title}
              </h3>

              {/* Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {recipe.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag-pill">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm text-white/40 mt-3">
                {recipe.ingredients?.[0]?.count || 0} ingredients
              </p>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-6 w-full py-3 glass-button text-white/70 hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {expanded ? (
            <>
              <span>Show less</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              <span>Show {recipes.length - 3} more recipes</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      )}
    </>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function BrowsePage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch shared recipes from other users (visibility = 'friends' or 'public')
  const { data: sharedRecipes } = await supabase
    .from('recipes')
    .select(`
      id,
      title,
      created_at,
      visibility,
      profiles:user_id (
        email,
        display_name
      ),
      ingredients (count)
    `)
    .neq('user_id', user.id)
    .in('visibility', ['friends', 'public'])
    .order('created_at', { ascending: false })

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

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          Browse Shared Recipes
        </h1>

        {sharedRecipes && sharedRecipes.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {sharedRecipes.map((recipe) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="bg-zinc-800 border border-zinc-700 rounded-xl p-5 hover:bg-zinc-700/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-white">
                    {recipe.title}
                  </h3>
                  <span className="text-xs px-2 py-1 bg-violet-600/30 text-violet-300 rounded">
                    {recipe.visibility}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-2">
                  by {(recipe.profiles as any)?.display_name || (recipe.profiles as any)?.email || 'Unknown'}
                </p>
                <p className="text-sm text-zinc-500">
                  {(recipe.ingredients as { count: number }[])[0]?.count || 0} ingredients
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <p className="text-zinc-400 mb-4">
              No shared recipes yet.
            </p>
            <p className="text-sm text-zinc-500">
              When other users share their recipes, they will appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import Logo from '@/components/Logo'
import DraftListSection from '@/components/DraftListSection'

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

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's recipes with ingredient count
  const { data: recipes } = await supabase
    .from('recipes')
    .select(`
      id,
      title,
      image_url,
      tags,
      source_type,
      created_at,
      visibility,
      ingredients (count)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch owned shopping lists
  const { data: ownedLists } = await supabase
    .from('shopping_lists')
    .select(`
      id,
      name,
      created_at,
      owner_id,
      shopping_list_items (
        id,
        checked
      )
    `)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch shared shopping lists (where user is a member but not owner)
  const { data: sharedListMemberships } = await supabase
    .from('shopping_list_members')
    .select(`
      list_id,
      role,
      shopping_lists (
        id,
        name,
        created_at,
        owner_id,
        shopping_list_items (
          id,
          checked
        ),
        profiles:owner_id (
          email
        )
      )
    `)
    .eq('user_id', user.id)
    .neq('role', 'owner')

  // Combine and format lists
  const allLists = [
    ...(ownedLists || []).map(list => ({ ...list, isOwned: true, ownerEmail: null })),
    ...(sharedListMemberships || []).map(m => ({
      ...(m.shopping_lists as any),
      isOwned: false,
      ownerEmail: (m.shopping_lists as any)?.profiles?.email
    }))
  ]

  // Fetch saved recipes
  const { data: savedRecipes } = await supabase
    .from('saved_recipes')
    .select(`
      id,
      saved_at,
      recipes (
        id,
        title,
        image_url,
        tags,
        visibility,
        profiles:user_id (
          email,
          display_name
        ),
        ingredients (count)
      )
    `)
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })
    .limit(5)

  // Fetch shared recipes from others (visibility = 'friends' or 'public')
  const { data: sharedRecipes } = await supabase
    .from('recipes')
    .select(`
      id,
      title,
      image_url,
      tags,
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
    .limit(5)

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <Logo />
            <div className="flex items-center gap-4">
              <Link
                href="/explore"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Explore
              </Link>
              <span className="text-sm text-white font-medium">Dashboard</span>
              <Link
                href="/settings"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Settings
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg text-white mb-1">
                  My Recipes
                </h3>
                <p className="text-3xl font-bold text-violet-400">
                  {recipes?.length || 0}
                </p>
              </div>
              <Link
                href="/recipes/new"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                + Add Recipe
              </Link>
            </div>
          </div>

          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg text-white mb-1">
                  Shopping Lists
                </h3>
                <p className="text-3xl font-bold text-violet-400">
                  {allLists.length}
                </p>
              </div>
              <Link
                href="/shopping-lists/new"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                + New List
              </Link>
            </div>
          </div>
        </div>

        {/* Draft Recipe List */}
        <DraftListSection />

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* My Recipes */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              My Recipes
            </h2>

            {recipes && recipes.length > 0 ? (
              <div className="space-y-3">
                {recipes.slice(0, 5).map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="flex gap-3 p-3 bg-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    {/* Recipe thumbnail */}
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-zinc-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <span className="text-2xl">🍽</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-medium text-white truncate">
                          {recipe.title}
                        </h3>
                        {recipe.visibility !== 'private' && (
                          <span className="text-xs px-2 py-1 bg-violet-600/30 text-violet-300 rounded flex-shrink-0">
                            {recipe.visibility}
                          </span>
                        )}
                      </div>
                      {(recipe as any).tags && (recipe as any).tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {((recipe as any).tags as string[]).slice(0, 2).map(tag => (
                            <span
                              key={tag}
                              className={`text-xs px-1.5 py-0.5 rounded ${tagColors[tag] || 'bg-zinc-600/30 text-zinc-400'}`}
                            >
                              {tag}
                            </span>
                          ))}
                          {(recipe as any).tags.length > 2 && (
                            <span className="text-xs text-zinc-500">+{(recipe as any).tags.length - 2}</span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-zinc-400">
                        {(recipe.ingredients as { count: number }[])[0]?.count || 0} ingredients
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-zinc-400 mb-4">
                  No recipes yet
                </p>
                <Link
                  href="/recipes/new"
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  Add your first recipe →
                </Link>
              </div>
            )}
          </div>

          {/* Shopping Lists */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Shopping Lists
            </h2>

            {allLists.length > 0 ? (
              <div className="space-y-3">
                {allLists.slice(0, 5).map((list) => {
                  const items = list.shopping_list_items as { id: string; checked: boolean }[]
                  const total = items?.length || 0
                  const checked = items?.filter(i => i.checked).length || 0
                  const progress = total > 0 ? Math.round((checked / total) * 100) : 0

                  return (
                    <Link
                      key={list.id}
                      href={`/shopping-lists/${list.id}`}
                      className="block p-4 bg-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-white">
                            {list.name}
                          </h3>
                          {!list.isOwned && (
                            <p className="text-xs text-zinc-500">
                              Shared by {list.ownerEmail}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-zinc-400">
                          {checked}/{total}
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-zinc-400 mb-4">
                  No shopping lists yet
                </p>
                <Link
                  href="/shopping-lists/new"
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  Create your first list →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Saved Recipes */}
        {savedRecipes && savedRecipes.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Saved Recipes
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {savedRecipes.map((saved) => {
                const recipe = saved.recipes as any
                if (!recipe) return null
                return (
                  <Link
                    key={saved.id}
                    href={`/recipes/${recipe.id}`}
                    className="flex gap-3 p-3 bg-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-zinc-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                        <span className="text-xl">🍽</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {recipe.title}
                      </h3>
                      {recipe.tags && recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(recipe.tags as string[]).slice(0, 2).map((tag: string) => (
                            <span
                              key={tag}
                              className={`text-xs px-1.5 py-0.5 rounded ${tagColors[tag] || 'bg-zinc-600/30 text-zinc-400'}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-zinc-400 truncate">
                        by {recipe.profiles?.display_name || recipe.profiles?.email || 'Unknown'}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Shared Recipes from Others */}
        {sharedRecipes && sharedRecipes.length > 0 && (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Shared by Others
              </h2>
              <Link
                href="/feed"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                See all →
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {sharedRecipes.map((recipe) => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="flex gap-3 p-3 bg-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-zinc-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                      <span className="text-xl">🍽</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-medium text-white truncate">
                      {recipe.title}
                    </h3>
                    {(recipe as any).tags && (recipe as any).tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {((recipe as any).tags as string[]).slice(0, 2).map((tag: string) => (
                          <span
                            key={tag}
                            className={`text-xs px-1.5 py-0.5 rounded ${tagColors[tag] || 'bg-zinc-600/30 text-zinc-400'}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-zinc-400 truncate">
                      by {(recipe.profiles as any)?.display_name || (recipe.profiles as any)?.email || 'Unknown'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

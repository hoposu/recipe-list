import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import CollapsibleRecipes from '@/components/CollapsibleRecipes'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email, avatar_url')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Chef'

  // Fetch user's recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select(`
      id,
      title,
      image_url,
      tags,
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
          email,
          display_name,
          avatar_url
        )
      )
    `)
    .eq('user_id', user.id)
    .neq('role', 'owner')

  // Combine lists
  const allLists = [
    ...(ownedLists || []).map(list => ({
      ...list,
      isOwned: true,
      ownerEmail: profile?.email || null,
      ownerName: profile?.display_name || null,
      ownerAvatar: profile?.avatar_url || null,
    })),
    ...(sharedListMemberships || []).map(m => ({
      ...(m.shopping_lists as any),
      isOwned: false,
      ownerEmail: (m.shopping_lists as any)?.profiles?.email,
      ownerName: (m.shopping_lists as any)?.profiles?.display_name,
      ownerAvatar: (m.shopping_lists as any)?.profiles?.avatar_url,
    }))
  ]

  // Count stats
  const recipeCount = recipes?.length || 0
  const listCount = allLists.length

  return (
    <div className="min-h-screen relative">
      {/* Aurora background */}
      <div className="aurora-bg" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b border-white/10 rounded-none">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/feed" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-lg">🦛</span>
              </div>
              <span className="text-xl font-semibold text-white">Recipe Pals</span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/feed" className="glass-button text-sm text-white/90 hover:text-white">
                Feed
              </Link>
              <Link href="/explore" className="glass-button text-sm text-white/90 hover:text-white">
                Explore
              </Link>
              <Link href="/settings" className="glass-button text-sm text-white/90 hover:text-white">
                Settings
              </Link>
              <LogoutButton />
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Profile Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          {/* Avatar */}
          <div className="mb-6">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-28 h-28 rounded-full object-cover mx-auto ring-4 ring-white/20 shadow-2xl"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center mx-auto text-5xl text-white font-semibold ring-4 ring-white/20 shadow-2xl">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Name */}
          <h1 className="heading-serif text-4xl md:text-5xl text-white mb-2">
            {displayName}
          </h1>
          <p className="text-white/50 mb-6">{profile?.email}</p>

          {/* Stats */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{recipeCount}</p>
              <p className="text-white/50 text-sm">Recipes</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{listCount}</p>
              <p className="text-white/50 text-sm">Lists</p>
            </div>
          </div>
        </div>

        {/* Shopping Lists Section */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="heading-serif text-2xl text-white">Shopping Lists</h2>
            <Link
              href="/shopping-lists/new"
              className="glass-button glass-button-active text-sm flex items-center gap-2"
            >
              <span>+</span>
              <span>New List</span>
            </Link>
          </div>

          {allLists.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {allLists.map((list) => {
                const items = list.shopping_list_items as { id: string; checked: boolean }[]
                const total = items?.length || 0
                const checked = items?.filter(i => i.checked).length || 0
                const progress = total > 0 ? Math.round((checked / total) * 100) : 0

                const ownerInitial = (list.ownerName || list.ownerEmail || 'U').charAt(0).toUpperCase()

                return (
                  <Link
                    key={list.id}
                    href={`/shopping-lists/${list.id}`}
                    className="glass-card glass-card-hover p-5"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      {/* Owner Avatar */}
                      {list.ownerAvatar ? (
                        <img
                          src={list.ownerAvatar}
                          alt={list.ownerName || list.ownerEmail || 'Owner'}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium ring-2 ring-white/10 flex-shrink-0">
                          {ownerInitial}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">
                          {list.name}
                        </h3>
                        {!list.isOwned && (
                          <p className="text-xs text-white/40 mt-0.5">
                            Shared by {list.ownerName || list.ownerEmail}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-white/50 ml-2 flex-shrink-0">
                        {checked}/{total}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {progress === 100 && total > 0 && (
                      <p className="text-emerald-400 text-xs mt-3 font-medium">
                        Complete!
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">🛒</div>
              <p className="text-white/80 text-lg mb-2">No shopping lists yet</p>
              <p className="text-white/50 mb-6">Create a list from your recipes</p>
              <Link
                href="/explore"
                className="glass-button glass-button-active inline-block"
              >
                Browse recipes to get started
              </Link>
            </div>
          )}
        </section>

        {/* My Recipes Section */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="heading-serif text-2xl text-white">My Recipes</h2>
            <Link
              href="/recipes/new"
              className="glass-button glass-button-active text-sm flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Recipe</span>
            </Link>
          </div>

          {recipes && recipes.length > 0 ? (
            <CollapsibleRecipes recipes={recipes as any} />
          ) : (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">🍳</div>
              <p className="text-white/80 text-lg mb-2">No recipes yet</p>
              <p className="text-white/50 mb-6">Start building your cookbook</p>
              <Link
                href="/recipes/new"
                className="glass-button glass-button-active inline-block"
              >
                Add your first recipe
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UserProfilePage({ params }: Props) {
  const { id: userId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    redirect('/login')
  }

  // If viewing own profile, redirect to /profile
  if (currentUser.id === userId) {
    redirect('/profile')
  }

  // Fetch the profile being viewed
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url')
    .eq('id', userId)
    .single()

  if (!profile) {
    notFound()
  }

  const displayName = profile.display_name || profile.email?.split('@')[0] || 'Chef'

  // Fetch user's public recipes
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
    .eq('user_id', userId)
    .in('visibility', ['public', 'friends'])
    .order('created_at', { ascending: false })

  const recipeCount = recipes?.length || 0

  // Fetch lists shared between current user and this user
  // First, get lists where current user is a member
  const { data: myMemberships } = await supabase
    .from('shopping_list_members')
    .select('list_id')
    .eq('user_id', currentUser.id)

  const myListIds = myMemberships?.map(m => m.list_id) || []

  // Then find lists where the viewed user is also a member
  let sharedLists: any[] = []
  if (myListIds.length > 0) {
    const { data: theirMemberships } = await supabase
      .from('shopping_list_members')
      .select('list_id')
      .eq('user_id', userId)
      .in('list_id', myListIds)

    const sharedListIds = theirMemberships?.map(m => m.list_id) || []

    if (sharedListIds.length > 0) {
      const { data: listsData } = await supabase
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
        .in('id', sharedListIds)
        .order('created_at', { ascending: false })

      sharedLists = listsData || []
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Aurora background */}
      <div className="aurora-bg" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b border-white/10 rounded-none">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/feed" className="flex items-center gap-2">
              <span className="heading-serif text-2xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Recipe Pals
              </span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/explore" className="glass-button text-sm text-white/90 hover:text-white">
                Explore
              </Link>
              <Link href="/profile" className="glass-button text-sm text-white/90 hover:text-white">
                Profile
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Profile Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          {/* Avatar */}
          <div className="mb-6">
            {profile.avatar_url ? (
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

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{recipeCount}</p>
              <p className="text-white/50 text-sm">Recipes</p>
            </div>
          </div>
        </div>

        {/* Shared Lists Section */}
        {sharedLists.length > 0 && (
          <section className="mb-12">
            <h2 className="heading-serif text-2xl text-white mb-6">
              Shared Lists
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedLists.map((list) => {
                const items = list.shopping_list_items as { id: string; checked: boolean }[]
                const total = items?.length || 0
                const checked = items?.filter((i: any) => i.checked).length || 0
                const progress = total > 0 ? Math.round((checked / total) * 100) : 0

                return (
                  <Link
                    key={list.id}
                    href={`/shopping-lists/${list.id}`}
                    className="glass-card glass-card-hover p-5"
                  >
                    <h3 className="font-semibold text-white truncate mb-2">
                      {list.name}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-white/50 mb-3">
                      <span>{checked}/{total} items</span>
                      {progress === 100 && total > 0 && (
                        <span className="text-emerald-400 text-xs font-medium">Complete!</span>
                      )}
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Recipes Section */}
        <section>
          <h2 className="heading-serif text-2xl text-white mb-6">
            {displayName}&apos;s Recipes
          </h2>

          {recipes && recipes.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {recipes.map((recipe) => (
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
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-white group-hover:text-pink-400 transition-colors line-clamp-1">
                      {recipe.title}
                    </h3>

                    {/* Tags */}
                    {(recipe as any).tags && (recipe as any).tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {((recipe as any).tags as string[]).slice(0, 3).map(tag => (
                          <span key={tag} className="tag-pill">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-white/40 mt-3">
                      {(recipe.ingredients as { count: number }[])[0]?.count || 0} ingredients
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <div className="text-5xl mb-4">🍳</div>
              <p className="text-white/80 text-lg mb-2">No public recipes yet</p>
              <p className="text-white/50">
                {displayName} hasn&apos;t shared any recipes publicly
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

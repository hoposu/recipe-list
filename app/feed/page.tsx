import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Activity {
  id: string
  user_id: string
  type: 'signup' | 'new_recipe' | 'cooked'
  recipe_id: string | null
  interaction_id: string | null
  created_at: string
  profiles: {
    email: string
    display_name: string | null
  }
  recipes: {
    id: string
    title: string
  } | null
  recipe_interactions: {
    id: string
    rating: number | null
    content: string | null
  } | null
}

export default async function FeedPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch recent activities
  const { data: activities } = await supabase
    .from('activities')
    .select(`
      id,
      user_id,
      type,
      recipe_id,
      interaction_id,
      created_at,
      profiles:user_id (
        email,
        display_name
      ),
      recipes:recipe_id (
        id,
        title
      ),
      recipe_interactions:interaction_id (
        id,
        rating,
        content
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          Activity Feed
        </h1>

        {activities && activities.length > 0 ? (
          <div className="space-y-4">
            {(activities as unknown as Activity[]).map((activity) => {
              const profile = activity.profiles as any
              const recipe = activity.recipes as any
              const interaction = activity.recipe_interactions as any
              const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Someone'

              return (
                <div
                  key={activity.id}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar placeholder */}
                    <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Signup Activity */}
                      {activity.type === 'signup' && (
                        <p className="text-zinc-200">
                          <span className="font-semibold text-white">{userName}</span>
                          {' '}joined Recipe List
                          <span className="ml-2 text-xs px-2 py-0.5 bg-green-600/30 text-green-400 rounded">
                            New member
                          </span>
                        </p>
                      )}

                      {/* New Recipe Activity */}
                      {activity.type === 'new_recipe' && recipe && (
                        <p className="text-zinc-200">
                          <span className="font-semibold text-white">{userName}</span>
                          {' '}added a new recipe:{' '}
                          <Link
                            href={`/recipes/${recipe.id}`}
                            className="text-violet-400 hover:text-violet-300 font-medium"
                          >
                            {recipe.title}
                          </Link>
                        </p>
                      )}

                      {/* Cooked Activity */}
                      {activity.type === 'cooked' && recipe && (
                        <div>
                          <p className="text-zinc-200">
                            <span className="font-semibold text-white">{userName}</span>
                            {' '}cooked{' '}
                            <Link
                              href={`/recipes/${recipe.id}`}
                              className="text-violet-400 hover:text-violet-300 font-medium"
                            >
                              {recipe.title}
                            </Link>
                          </p>
                          {interaction?.rating && (
                            <p className="text-yellow-400 text-sm mt-1">
                              {'★'.repeat(interaction.rating)}{'☆'.repeat(5 - interaction.rating)}
                            </p>
                          )}
                          {interaction?.content && (
                            <p className="text-zinc-400 text-sm mt-1 italic">
                              "{interaction.content}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-zinc-500 mt-1">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <p className="text-zinc-400 mb-2">
              No activity yet.
            </p>
            <p className="text-sm text-zinc-500">
              When people join, add recipes, or cook something, it will show up here.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

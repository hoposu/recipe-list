import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FeedHeader from '@/components/FeedHeader'
import ReactionBar from '@/components/ReactionBar'
import FeedComments from '@/components/FeedComments'

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
    avatar_url: string | null
  }
  recipes: {
    id: string
    title: string
    tags: string[]
    image_url: string | null
  } | null
  recipe_interactions: {
    id: string
    rating: number | null
    content: string | null
    image_url: string | null
  } | null
}

export default async function FeedPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's display name for welcome message
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .single()

  const displayName = currentProfile?.display_name || currentProfile?.email?.split('@')[0] || 'Chef'

  // Fetch activities without joins first (more reliable)
  const { data: rawActivities } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch related data separately
  const userIds = [...new Set(rawActivities?.map(a => a.user_id) || [])]
  const recipeIds = [...new Set(rawActivities?.filter(a => a.recipe_id).map(a => a.recipe_id) || [])]
  const interactionIds = [...new Set(rawActivities?.filter(a => a.interaction_id).map(a => a.interaction_id) || [])]

  // Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  // Fetch recipes
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, tags, image_url')
    .in('id', recipeIds.length > 0 ? recipeIds : ['none'])

  // Fetch interactions
  const { data: interactions } = await supabase
    .from('recipe_interactions')
    .select('id, rating, content, image_url')
    .in('id', interactionIds.length > 0 ? interactionIds : ['none'])

  // Build lookup maps
  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
  const recipeMap = new Map(recipes?.map(r => [r.id, r]) || [])
  const interactionMap = new Map(interactions?.map(i => [i.id, i]) || [])

  // Fetch reactions for all activities in bulk
  const activityIds = rawActivities?.map(a => a.id) || []
  const { data: allReactions } = await supabase
    .from('reactions')
    .select('target_id, emoji, user_id')
    .eq('target_type', 'activity')
    .in('target_id', activityIds.length > 0 ? activityIds : ['none'])

  // Build reaction data per activity
  const reactionsByActivity = new Map<string, { counts: Record<string, number>; userReactions: string[] }>()
  for (const activityId of activityIds) {
    reactionsByActivity.set(activityId, { counts: {}, userReactions: [] })
  }
  for (const reaction of allReactions || []) {
    const data = reactionsByActivity.get(reaction.target_id)
    if (data) {
      data.counts[reaction.emoji] = (data.counts[reaction.emoji] || 0) + 1
      if (reaction.user_id === user.id) {
        data.userReactions.push(reaction.emoji)
      }
    }
  }

  // Combine data
  const activities = rawActivities?.map(a => ({
    ...a,
    profiles: profileMap.get(a.user_id) || { email: 'Unknown', display_name: null, avatar_url: null },
    recipes: a.recipe_id ? recipeMap.get(a.recipe_id) || { id: a.recipe_id, title: 'Unknown Recipe', tags: [], image_url: null } : null,
    recipe_interactions: a.interaction_id ? interactionMap.get(a.interaction_id) || null : null,
  })) || []

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
              <Link href="/settings" className="glass-button text-sm text-white/90 hover:text-white">
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12 animate-fade-in-up">
          <h1 className="heading-serif text-5xl md:text-6xl text-white mb-3">
            Welcome back, {displayName}!
          </h1>
          <p className="text-white/60 text-lg">
            See what your friends have been cooking.
          </p>
        </div>

        {/* Feed Header with Post Button */}
        <div className="mb-8">
          <FeedHeader />
        </div>

        {/* Activity Feed */}
        {activities && activities.length > 0 ? (
          <div className="space-y-4 stagger-children">
            {activities.map((activity) => {
              const profile = activity.profiles as any
              const recipe = activity.recipes as any
              const interaction = activity.recipe_interactions as any
              const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Someone'

              const isCooked = activity.type === 'cooked'
              const isSignup = activity.type === 'signup'

              return (
                <article
                  key={activity.id}
                  className={`glass-card glass-card-hover p-5 ${
                    isCooked
                      ? 'bg-white/15'
                      : isSignup
                        ? 'bg-transparent border-white/5'
                        : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <Link href={`/profile/${activity.user_id}`} className="flex-shrink-0">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={userName}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20 hover:ring-pink-500/50 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg ring-2 ring-white/20 hover:ring-pink-500/50 transition-all">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0">
                      {/* Signup Activity */}
                      {activity.type === 'signup' && (
                        <div>
                          <p className="text-white">
                            <Link href={`/profile/${activity.user_id}`} className="font-semibold hover:text-pink-400 transition-colors">{userName}</Link>
                            <span className="text-white/60"> joined Recipe Pals</span>
                          </p>
                          <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            New member
                          </span>
                        </div>
                      )}

                      {/* New Recipe Activity */}
                      {activity.type === 'new_recipe' && recipe && (
                        <div>
                          <p className="text-white/80 mb-1">
                            <Link href={`/profile/${activity.user_id}`} className="font-medium text-white/90 hover:text-pink-400 transition-colors">{userName}</Link>
                            <span className="text-white/50"> added a new recipe</span>
                          </p>

                          {/* Recipe Card */}
                          <Link href={`/recipes/${recipe.id}`} className="block mt-3 group">
                            {recipe.image_url ? (
                              <div className="relative rounded-2xl overflow-hidden">
                                <img
                                  src={recipe.image_url}
                                  alt={recipe.title}
                                  className="w-full h-56 object-cover image-hover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                  <h3 className="text-xl font-semibold text-white text-shadow">
                                    {recipe.title}
                                  </h3>
                                  {recipe.tags && recipe.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {(recipe.tags as string[]).slice(0, 3).map((tag: string) => (
                                        <span key={tag} className="tag-pill">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="glass-card p-4 group-hover:bg-white/10 transition-colors">
                                <h3 className="text-lg font-semibold text-white">
                                  {recipe.title}
                                </h3>
                                {recipe.tags && recipe.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {(recipe.tags as string[]).slice(0, 3).map((tag: string) => (
                                      <span key={tag} className="tag-pill">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </Link>
                        </div>
                      )}

                      {/* Cooked Activity */}
                      {activity.type === 'cooked' && recipe && (
                        <div>
                          <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                            <span className="text-sm">🔥</span>
                            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Made it!</span>
                          </div>
                          <p className="text-white mb-1">
                            <Link href={`/profile/${activity.user_id}`} className="font-semibold hover:text-pink-400 transition-colors">{userName}</Link>
                            <span className="text-white/60"> cooked </span>
                            <Link
                              href={`/recipes/${recipe.id}`}
                              className="text-white hover:text-pink-400 transition-colors font-medium"
                            >
                              {recipe.title}
                            </Link>
                          </p>

                          {/* Rating */}
                          {interaction?.rating && (
                            <div className="flex items-center gap-1 mt-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={star <= interaction.rating ? 'text-yellow-400' : 'text-white/20'}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Comment */}
                          {interaction?.content && (
                            <div className="mt-3 space-y-2">
                              {interaction.content.split('\n\n').map((part: string, i: number) => {
                                if (part.startsWith('[Adjustments] ')) {
                                  return (
                                    <p key={i} className="text-sm text-amber-400/90 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                                      <span className="font-medium">Adjustments:</span> {part.replace('[Adjustments] ', '')}
                                    </p>
                                  )
                                }
                                return (
                                  <p key={i} className="text-white/70 text-sm italic">
                                    "{part}"
                                  </p>
                                )
                              })}
                            </div>
                          )}

                          {/* User's cooked photo */}
                          {interaction?.image_url && (
                            <div className="mt-3 relative">
                              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 via-orange-500/30 to-red-500/30 rounded-2xl blur-sm" />
                              <img
                                src={interaction.image_url}
                                alt="Cooked dish"
                                className="relative w-full max-h-80 object-cover rounded-2xl ring-1 ring-amber-500/20"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timestamp and Reactions */}
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-white/40">
                          {formatTimeAgo(activity.created_at)}
                        </p>
                        <ReactionBar
                          targetType="activity"
                          targetId={activity.id}
                          initialCounts={reactionsByActivity.get(activity.id)?.counts || {}}
                          initialUserReactions={reactionsByActivity.get(activity.id)?.userReactions || []}
                        />
                      </div>

                      {/* Comments */}
                      <FeedComments activityId={activity.id} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <div className="text-5xl mb-4">🍳</div>
            <p className="text-white/80 text-lg mb-2">
              No activity yet
            </p>
            <p className="text-white/50">
              When people join, add recipes, or cook something, it will show up here.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

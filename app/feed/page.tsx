import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import FeedHeader from '@/components/FeedHeader'

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
    .select('id, title, tags')
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

  // Combine data
  const activities = rawActivities?.map(a => ({
    ...a,
    profiles: profileMap.get(a.user_id) || { email: 'Unknown', display_name: null, avatar_url: null },
    recipes: a.recipe_id ? recipeMap.get(a.recipe_id) || { id: a.recipe_id, title: 'Unknown Recipe', tags: [] } : null,
    recipe_interactions: a.interaction_id ? interactionMap.get(a.interaction_id) || null : null,
  })) || []

  console.log('Fetched activities:', activities.length)

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

  // Helper: get the start of the week (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Helper: format week range
  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
    const startDay = weekStart.getDate()
    const endDay = weekEnd.getDate()

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
  }

  // Helper: get day name
  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Group activities by week and day
  const groupedActivities = activities.reduce((acc, activity) => {
    const date = new Date(activity.created_at)
    const weekStart = getWeekStart(date)
    const weekKey = weekStart.toISOString()
    const dayKey = getDayName(date)

    if (!acc[weekKey]) {
      acc[weekKey] = { weekStart, days: {} }
    }
    if (!acc[weekKey].days[dayKey]) {
      acc[weekKey].days[dayKey] = []
    }
    acc[weekKey].days[dayKey].push(activity)

    return acc
  }, {} as Record<string, { weekStart: Date; days: Record<string, typeof activities> }>)

  // Sort weeks (most recent first)
  type WeekData = { weekStart: Date; days: Record<string, Activity[]> }
  const sortedWeeks = (Object.entries(groupedActivities) as [string, WeekData][])
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())

  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
              <Link
                href="/dashboard"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="text-sm text-violet-400 hover:text-violet-300 font-medium"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <FeedHeader />

        {activities && activities.length > 0 ? (
          <div className="space-y-8">
            {sortedWeeks.map(([weekKey, weekData]) => (
              <div key={weekKey}>
                {/* Week Header */}
                <h2 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-zinc-700">
                  {formatWeekRange(weekData.weekStart)}
                </h2>

                <div className="space-y-6">
                  {dayOrder
                    .filter(day => weekData.days[day] && weekData.days[day].length > 0)
                    .reverse() // Most recent day first
                    .map(day => (
                      <div key={day}>
                        {/* Day Header */}
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">
                          {day}
                        </h3>

                        <div className="space-y-3">
                          {weekData.days[day].map((activity) => {
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
                    {/* Avatar */}
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={userName}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Signup Activity */}
                      {activity.type === 'signup' && (
                        <p className="text-zinc-200">
                          <span className="font-semibold text-white">{userName}</span>
                          {' '}joined Recipe Pals
                          <span className="ml-2 text-xs px-2 py-0.5 bg-green-600/30 text-green-400 rounded">
                            New member
                          </span>
                        </p>
                      )}

                      {/* New Recipe Activity */}
                      {activity.type === 'new_recipe' && recipe && (
                        <div>
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
                          {recipe.tags && recipe.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(recipe.tags as string[]).map((tag: string) => (
                                <span
                                  key={tag}
                                  className={`text-xs px-1.5 py-0.5 rounded ${tagColors[tag] || 'bg-zinc-600/30 text-zinc-400'}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
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
                          {recipe.tags && recipe.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(recipe.tags as string[]).map((tag: string) => (
                                <span
                                  key={tag}
                                  className={`text-xs px-1.5 py-0.5 rounded ${tagColors[tag] || 'bg-zinc-600/30 text-zinc-400'}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {interaction?.rating && (
                            <p className="text-yellow-400 text-sm mt-1">
                              {'★'.repeat(interaction.rating)}{'☆'.repeat(5 - interaction.rating)}
                            </p>
                          )}
                          {interaction?.content && (
                            <div className="mt-2 space-y-1">
                              {interaction.content.split('\n\n').map((part: string, i: number) => {
                                if (part.startsWith('[Adjustments] ')) {
                                  return (
                                    <p key={i} className="text-orange-400 text-sm">
                                      <span className="font-medium">Adjustments:</span> {part.replace('[Adjustments] ', '')}
                                    </p>
                                  )
                                }
                                return (
                                  <p key={i} className="text-zinc-400 text-sm italic">
                                    "{part}"
                                  </p>
                                )
                              })}
                            </div>
                          )}
                          {interaction?.image_url && (
                            <div className="mt-3">
                              <img
                                src={interaction.image_url}
                                alt="User submitted photo"
                                className="max-w-full h-auto max-h-48 rounded-lg object-cover"
                              />
                            </div>
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
                      </div>
                    ))}
                </div>
              </div>
            ))}
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

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const VALID_EMOJIS = ['🤤', '🫦', '😮‍💨', '🧀']

// GET reactions for a target
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { searchParams } = new URL(request.url)
  const targetType = searchParams.get('target_type')
  const targetId = searchParams.get('target_id')

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Get all reactions for this target
  const { data: reactions, error } = await supabase
    .from('reactions')
    .select('emoji, user_id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate counts and check if current user reacted
  const counts: Record<string, number> = {}
  const userReactions: string[] = []

  for (const reaction of reactions || []) {
    counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1
    if (user && reaction.user_id === user.id) {
      userReactions.push(reaction.emoji)
    }
  }

  return NextResponse.json({ counts, userReactions })
}

// POST to add a reaction
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { target_type, target_id, emoji } = body

  if (!target_type || !target_id || !emoji) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!VALID_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
  }

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    // Remove the reaction (toggle off)
    await supabase
      .from('reactions')
      .delete()
      .eq('id', existing.id)

    return NextResponse.json({ action: 'removed' })
  } else {
    // Add the reaction
    const { error } = await supabase
      .from('reactions')
      .insert({
        user_id: user.id,
        target_type,
        target_id,
        emoji,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ action: 'added' })
  }
}

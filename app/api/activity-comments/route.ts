import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET comments for an activity
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('activity_id')

  if (!activityId) {
    return NextResponse.json({ error: 'Missing activity_id' }, { status: 400 })
  }

  const { data: comments, error } = await supabase
    .from('activity_comments')
    .select(`
      id,
      content,
      created_at,
      user_id,
      profiles:user_id (
        display_name,
        email,
        avatar_url
      )
    `)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comments: comments || [] })
}

// POST to add a comment
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { activity_id, content } = body

  if (!activity_id || !content?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: comment, error } = await supabase
    .from('activity_comments')
    .insert({
      activity_id,
      user_id: user.id,
      content: content.trim(),
    })
    .select(`
      id,
      content,
      created_at,
      user_id,
      profiles:user_id (
        display_name,
        email,
        avatar_url
      )
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ comment })
}

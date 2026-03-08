import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// PUT update tags on a recipe (owner or admin)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recipeId, tags } = body

    if (!recipeId) {
      return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 })
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 })
    }

    // Check if user is owner or admin
    const { data: recipe } = await supabase
      .from('recipes')
      .select('user_id')
      .eq('id', recipeId)
      .single()

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
    }

    const isOwner = recipe.user_id === user.id

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.is_admin === true

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Update the recipe's tags
    const { error } = await supabase
      .from('recipes')
      .update({ tags })
      .eq('id', recipeId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tags })
  } catch (error) {
    console.error('Error updating recipe tags:', error)
    return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 })
  }
}

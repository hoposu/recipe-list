import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET all tags
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST create a new tag (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, color_class } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    // Check if tag already exists
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name.trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 400 })
    }

    // Create the tag
    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        name: name.trim(),
        color_class: color_class || 'bg-zinc-600/30 text-zinc-400 border-zinc-600/50',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tag })
  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

// DELETE a tag (admin only) - also removes from all recipes
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tagName = searchParams.get('name')

    if (!tagName) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    // First, remove this tag from all recipes that have it
    // We need to fetch all recipes with this tag and update them
    const { data: recipesWithTag } = await supabase
      .from('recipes')
      .select('id, tags')
      .contains('tags', [tagName])

    if (recipesWithTag && recipesWithTag.length > 0) {
      // Update each recipe to remove the tag
      for (const recipe of recipesWithTag) {
        const newTags = (recipe.tags || []).filter((t: string) => t !== tagName)
        await supabase
          .from('recipes')
          .update({ tags: newTags })
          .eq('id', recipe.id)
      }
    }

    // Now delete the tag from the tags table
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('name', tagName)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      recipesUpdated: recipesWithTag?.length || 0
    })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// The structure we want Claude to return
interface ParsedRecipe {
  title: string
  ingredients: {
    name: string
    quantity: number | null
    unit: string | null
    category: 'produce' | 'dairy' | 'meat' | 'seafood' | 'bakery' | 'frozen' | 'pantry' | 'beverages' | 'other'
  }[]
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url, imageBase64 } = body

    if (!url && !imageBase64) {
      return NextResponse.json(
        { error: 'Please provide a recipe URL or image' },
        { status: 400 }
      )
    }

    let recipeContent: string | null = null

    // If URL provided, fetch the page content
    if (url) {
      try {
        const response = await fetch(url)
        const html = await response.text()
        // Extract text content (basic HTML stripping)
        recipeContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000) // Limit content size
      } catch (e) {
        return NextResponse.json(
          { error: 'Could not fetch the recipe URL' },
          { status: 400 }
        )
      }
    }

    // Build the message for Claude
    const systemPrompt = `You are a recipe parsing assistant. Extract the recipe title and ingredients from the provided content.

Return ONLY valid JSON in this exact format:
{
  "title": "Recipe Name",
  "ingredients": [
    {
      "name": "ingredient name (e.g., 'onion', 'olive oil')",
      "quantity": 2,
      "unit": "cups",
      "category": "produce"
    }
  ]
}

Categories must be one of: produce, dairy, meat, seafood, bakery, frozen, pantry, beverages, other

Rules:
- quantity should be a number or null if not specified
- unit should be lowercase (cups, tbsp, tsp, oz, lb, etc.) or null
- Combine similar ingredients (e.g., "salt and pepper" becomes two entries)
- Be smart about categorization (flour = pantry, milk = dairy, chicken = meat)`

    let message

    if (imageBase64) {
      // Parse image with Claude's vision
      message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: 'Extract the recipe title and ingredients from this image. Return JSON only.',
              },
            ],
          },
        ],
        system: systemPrompt,
      })
    } else {
      // Parse URL content
      message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Extract the recipe title and ingredients from this webpage content:\n\n${recipeContent}`,
          },
        ],
        system: systemPrompt,
      })
    }

    // Extract the JSON from Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Try to parse JSON from the response
    let parsed: ParsedRecipe
    try {
      // Find JSON in the response (Claude might add explanation text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      return NextResponse.json(
        { error: 'Could not parse recipe. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      recipe: parsed,
      sourceType: imageBase64 ? 'image' : 'url',
      sourceUrl: url || null,
    })

  } catch (error) {
    console.error('Recipe parsing error:', error)
    return NextResponse.json(
      { error: 'An error occurred while parsing the recipe' },
      { status: 500 }
    )
  }
}

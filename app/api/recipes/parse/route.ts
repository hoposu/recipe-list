import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Valid recipe tags
const VALID_TAGS = ['Vegetarian', 'Soup', 'Chicken', 'Seafood', 'Beef', 'Pork', 'Breakfast', 'Sweet', 'Savory', 'Holiday'] as const
type RecipeTag = typeof VALID_TAGS[number]

// The structure we want Claude to return
interface ParsedRecipe {
  title: string
  image_url: string | null
  instructions: string[]
  total_time_minutes: number | null
  servings: number | null
  tags: RecipeTag[]
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
    let imageUrls: string[] = []

    // If URL provided, fetch the page content
    if (url) {
      try {
        const response = await fetch(url)
        const html = await response.text()

        // Extract image URLs before stripping HTML
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
        const ogImageRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi
        const ogImageRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi

        let match
        while ((match = imgRegex.exec(html)) !== null) {
          const imgUrl = match[1]
          // Filter for likely recipe images (larger images, not icons/logos)
          if (imgUrl && !imgUrl.includes('icon') && !imgUrl.includes('logo') && !imgUrl.includes('avatar')) {
            // Convert relative URLs to absolute
            if (imgUrl.startsWith('/')) {
              const urlObj = new URL(url)
              imageUrls.push(`${urlObj.origin}${imgUrl}`)
            } else if (imgUrl.startsWith('http')) {
              imageUrls.push(imgUrl)
            }
          }
        }

        // Also check for og:image meta tags (often the best image)
        while ((match = ogImageRegex.exec(html)) !== null) {
          imageUrls.unshift(match[1]) // Prioritize og:image
        }
        while ((match = ogImageRegex2.exec(html)) !== null) {
          imageUrls.unshift(match[1])
        }

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
    const systemPrompt = `You are a recipe parsing assistant. Extract the recipe details from the provided content.

Return ONLY valid JSON in this exact format:
{
  "title": "Recipe Name",
  "image_url": "https://example.com/recipe-image.jpg",
  "instructions": [
    "Step 1: Preheat oven to 350°F.",
    "Step 2: Mix the dry ingredients.",
    "Step 3: Add wet ingredients and stir."
  ],
  "total_time_minutes": 45,
  "servings": 4,
  "tags": ["Chicken", "Savory"],
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
Tags must be from: Vegetarian, Soup, Chicken, Seafood, Beef, Pork, Breakfast, Sweet, Savory, Holiday

Rules:
- image_url: pick the best image URL that shows the finished dish (not ingredients, not process shots). Use null if no good image available.
- instructions: array of step-by-step cooking instructions, each as a separate string
- total_time_minutes: total time (prep + cook) in minutes, or null if not specified
- servings: number of portions/servings, or null if not specified
- tags: assign relevant tags based on ingredients and dish type. A recipe can have multiple tags. Examples:
  - "Vegetarian" if no meat/seafood
  - "Chicken", "Beef", "Pork", "Seafood" based on main protein
  - "Soup" for soups, stews, broths
  - "Breakfast" for morning meals (eggs, pancakes, etc.)
  - "Sweet" for desserts, pastries, sweet dishes
  - "Savory" for savory main dishes and sides
  - "Holiday" for traditional holiday recipes (turkey, ham, pumpkin pie, etc.)

IMPORTANT - Ingredient quantities:
- ALWAYS extract the quantity and unit for each ingredient. This is critical for shopping lists.
- quantity should be a number (e.g., 2, 0.5, 1.5). Convert fractions: "1/2" = 0.5, "1/4" = 0.25, "3/4" = 0.75
- unit should be lowercase (cups, tbsp, tsp, oz, lb, cloves, stalks, leaves, cans, pieces, slices, etc.)
- For items like "2 stalks lemongrass", quantity=2, unit="stalks", name="lemongrass"
- For items like "1 can coconut milk", quantity=1, unit="can", name="coconut milk"
- For items like "3 lbs beef short ribs", quantity=3, unit="lb", name="beef short ribs"
- For items without explicit amounts (like "salt to taste"), use quantity=1, unit=null
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
                text: 'Extract the recipe title, instructions, time, servings, tags, and ingredients from this image. Return JSON only.',
              },
            ],
          },
        ],
        system: systemPrompt,
      })
    } else {
      // Parse URL content
      const imageUrlsInfo = imageUrls.length > 0
        ? `\n\nAvailable images on the page (pick the best one showing the finished dish):\n${imageUrls.slice(0, 10).join('\n')}`
        : ''

      message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Extract the recipe title, image_url, instructions, time, servings, tags, and ingredients from this webpage content:\n\n${recipeContent}${imageUrlsInfo}`,
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

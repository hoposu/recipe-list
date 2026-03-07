// Database types - these match our Supabase tables

export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Recipe {
  id: string
  user_id: string
  title: string
  source_url: string | null
  source_type: 'url' | 'image' | 'manual'
  image_url: string | null
  visibility: 'private' | 'friends' | 'public'
  created_at: string
}

export interface Ingredient {
  id: string
  recipe_id: string
  name: string
  quantity: number | null
  unit: string | null
  category: 'produce' | 'dairy' | 'meat' | 'seafood' | 'bakery' | 'frozen' | 'pantry' | 'beverages' | 'other'
}

export interface ShoppingList {
  id: string
  owner_id: string
  name: string
  created_at: string
}

export interface ShoppingListMember {
  id: string
  list_id: string
  user_id: string
  role: 'owner' | 'editor' | 'viewer'
}

export interface ShoppingListItem {
  id: string
  list_id: string
  ingredient_name: string
  quantity: number | null
  unit: string | null
  category: string | null
  checked: boolean
  added_by: string
  created_at: string
}

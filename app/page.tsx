import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect logged-in users to Activity feed
  if (user) {
    redirect('/feed')
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* Cute Hippo SVG */}
            <svg
              width="56"
              height="56"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Head */}
              <ellipse cx="50" cy="55" rx="35" ry="30" fill="#8B5CF6" />
              {/* Snout */}
              <ellipse cx="50" cy="70" rx="22" ry="16" fill="#A78BFA" />
              {/* Left nostril */}
              <ellipse cx="42" cy="70" rx="4" ry="3" fill="#6D28D9" />
              {/* Right nostril */}
              <ellipse cx="58" cy="70" rx="4" ry="3" fill="#6D28D9" />
              {/* Left eye */}
              <circle cx="35" cy="45" r="6" fill="white" />
              <circle cx="36" cy="45" r="3" fill="#1F2937" />
              {/* Right eye */}
              <circle cx="65" cy="45" r="6" fill="white" />
              <circle cx="66" cy="45" r="3" fill="#1F2937" />
              {/* Left ear */}
              <ellipse cx="22" cy="32" rx="8" ry="10" fill="#8B5CF6" />
              <ellipse cx="22" cy="32" rx="4" ry="6" fill="#DDD6FE" />
              {/* Right ear */}
              <ellipse cx="78" cy="32" rx="8" ry="10" fill="#8B5CF6" />
              <ellipse cx="78" cy="32" rx="4" ry="6" fill="#DDD6FE" />
              {/* Cute blush marks */}
              <ellipse cx="25" cy="58" rx="6" ry="3" fill="#F9A8D4" opacity="0.6" />
              <ellipse cx="75" cy="58" rx="6" ry="3" fill="#F9A8D4" opacity="0.6" />
            </svg>
            <h1 className="text-5xl font-bold text-white">
              Recipe Pals
            </h1>
          </div>
          <p className="text-xl text-violet-300">
            Turn any recipe into a shopping list. Share with family.
          </p>
        </header>

        {/* Hero Section */}
        <div className="bg-violet-600/20 border border-violet-500/30 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-3">
                1
              </div>
              <h3 className="font-medium text-lg mb-2 text-white">
                Drop in recipes
              </h3>
              <p className="text-zinc-400">
                Paste a URL or upload an image of any recipe
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-3">
                2
              </div>
              <h3 className="font-medium text-lg mb-2 text-white">
                AI extracts ingredients
              </h3>
              <p className="text-zinc-400">
                We automatically parse and categorize ingredients
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-3">
                3
              </div>
              <h3 className="font-medium text-lg mb-2 text-white">
                Shop together
              </h3>
              <p className="text-zinc-400">
                Share your list with family, check off items in real-time
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-8 rounded-full text-lg transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="border-2 border-violet-500 text-violet-300 hover:bg-violet-500/20 font-semibold py-3 px-8 rounded-full text-lg transition-colors"
            >
              Log In
            </Link>
          </div>
          <p className="text-zinc-500 text-sm">
            Free to use. No credit card required.
          </p>
        </div>
      </main>
    </div>
  )
}

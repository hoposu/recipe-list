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
    <div className="min-h-screen relative overflow-hidden">
      {/* Aurora background */}
      <div className="aurora-bg" />

      {/* Decorative floating elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        {/* Header */}
        <header className="text-center mb-20 animate-fade-in-up">
          <h1 className="heading-serif text-6xl md:text-8xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-6">
            Recipe Pals
          </h1>
          <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Turn any recipe into a shopping list.<br />
            Share with family. Cook together.
          </p>
        </header>

        {/* How it works */}
        <div className="glass-card p-10 mb-16">
          <h2 className="heading-serif text-3xl text-white mb-10 text-center">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5 shadow-lg shadow-pink-500/30">
                1
              </div>
              <h3 className="font-semibold text-xl mb-3 text-white">
                Drop in recipes
              </h3>
              <p className="text-white/50 leading-relaxed">
                Paste a URL or upload an image of any recipe
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5 shadow-lg shadow-purple-500/30">
                2
              </div>
              <h3 className="font-semibold text-xl mb-3 text-white">
                AI extracts ingredients
              </h3>
              <p className="text-white/50 leading-relaxed">
                We automatically parse and categorize everything for you
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-pink-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-5 shadow-lg shadow-blue-500/30">
                3
              </div>
              <h3 className="font-semibold text-xl mb-3 text-white">
                Shop together
              </h3>
              <p className="text-white/50 leading-relaxed">
                Share your list with family, check off items in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          <div className="glass-card glass-card-hover p-8">
            <div className="text-4xl mb-4">🍳</div>
            <h3 className="text-xl font-semibold text-white mb-2">Track what you cook</h3>
            <p className="text-white/50">Rate recipes, leave notes, and remember your favorites</p>
          </div>
          <div className="glass-card glass-card-hover p-8">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-white mb-2">Social cooking</h3>
            <p className="text-white/50">See what your friends are making and get inspired</p>
          </div>
          <div className="glass-card glass-card-hover p-8">
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart shopping lists</h3>
            <p className="text-white/50">Automatically combine ingredients from multiple recipes</p>
          </div>
          <div className="glass-card glass-card-hover p-8">
            <div className="text-4xl mb-4">📱</div>
            <h3 className="text-xl font-semibold text-white mb-2">Works anywhere</h3>
            <p className="text-white/50">Access your recipes from any device, anytime</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-6">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/signup"
              className="glass-button glass-button-active text-lg px-10 py-4 font-semibold"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="glass-button text-lg px-10 py-4 text-white/90 hover:text-white font-semibold"
            >
              Log In
            </Link>
          </div>
          <p className="text-white/40 text-sm">
            Free to use. No credit card required.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-white/30 text-sm">
        Made with love for home cooks everywhere
      </footer>
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-amber-900 dark:text-amber-100 mb-4">
            Recipe List
          </h1>
          <p className="text-xl text-amber-700 dark:text-amber-300">
            Turn any recipe into a shopping list. Share with family.
          </p>
        </header>

        {/* Hero Section */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8 mb-12">
          <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100 mb-6">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-3">1</div>
              <h3 className="font-medium text-lg mb-2 text-zinc-700 dark:text-zinc-200">
                Drop in recipes
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400">
                Paste a URL or upload an image of any recipe
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">2</div>
              <h3 className="font-medium text-lg mb-2 text-zinc-700 dark:text-zinc-200">
                AI extracts ingredients
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400">
                We automatically parse and categorize ingredients
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">3</div>
              <h3 className="font-medium text-lg mb-2 text-zinc-700 dark:text-zinc-200">
                Shop together
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400">
                Share your list with family, check off items in real-time
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-8 rounded-full text-lg transition-colors">
            Get Started
          </button>
          <p className="mt-4 text-amber-700 dark:text-amber-400 text-sm">
            Coming soon — sign up for early access
          </p>
        </div>
      </main>
    </div>
  );
}

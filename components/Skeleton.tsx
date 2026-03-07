export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-zinc-700 rounded ${className}`}
    />
  )
}

export function RecipeCardSkeleton() {
  return (
    <div className="p-4 bg-zinc-700/50 rounded-xl">
      <div className="flex justify-between items-start mb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-24 mt-2" />
    </div>
  )
}

export function ShoppingListCardSkeleton() {
  return (
    <div className="p-4 bg-zinc-700/50 rounded-xl">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-20 mt-1" />
        </div>
        <Skeleton className="h-5 w-10" />
      </div>
      <Skeleton className="h-2 w-full mt-3 rounded-full" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header Skeleton */}
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Skeleton className="h-7 w-28" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats Cards Skeleton */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-9 w-12" />
              </div>
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <Skeleton className="h-5 w-28 mb-2" />
                <Skeleton className="h-9 w-12" />
              </div>
              <Skeleton className="h-10 w-24 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Content Cards Skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <Skeleton className="h-6 w-28 mb-4" />
            <div className="space-y-3">
              <RecipeCardSkeleton />
              <RecipeCardSkeleton />
              <RecipeCardSkeleton />
            </div>
          </div>
          <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              <ShoppingListCardSkeleton />
              <ShoppingListCardSkeleton />
              <ShoppingListCardSkeleton />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export function ShoppingListSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-900">
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-36" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>

        {/* Progress */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-4 mb-6">
          <div className="flex justify-between mb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>

        {/* Items */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-6">
          <Skeleton className="h-4 w-20 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center p-3 bg-zinc-700/50 rounded-xl">
                <Skeleton className="w-6 h-6 rounded-full mr-3" />
                <Skeleton className="flex-1 h-5" />
                <Skeleton className="w-12 h-4 ml-2" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

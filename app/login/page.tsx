import AuthForm from '@/components/AuthForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      {/* Aurora background */}
      <div className="aurora-bg" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <span className="text-2xl">🦛</span>
          </div>
          <span className="heading-serif text-3xl text-white">Recipe Pals</span>
        </Link>

        <div className="glass-card p-8">
          <h1 className="heading-serif text-3xl text-white mb-2 text-center">
            Welcome back
          </h1>
          <p className="text-white/50 text-center mb-8">
            Sign in to continue cooking
          </p>

          <AuthForm mode="login" />

          <p className="mt-8 text-center text-sm text-white/50">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-pink-400 hover:text-pink-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center">
          <Link href="/" className="text-sm text-white/40 hover:text-white/70">
            &larr; Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}

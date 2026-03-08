import AuthForm from '@/components/AuthForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      {/* Aurora background */}
      <div className="aurora-bg" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center mb-10">
          <span className="heading-serif text-4xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            Recipe Pals
          </span>
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

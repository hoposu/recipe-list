import Link from 'next/link'

export default function Logo() {
  return (
    <Link href="/feed" className="flex items-center gap-2">
      <span className="heading-serif text-2xl bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
        Recipe Pals
      </span>
    </Link>
  )
}

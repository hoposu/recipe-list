import Link from 'next/link'

export default function Logo() {
  return (
    <Link href="/feed" className="flex items-center gap-2 text-xl font-bold text-white">
      {/* Cute Hippo SVG */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
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
      <span>Recipe Pals</span>
    </Link>
  )
}

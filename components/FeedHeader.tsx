'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PostActivityModal from './PostActivityModal'

export default function FeedHeader() {
  const [showPostModal, setShowPostModal] = useState(false)
  const router = useRouter()

  return (
    <>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white/60">
          Recent Activity
        </h2>
        <button
          onClick={() => setShowPostModal(true)}
          className="glass-button glass-button-active text-sm flex items-center gap-2"
        >
          <span>+</span>
          <span>Share what you cooked</span>
        </button>
      </div>

      <PostActivityModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onSuccess={() => {
          router.refresh()
        }}
      />
    </>
  )
}

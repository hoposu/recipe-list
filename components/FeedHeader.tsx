'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PostActivityModal from './PostActivityModal'

export default function FeedHeader() {
  const [showPostModal, setShowPostModal] = useState(false)
  const router = useRouter()

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">
          Activity
        </h1>
        <button
          onClick={() => setShowPostModal(true)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Post
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

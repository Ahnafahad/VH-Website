'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export default function LoginButton() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
  }

  if (session) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">
          Welcome, {session.user?.name || session.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signIn('google')}
      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md text-sm font-medium transition-colors min-h-[44px] flex items-center"
    >
      Sign In
    </button>
  )
}
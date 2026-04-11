'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignInForm() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false)
  const [isLoadingDev,    setIsLoadingDev]    = useState(false)
  const [email,    setEmail]    = useState('test@vh.dev')
  const [password, setPassword] = useState('dev123')
  const [error,    setError]    = useState('')
  const router       = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/'

  useEffect(() => {
    getSession().then(s => { if (s) router.push(callbackUrl) })
  }, [router, callbackUrl])

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true)
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setIsLoadingGoogle(false)
    }
  }

  const handleDevSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoadingDev(true)
    const res = await signIn('dev-credentials', {
      email,
      password,
      redirect: false,
    })
    if (res?.ok) {
      router.push(callbackUrl)
    } else {
      setError('Invalid credentials.')
      setIsLoadingDev(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access is restricted to authorized users
          </p>
        </div>

        {/* ── Dev credentials form ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">
            Dev Login
          </p>
          <form onSubmit={handleDevSignIn} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={isLoadingDev}
              className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md disabled:opacity-50"
            >
              {isLoadingDev ? 'Signing in…' : 'Sign in as Demo User'}
            </button>
          </form>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 text-gray-500">or</span>
          </div>
        </div>

        {/* ── Google ── */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoadingGoogle}
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoadingGoogle ? 'Signing in…' : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}

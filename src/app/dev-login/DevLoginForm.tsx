'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function DevLoginForm() {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(false)
    setBusy(true)
    const res = await signIn('dev-login', { code, redirect: false })
    setBusy(false)
    if (res?.ok) router.push(callbackUrl)
    else setError(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A0507] text-[#FAF5EF] px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#D4B094]/70 mb-4">
          Dev login · super admin
        </div>
        <input
          type="password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Login code"
          className="w-full rounded-lg bg-white/[0.06] border border-[#D4B094]/25 px-4 py-3 font-mono text-sm text-[#FAF5EF] placeholder:text-white/25 focus:outline-none focus:border-[#D4B094]/60"
        />
        {error && <p className="mt-2 font-mono text-[12px] text-red-400/80">Invalid code.</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-full bg-[#D4B094]/20 border border-[#D4B094]/40 px-5 py-3 font-sans text-sm font-medium hover:bg-[#D4B094]/30 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { signIn } from 'next-auth/react'

/**
 * Unified Google sign-in helper.
 *
 * - On Capacitor native (Android/iOS): invokes the native Google Credential Manager
 *   via @capgo/capacitor-social-login, then exchanges the returned idToken with the
 *   NextAuth 'google-native' CredentialsProvider.
 * - On web browsers: falls back to the standard NextAuth Google OAuth redirect.
 */
export async function googleSignIn(callbackUrl: string = '/'): Promise<void> {
  const isNative =
    typeof window !== 'undefined' &&
    !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.()

  if (isNative) {
    try {
      // Dynamic import so the native plugin is never bundled for web builds
      const { SocialLogin } = await import('@capgo/capacitor-social-login')

      await SocialLogin.initialize({
        google: {
          webClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
        },
      })

      const result = await SocialLogin.login({ provider: 'google', options: {} })

      const idToken =
        (result as unknown as { result?: { idToken?: string } }).result?.idToken

      if (!idToken) {
        throw new Error('google-native: no idToken returned from SocialLogin')
      }

      await signIn('google-native', { idToken, callbackUrl })
    } catch (err) {
      console.error('Native Google sign-in failed:', err)
      // Surface the error to the UI — callers should handle rejected promises
      throw err
    }
  } else {
    await signIn('google', { callbackUrl })
  }
}

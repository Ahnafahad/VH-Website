import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { OAuth2Client } from 'google-auth-library'
import {
  isEmailAuthorized,
  getUserByEmail,
  isAdminEmail,
  computeAccessFromProducts,
  clearAccessControlCache,
} from '@/lib/db-access-control'
import { getUserByEmail as getConfigUser } from '@/lib/generated-access-control'
import { db, users } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: 'google-native',
      name: 'Google (Native)',
      credentials: {
        idToken: { label: 'ID Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null
        try {
          const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
          const ticket = await client.verifyIdToken({
            idToken: credentials.idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
          })
          const payload = ticket.getPayload()
          if (!payload || !payload.email) return null
          return {
            id:    payload.sub,
            name:  payload.name  ?? payload.email.split('@')[0],
            email: payload.email,
            image: payload.picture ?? null,
          }
        } catch (e) {
          console.error('google-native idToken verification failed:', e)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Allow both the web Google OAuth flow and the native Capacitor token exchange
      if (account?.provider !== 'google' && account?.provider !== 'google-native') return false
      const email = user.email?.toLowerCase() || ''
      if (!email.endsWith('@gmail.com')) {
        console.log(`Sign-in rejected (non-gmail): ${email}`)
        return false
      }
      if (await isEmailAuthorized(email)) {
        console.log(`Sign-in OK: ${email}`)
        return true
      }
      // Auto-provision new gmail user. If access-control.json lists them as an
      // admin/super_admin, honor that role; otherwise default to free-tier student.
      const configRole = getConfigUser(email)?.role ?? 'student'
      const configName = getConfigUser(email)?.name
      try {
        await db.insert(users).values({
          email,
          name: configName || user.name || email.split('@')[0],
          role: configRole,
          status: 'active',
        })
        clearAccessControlCache(email)
        console.log(`Sign-in auto-provisioned: ${email} (${configRole})`)
        return true
      } catch (e) {
        console.error(`Auto-provision failed for ${email}:`, e)
        return false
      }
    },

    async session({ session }) {
      if (session.user?.email) {
        const userInfo = await getUserByEmail(session.user.email)
        if (userInfo) {
          const access = computeAccessFromProducts(userInfo)
          session.user.role        = userInfo.role as 'super_admin' | 'admin' | 'instructor' | 'student'
          session.user.isAdmin     = await isAdminEmail(session.user.email)
          session.user.permissions = ['read']
          session.user.studentId   = userInfo.studentId ?? undefined
          session.user.class       = userInfo.class     ?? undefined
          session.user.batch       = userInfo.batch     ?? undefined
          session.user.accessTypes = access.accessTypes
          session.user.mockAccess  = access.mockAccess
        }
      }
      return session
    },

    async jwt({ token, user }) {
      if (user?.email) {
        const userInfo = await getUserByEmail(user.email)
        if (userInfo) {
          const access    = computeAccessFromProducts(userInfo)
          token.role        = userInfo.role as 'super_admin' | 'admin' | 'instructor' | 'student'
          token.isAdmin     = await isAdminEmail(user.email)
          token.permissions = ['read']
          token.studentId   = userInfo.studentId ?? undefined
          token.class       = userInfo.class     ?? undefined
          token.batch       = userInfo.batch     ?? undefined
          token.accessTypes = access.accessTypes
          token.mockAccess  = access.mockAccess
        }
      }
      return token
    },
  },
  pages: {
    signIn: '/auth/signin',
    error:  '/auth/error',
  },
}

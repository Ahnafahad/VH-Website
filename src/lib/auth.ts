import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import {
  isEmailAuthorized,
  getUserByEmail,
  isAdminEmail,
  computeAccessFromProducts,
  clearAccessControlCache,
} from '@/lib/db-access-control'
import { db, users } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return false
      const email = user.email?.toLowerCase() || ''
      if (!email.endsWith('@gmail.com')) {
        console.log(`Sign-in rejected (non-gmail): ${email}`)
        return false
      }
      if (await isEmailAuthorized(email)) {
        console.log(`Sign-in OK: ${email}`)
        return true
      }
      // Auto-provision new gmail user as free-tier student
      try {
        await db.insert(users).values({
          email,
          name: user.name || email.split('@')[0],
          role: 'student',
          status: 'active',
        })
        clearAccessControlCache(email)
        console.log(`Sign-in auto-provisioned: ${email}`)
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

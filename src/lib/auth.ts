import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { isEmailAuthorized, getUserByEmail, isAdminEmail } from '@/lib/db-access-control'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase() || ''
        const isAuthorized = await isEmailAuthorized(email)

        if (isAuthorized) {
          console.log(`✅ Sign-in successful for: ${email}`)
        } else {
          console.log(`❌ Sign-in rejected for: ${email}`)
        }

        return isAuthorized
      }
      return false
    },
    async session({ session }) {
      // Enhance session with user role and additional info
      if (session.user?.email) {
        const userInfo = await getUserByEmail(session.user.email)
        if (userInfo) {
          session.user.role = userInfo.role
          session.user.isAdmin = await isAdminEmail(session.user.email)
          session.user.permissions = userInfo.permissions

          // Add student-specific info if applicable
          if ('studentId' in userInfo) {
            session.user.studentId = userInfo.studentId
            session.user.class = userInfo.class
            session.user.batch = userInfo.batch
          }

          // Add admin-specific info if applicable
          if ('adminId' in userInfo) {
            session.user.adminId = userInfo.adminId
          }

          // Add access types and mock access
          if ('accessTypes' in userInfo) {
            session.user.accessTypes = userInfo.accessTypes
            session.user.mockAccess = userInfo.mockAccess
          }
        }
      }
      return session
    },
    async jwt({ token, user }) {
      // Store user info in JWT token for persistence
      if (user?.email) {
        const userInfo = await getUserByEmail(user.email)
        if (userInfo) {
          token.role = userInfo.role
          token.isAdmin = await isAdminEmail(user.email)
          token.permissions = userInfo.permissions

          if ('studentId' in userInfo) {
            token.studentId = userInfo.studentId
            token.class = userInfo.class
            token.batch = userInfo.batch
          }

          if ('adminId' in userInfo) {
            token.adminId = userInfo.adminId
          }

          if ('accessTypes' in userInfo) {
            token.accessTypes = userInfo.accessTypes
            token.mockAccess = userInfo.mockAccess
          }
        }
      }
      return token
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  }
}
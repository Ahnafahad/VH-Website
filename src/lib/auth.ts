import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { isEmailAuthorized, getUserByEmail, isAdminEmail } from '@/lib/generated-access-control'

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
        const isAuthorized = isEmailAuthorized(email)

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
        const userInfo = getUserByEmail(session.user.email)
        if (userInfo) {
          session.user.role = userInfo.role
          session.user.isAdmin = isAdminEmail(session.user.email)
          session.user.permissions = userInfo.permissions

          // Add student-specific info if applicable
          if ('studentId' in userInfo) {
            session.user.studentId = userInfo.studentId
            session.user.class = userInfo.class
            session.user.batch = userInfo.batch
          }

          // Add admin-specific info if applicable
          if ('id' in userInfo) {
            session.user.adminId = userInfo.id
          }
        }
      }
      return session
    },
    async jwt({ token, user }) {
      // Store user info in JWT token for persistence
      if (user?.email) {
        const userInfo = getUserByEmail(user.email)
        if (userInfo) {
          token.role = userInfo.role
          token.isAdmin = isAdminEmail(user.email)
          token.permissions = userInfo.permissions

          if ('studentId' in userInfo) {
            token.studentId = userInfo.studentId
            token.class = userInfo.class
            token.batch = userInfo.batch
          }

          if ('id' in userInfo) {
            token.adminId = userInfo.id
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
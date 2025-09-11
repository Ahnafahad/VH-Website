import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { isEmailAuthorized } from '@/data/authorizedEmails'

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase() || ''
        return isEmailAuthorized(email)
      }
      return false
    },
    async session({ session, token }) {
      return session
    },
    async jwt({ token, user }) {
      return token
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  }
})

export { handler as GET, handler as POST }
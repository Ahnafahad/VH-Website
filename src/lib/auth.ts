import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { OAuth2Client } from 'google-auth-library'
import { timingSafeEqual } from 'crypto'
import fernet from 'fernet'
import {
  isEmailAuthorized,
  getUserByEmail,
  isAdminEmail,
  computeAccessFromProducts,
  clearAccessControlCache,
} from '@/lib/db-access-control'
import { getUserByEmail as getConfigUser } from '@/lib/generated-access-control'
import { db, users } from '@/lib/db'
import { isStaffRole } from '@/lib/auth/roles'
import { logAuthEvent } from '@/lib/super/security/auth-events'
import { resolveViewAs } from '@/lib/super/security/impersonation'

// ── Dev-only login shortcut ──────────────────────────────────────────────
// Lets local development sign in as the super-admin without the Google OAuth
// round-trip. HARD-GATED to NODE_ENV==='development': on Vercel NODE_ENV is
// 'production', so the provider below is never even constructed. Requires the
// DEV_LOGIN_FERNET_KEY/DEV_LOGIN_FERNET_TOKEN env vars (kept in .env.local,
// which is gitignored) — the token is a Fernet encryption of the real login
// code, decrypted at request time.
const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_LOGIN_EMAIL = 'ahnaf816@gmail.com'

function codeMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, so length-check first.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function decryptDevLoginCode(): string | null {
  const key = process.env.DEV_LOGIN_FERNET_KEY
  const token = process.env.DEV_LOGIN_FERNET_TOKEN
  if (!key || !token) return null
  try {
    const secret = new fernet.Secret(key)
    return new fernet.Token({ secret, token, ttl: 0 }).decode()
  } catch (e) {
    console.error('dev-login: failed to decrypt DEV_LOGIN_FERNET_TOKEN:', e)
    return null
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(IS_DEV && process.env.DEV_LOGIN_FERNET_KEY && process.env.DEV_LOGIN_FERNET_TOKEN
      ? [
          CredentialsProvider({
            id: 'dev-login',
            name: 'Dev Login',
            credentials: {
              code: { label: 'Login code', type: 'password' },
            },
            async authorize(credentials) {
              // Re-check the gate at call time — belt and suspenders.
              if (process.env.NODE_ENV !== 'development') return null
              const expected = decryptDevLoginCode()
              if (!expected) return null
              const got = (credentials?.code ?? '').trim()
              if (!got || !codeMatches(got, expected.trim())) {
                console.warn('dev-login: code mismatch, rejected')
                return null
              }
              console.log(`dev-login: granted as ${DEV_LOGIN_EMAIL}`)
              return {
                id:    `dev-${DEV_LOGIN_EMAIL}`,
                name:  'Ahnaf Ahad',
                email: DEV_LOGIN_EMAIL,
                image: null,
              }
            },
          }),
        ]
      : []),
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
      // Allow the Google OAuth flow, the native Capacitor token exchange, and
      // (development only) the dev-login shortcut. Identity for dev-login was
      // already verified in its authorize(); we still run it through the same
      // gmail-authorized / auto-provision path below.
      const isDevLogin = IS_DEV && account?.provider === 'dev-login'
      const email = user.email?.toLowerCase() || ''
      if (account?.provider !== 'google' && account?.provider !== 'google-native' && !isDevLogin) {
        await logAuthEvent('signin_denied', { email })
        return false
      }
      if (!email.endsWith('@gmail.com')) {
        console.log(`Sign-in rejected (non-gmail): ${email}`)
        await logAuthEvent('signin_denied', { email })
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
        await logAuthEvent('signin_denied', { email })
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
          session.user.readOnly    = !!userInfo.readOnly
          session.user.permissions = ['read']
          session.user.studentId   = userInfo.studentId ?? undefined
          session.user.class       = userInfo.class     ?? undefined
          session.user.batch       = userInfo.batch     ?? undefined
          session.user.accessTypes = access.accessTypes
          session.user.mockAccess  = access.mockAccess
        }
        // Super-admin "view as": overlay the target's identity. Writes are blocked in middleware.ts.
        const viewAs = await resolveViewAs(session.user.email)
        if (viewAs) {
          const t = viewAs.target
          const tAccess = computeAccessFromProducts(t)
          session.user.impersonatedBy = session.user.email
          session.user.email       = t.email
          session.user.name        = t.name
          session.user.image       = null
          session.user.role        = t.role as 'admin' | 'instructor' | 'student'
          session.user.isAdmin     = isStaffRole(t.role)
          session.user.readOnly    = true
          session.user.studentId   = t.studentId ?? undefined
          session.user.class       = t.class     ?? undefined
          session.user.batch       = t.batch     ?? undefined
          session.user.accessTypes = tAccess.accessTypes
          session.user.mockAccess  = tAccess.mockAccess
        }
      }
      return session
    },

    async jwt({ token, user }) {
      // Keep the read-only flag fresh on every token read (granting/revoking applies without a re-login).
      if (!user?.email && token.email) {
        const current = await getUserByEmail(token.email)
        token.readOnly = !!current?.readOnly
        // Force sign-out: reuses the cached lookup above. Throwing makes NextAuth treat the session as signed out.
        const invalidatedAt = current?.sessionsInvalidatedAt
        if (invalidatedAt && typeof token.iat === 'number' && token.iat < Math.floor(invalidatedAt.getTime() / 1000)) {
          throw new Error('Session revoked')
        }
      }
      if (user?.email) {
        const userInfo = await getUserByEmail(user.email)
        if (userInfo) {
          token.readOnly    = !!userInfo.readOnly
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
  events: {
    async signIn({ user }) {
      if (!user.email) return
      const u = await getUserByEmail(user.email).catch(() => null)
      await logAuthEvent('signin', { userId: u?.id, email: user.email })
    },
    async signOut({ token }) {
      if (!token?.email) return
      const u = await getUserByEmail(token.email).catch(() => null)
      await logAuthEvent('signout', { userId: u?.id, email: token.email })
    },
  },
  pages: {
    signIn: '/auth/signin',
    error:  '/auth/error',
  },
}

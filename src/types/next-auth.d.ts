// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth from "next-auth"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: 'super_admin' | 'admin' | 'student'
      isAdmin?: boolean
      permissions?: string[]
      studentId?: string
      adminId?: string
      class?: string
      batch?: string
      accessTypes?: {
        IBA: boolean
        FBS: boolean
      }
      mockAccess?: {
        duIba: boolean
        bupIba: boolean
        duFbs: boolean
        bupFbs: boolean
        fbsDetailed: boolean
      }
    }
  }

  interface User {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
    role?: 'super_admin' | 'admin' | 'student'
    isAdmin?: boolean
    permissions?: string[]
    studentId?: string
    adminId?: string
    class?: string
    batch?: string
    accessTypes?: {
      IBA: boolean
      DU: boolean
      FBS: boolean
    }
    mockAccess?: {
      duIba: boolean
      bupIba: boolean
      duFbs: boolean
      bupFbs: boolean
      fbsDetailed: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: 'super_admin' | 'admin' | 'student'
    isAdmin?: boolean
    permissions?: string[]
    studentId?: string
    adminId?: string
    class?: string
    batch?: string
    accessTypes?: {
      IBA: boolean
      DU: boolean
      FBS: boolean
    }
    mockAccess?: {
      duIba: boolean
      bupIba: boolean
      duFbs: boolean
      bupFbs: boolean
      fbsDetailed: boolean
    }
  }
}
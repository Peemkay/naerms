import type { NextAuthConfig } from "next-auth"
import { ADMIN_ROLES } from "@/lib/roles"

// Edge-safe half of the Auth.js config. This is the part Next.js Middleware
// loads (Middleware runs on the Edge runtime, which can't load Prisma's
// native engine or bcrypt) — so no `authorize()` / DB / bcrypt calls here.
// The Credentials provider itself lives in `auth.ts`, which only ever runs
// in the Node runtime (route handlers, server components, server actions).
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string
        token.serviceId = user.serviceId
        token.role = user.role
        token.formationId = user.formationId
        token.formationName = user.formationName
        token.rank = user.rank
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.userId
      session.user.serviceId = token.serviceId
      session.user.role = token.role
      session.user.formationId = token.formationId
      session.user.formationName = token.formationName
      session.user.rank = token.rank
      return session
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl

      if (pathname === "/login") {
        if (isLoggedIn) return Response.redirect(new URL("/", request.nextUrl))
        return true
      }

      if (!isLoggedIn) return false // Auth.js redirects to pages.signIn with callbackUrl

      if (pathname.startsWith("/admin") && !ADMIN_ROLES.includes(auth.user.role)) {
        return Response.redirect(new URL("/portal", request.nextUrl))
      }

      if (pathname.startsWith("/portal") && ADMIN_ROLES.includes(auth.user.role)) {
        return Response.redirect(new URL("/admin", request.nextUrl))
      }

      return true
    },
  },
} satisfies NextAuthConfig

import type { NextAuthConfig } from "next-auth"

// Edge-safe half of the Auth.js config. This is the part Next.js Middleware
// loads (Middleware runs on the Edge runtime, which can't load Prisma's
// native engine or bcrypt) — so no `authorize()` / DB / bcrypt calls here.
// The Credentials provider itself lives in `auth.ts`, which only ever runs
// in the Node runtime (route handlers, server components, server actions).
//
// There's no role tier to route on anymore — every formation lands on the
// same dashboard, and individual actions gate themselves on privileges. So
// this callback only has one job: logged in or not.
// Inactivity timeout. A restricted system on shared office machines should
// not stay logged in on an unattended screen.
//
// This is the *authoritative* half: `maxAge` expires the JWT itself, so a
// session idle past this is rejected by the server no matter what the
// browser does. `updateAge: 0` re-issues the cookie on every request that
// touches the session, which is what makes it a rolling idle window rather
// than a hard 30-minute cap on being logged in at all — active work keeps
// pushing the expiry out. The client-side timer in <IdleLogout> is purely
// so the user sees a clean warning and redirect instead of discovering it
// via a failed action.
export const IDLE_TIMEOUT_SECONDS = 30 * 60

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: IDLE_TIMEOUT_SECONDS,
    updateAge: 0,
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.formationId = user.id as string
        token.email = user.email
        token.name = user.name
        token.privileges = user.privileges
      }
      return token
    },
    session({ session, token }) {
      // A logged-in formation always has a real email/name (that's what it
      // logged in with) — the base JWT type just declares them nullable
      // for providers that don't guarantee it.
      session.user.id = token.formationId
      session.user.email = token.email!
      session.user.name = token.name!
      // Defensive fallback: a JWT signed before `privileges` existed on the
      // token (e.g. a browser session left over from an older deploy) would
      // otherwise decode with this field `undefined`, and every privilege
      // check downstream does `.includes(...)` on it.
      session.user.privileges = token.privileges ?? []
      return session
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl

      if (pathname === "/login") {
        if (isLoggedIn) return Response.redirect(new URL("/", request.nextUrl))
        return true
      }

      return isLoggedIn // Auth.js redirects to pages.signIn with callbackUrl otherwise
    },
  },
} satisfies NextAuthConfig

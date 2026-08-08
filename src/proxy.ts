import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

export default NextAuth(authConfig).auth

export const config = {
  // Run on everything except static assets, images, the auth API routes,
  // and public files (icons/logo) — those must load for a signed-out
  // visitor too (the login page itself renders the logo and needs a
  // favicon), so they can't be gated behind a session redirect.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|logo\\.png|login-bg\\.jpg).*)",
  ],
}

import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

export default NextAuth(authConfig).auth

export const config = {
  // Run on everything except static assets, images, and the auth API routes.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}

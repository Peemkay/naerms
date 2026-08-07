import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import ws from "ws"

import { env } from "@/lib/env"

// Prisma 7 requires a driver adapter for Postgres (no more built-in query
// engine + datasource url in schema.prisma). We use Neon's adapter, which
// talks to Neon over WebSocket/HTTP instead of a raw TCP socket — this also
// means it works from edge/serverless runtimes, not just Node.
neonConfig.webSocketConstructor = ws

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

// Standard Next.js dev-mode singleton: avoids exhausting DB connections
// from hot-reload re-instantiating the client on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

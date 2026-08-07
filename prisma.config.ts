import "dotenv/config"
import path from "node:path"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // Used by `prisma migrate` / `prisma db push` / `prisma studio` (the CLI),
  // via a plain TCP connection. The app itself connects through the Neon
  // driver adapter configured in src/lib/prisma.ts.
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
})

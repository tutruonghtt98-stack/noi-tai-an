import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
  // CLI (generate/migrate/db push) dùng kết nối trực tiếp (không qua pooler).
  // Runtime của app dùng DATABASE_URL (pooler) qua PrismaPg trong src/lib/db.ts.
  datasource: { url: env("DIRECT_URL") },
});

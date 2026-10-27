import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
  // CLI (generate/migrate/db push) dùng kết nối trực tiếp (không qua pooler).
  // Runtime của app dùng DATABASE_URL (pooler) qua PrismaPg trong src/lib/db.ts.
  // Fallback rỗng: môi trường build (postinstall → prisma generate) không cần
  // kết nối DB thật và không có biến này — env() sẽ ném lỗi cứng nếu thiếu.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});

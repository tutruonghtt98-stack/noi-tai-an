import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Serverless: nhiều instance function chạy song song, mỗi cái có pool riêng —
  // giữ pool nhỏ và timeout rõ ràng để tránh chiếm hết connection slot của Supabase.
  connectionTimeoutMillis: 8_000,
  max: 5,
});

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter, log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

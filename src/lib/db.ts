import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface HyperdriveEnv {
  HYPERDRIVE?: { connectionString: string };
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveConnectionString(): string | undefined {
  // Trên Cloudflare Workers, nodejs_compat TCP trực tiếp tới Postgres bên ngoài
  // không ổn định ("proxy request failed") — dùng Hyperdrive binding (proxy/pool
  // do Cloudflare quản lý). Local dev / seed script không có binding này, fallback
  // về DATABASE_URL.
  try {
    const { env } = getCloudflareContext<Record<string, unknown>>() as unknown as { env: HyperdriveEnv };
    if (env.HYPERDRIVE?.connectionString) return env.HYPERDRIVE.connectionString;
  } catch {
    // Ngoài request context (vd: không chạy trong Workers) — dùng fallback bên dưới.
  }
  return process.env.DATABASE_URL;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveConnectionString(),
    // pg.Pool mặc định KHÔNG có timeout khi mở kết nối mới — nếu Hyperdrive/mạng
    // treo thay vì báo lỗi, request sẽ chờ vô hạn và bị Workers runtime hủy
    // ("hung and would never generate a response"). Đặt timeout rõ ràng + giới
    // hạn pool nhỏ (dashboard bắn nhiều query song song qua Promise.all).
    connectionTimeoutMillis: 8_000,
    max: 5,
  });
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });
}

let instance: PrismaClient | undefined = globalForPrisma.prisma;

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    instance ??= createClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = instance;
    return Reflect.get(instance as object, prop, receiver);
  },
});

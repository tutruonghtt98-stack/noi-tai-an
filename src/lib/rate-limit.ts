import "server-only";
import { UserError } from "@/lib/action";

/**
 * Giới hạn tần suất đơn giản trong bộ nhớ (một tiến trình PM2).
 * Khi mở rộng nhiều instance, thay bằng Redis/Upstash với cùng giao diện.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) throw new UserError("RATE_LIMIT");
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
}

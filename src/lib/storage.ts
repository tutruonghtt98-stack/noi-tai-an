import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Lưu ảnh cộng đồng trên Cloudflare R2 (API tương thích S3).
 * Trình duyệt nén ảnh → xin URL ký sẵn (presigned PUT) → tải thẳng lên R2, không đi qua máy chủ.
 * Khi chưa cấu hình R2 và không phải production: lưu vào thư mục .uploads/ (chỉ để phát triển).
 */

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // sau khi nén
export const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const cfg = () => ({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: process.env.R2_PUBLIC_URL?.replace(/\/$/, ""),
});

export function r2Enabled() {
  const c = cfg();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicUrl);
}

export function storageMode(): "r2" | "local" {
  if (r2Enabled()) return "r2";
  if (process.env.NODE_ENV !== "production") return "local";
  throw new Error("STORAGE_NOT_CONFIGURED");
}

let client: S3Client | null = null;
function s3() {
  const c = cfg();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId!, secretAccessKey: c.secretAccessKey! },
  });
  return client;
}

export type UploadPurpose = "posts" | "avatars";

export function newKey(userId: string, contentType: string, purpose: UploadPurpose = "posts") {
  const rand = crypto.randomUUID().replace(/-/g, "");
  const month = new Date().toISOString().slice(0, 7);
  return `${purpose}/${userId}/${month}/${rand}.${EXT[contentType] ?? "bin"}`;
}

export const ownsKey = (userId: string, key: string, purpose?: UploadPurpose) =>
  (purpose ? [purpose] : ["posts", "avatars"]).some((p) => key.startsWith(`${p}/${userId}/`)) &&
  /^[a-z0-9/\-.]+$/i.test(key) &&
  !key.includes("..");

export function publicUrlFor(key: string) {
  return storageMode() === "r2" ? `${cfg().publicUrl}/${key}` : `/api/uploads/${key}`;
}

export async function presignPut(key: string, contentType: string, size: number) {
  const cmd = new PutObjectCommand({
    Bucket: cfg().bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: "public, max-age=31536000, immutable",
  });
  return getSignedUrl(s3(), cmd, { expiresIn: 300 });
}

/** Xác nhận file đã thực sự được tải lên và đúng giới hạn. */
export async function verifyUploaded(key: string): Promise<boolean> {
  if (storageMode() === "local") {
    const { stat } = await import("node:fs/promises");
    const path = await import("node:path");
    try {
      const s = await stat(path.join(process.cwd(), ".uploads", key));
      return s.size > 0 && s.size <= MAX_UPLOAD_BYTES;
    } catch {
      return false;
    }
  }
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: cfg().bucket, Key: key }));
    return (head.ContentLength ?? 0) > 0 && (head.ContentLength ?? 0) <= MAX_UPLOAD_BYTES;
  } catch {
    return false;
  }
}

export async function deleteObject(key: string) {
  try {
    if (storageMode() === "local") {
      const { rm } = await import("node:fs/promises");
      const path = await import("node:path");
      await rm(path.join(process.cwd(), ".uploads", key), { force: true });
    } else {
      await s3().send(new DeleteObjectCommand({ Bucket: cfg().bucket, Key: key }));
    }
  } catch (e) {
    console.error("[storage] delete failed", key, e);
  }
}

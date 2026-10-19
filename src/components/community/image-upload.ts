"use client";
import { requestUpload } from "@/actions/community";

const MAX_DIM = 1600;

/** Nén ảnh trên trình duyệt (WebP, cạnh dài ≤ 1600px) — giảm dung lượng & bỏ metadata EXIF/GPS. */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await toBlob("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;
  return (await toBlob("image/jpeg", 0.85))!;
}

/** Tải ảnh: xin URL → PUT trực tiếp lên R2 (hoặc endpoint local khi dev). Trả về key. */
export async function uploadImage(blob: Blob, purpose: "posts" | "avatars" = "posts"): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const res = await requestUpload({ contentType: blob.type, size: blob.size, purpose });
  if (!res.ok) return res;
  const put = await fetch(res.data.url, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
  if (!put.ok) return { ok: false, error: "BAD_IMAGE" };
  return { ok: true, key: res.data.key };
}

/** Ảnh đại diện: cắt vuông ở giữa, 512×512, WebP. */
export async function compressAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await toBlob("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return webp;
  return (await toBlob("image/jpeg", 0.88))!;
}

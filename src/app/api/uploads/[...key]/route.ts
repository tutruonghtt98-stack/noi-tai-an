import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { MAX_UPLOAD_BYTES, ownsKey, storageMode } from "@/lib/storage";

/**
 * Chỉ dùng khi phát triển (chưa cấu hình R2): nhận và phục vụ ảnh từ thư mục .uploads/.
 * Trên production với R2, ảnh được tải thẳng lên R2 và phục vụ qua R2_PUBLIC_URL.
 */
const ROOT = path.join(process.cwd(), ".uploads");
const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

function localOnly() {
  try {
    return storageMode() === "local";
  } catch {
    return false;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!localOnly()) return new Response("Not found", { status: 404 });
  const session = await auth();
  const key = (await params).key.join("/");
  if (!session?.user?.id || !ownsKey(session.user.id, key)) return new Response("Forbidden", { status: 403 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_UPLOAD_BYTES) return new Response("Too large", { status: 413 });
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return new Response(null, { status: 200 });
}

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!localOnly()) return new Response("Not found", { status: 404 });
  const key = (await params).key.join("/");
  if (key.includes("..")) return new Response("Bad request", { status: 400 });
  try {
    const data = await readFile(path.join(ROOT, key));
    return new Response(data, {
      headers: { "Content-Type": TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

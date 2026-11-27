import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasActiveAccess } from "@/lib/plan";

// Proxy (trước đây gọi middleware) luôn chạy Node.js runtime trong Next 16 —
// dùng Prisma trực tiếp được, không cần khai `runtime` nữa.
//
// QUAN TRỌNG: matcher bên dưới chỉ liệt kê đúng các route cần kiểm tra trả
// phí. Từng dùng một matcher rộng ("mọi thứ trừ _next/static...") khiến CẢ
// các trang tĩnh đã cache sẵn (/terms, /pricing...) cũng phải qua một lượt
// serverless function trước khi tới CDN — làm chậm hẳn những trang vốn
// được cache tức thời. Route nào không nằm trong matcher thì proxy không
// chạy, không có phí tổn gì (kể cả /billing — người hết hạn vẫn cần vào
// được để trả tiền, nên không đưa vào đây).
export default async function proxy(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return; // chưa đăng nhập — để requireUser() ở trang đích tự chuyển /login

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, planExpiresAt: true, trialEndsAt: true, createdAt: true },
  });
  if (!user || user.role === "ADMIN") return; // không khoá admin

  if (!hasActiveAccess(user)) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/analytics/:path*",
    "/community/:path*",
    "/customers/:path*",
    "/dashboard/:path*",
    "/departments/:path*",
    "/goals/:path*",
    "/habits/:path*",
    "/journey/:path*",
    "/settings/:path*",
    "/workspace/:path*",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasActiveAccess } from "@/lib/plan";

// Proxy (trước đây gọi middleware) luôn chạy Node.js runtime trong Next 16 —
// dùng Prisma trực tiếp được, không cần khai `runtime` nữa.

// Luôn cho qua: trang công khai, đăng nhập, trang mua gói/thanh toán (nếu
// chặn luôn /billing thì người hết hạn không vào nổi trang để trả tiền),
// API routes, và các route trong (public) group.
const EXEMPT_PREFIXES = ["/billing", "/login", "/pricing", "/terms", "/privacy", "/refund", "/contact", "/api"];

function isExempt(pathname: string) {
  if (pathname === "/") return true;
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isExempt(pathname)) return;

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">404</p>
        <h1 className="mt-3 text-3xl font-semibold">Không tìm thấy trang</h1>
        <p className="mt-2 text-ink-2">Trang bạn tìm không tồn tại hoặc đã bị di chuyển.</p>
        <Link href="/dashboard" className="btn btn-primary mt-8">Về Tổng quan</Link>
      </div>
    </div>
  );
}

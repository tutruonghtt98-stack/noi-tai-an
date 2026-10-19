import { requireAdmin } from "@/lib/session";
import { AdminNav } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-[2.5rem]">Quản trị hệ thống</h1>
        </div>
      </div>
      <AdminNav />
      {children}
    </>
  );
}

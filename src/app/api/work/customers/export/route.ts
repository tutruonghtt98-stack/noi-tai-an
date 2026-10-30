import { auth } from "@/auth";
import { getWorkCustomers, type WorkFilter, type WorkSort } from "@/lib/work-queries";

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** Xuất CSV danh sách khách hàng (không gian "Công việc"), theo đúng bộ lọc/sắp xếp đang xem. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const filter = (url.searchParams.get("filter") ?? "all") as WorkFilter;
  const sort = (url.searchParams.get("sort") ?? "spend") as WorkSort;
  const search = url.searchParams.get("q") ?? undefined;

  const rows = await getWorkCustomers(session.user.id, { search, filter, sort });

  const header = ["Tên", "Email", "Thành phố", "Kênh", "Số đơn", "Chi tiêu trọn đời (VND)", "Đơn gần nhất", "Nhãn"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        r.name,
        r.email,
        r.city ?? "",
        r.channel === "ONLINE" ? "Trực tuyến" : "Tại cửa hàng",
        String(r.orders),
        String(r.lifetimeCents),
        r.lastOrderAt ? r.lastOrderAt.toISOString().slice(0, 10) : "",
        r.tags.join("; "),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="khach-hang-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

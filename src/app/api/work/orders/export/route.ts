import { auth } from "@/auth";
import { getWorkOrders, type OrderChannelFilter, type OrderStatus } from "@/lib/work-queries";

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** Xuất CSV danh sách đơn hàng (không gian "Công việc"), theo đúng bộ lọc/sắp xếp đang xem. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "all") as OrderStatus | "all";
  const channel = (url.searchParams.get("channel") ?? "all") as OrderChannelFilter;
  const search = url.searchParams.get("q") ?? undefined;

  const rows = await getWorkOrders(session.user.id, { search, status, channel });

  const header = ["Mã đơn", "Khách hàng", "Thành phố", "Kênh", "Số lượng", "Tổng tiền (VND)", "Thanh toán", "Trạng thái", "Đặt lúc"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        `#${r.orderNo}`,
        r.customerName,
        r.customerCity ?? "",
        r.channel === "ONLINE" ? "Trực tuyến" : "Tại cửa hàng",
        String(r.items),
        String(r.totalCents),
        r.payment,
        r.status,
        r.placedAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="don-hang-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

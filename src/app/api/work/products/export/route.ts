import { auth } from "@/auth";
import { getWorkProducts, type ProductStatus } from "@/lib/work-queries";

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** Xuất CSV danh sách sản phẩm (không gian "Công việc"), theo đúng bộ lọc đang xem. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "all";
  const status = (url.searchParams.get("status") ?? "all") as ProductStatus | "all";
  const search = url.searchParams.get("q") ?? undefined;

  const rows = await getWorkProducts(session.user.id, { search, category, status });

  const header = ["Tên sản phẩm", "SKU", "Danh mục", "Giá bán (VND)", "Giá vốn (VND)", "Tồn kho", "Đặt lại ở", "Trạng thái", "Đánh giá", "Đã bán (30 ngày)"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [r.name, r.sku, r.category, String(r.priceCents), String(r.costCents), String(r.stock), String(r.reorderAt), r.status, String(r.rating), String(r.soldCount)]
        .map(csvCell)
        .join(","),
    ),
  ];
  const csv = "﻿" + lines.join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="san-pham-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

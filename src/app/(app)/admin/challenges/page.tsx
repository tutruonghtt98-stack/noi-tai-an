import { Trophy } from "lucide-react";

export default function Page() {
  return (
    <section className="card grid min-h-[40vh] place-items-center text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-accent-soft text-accent-ink">
          <Trophy className="size-7" aria-hidden />
        </span>
        <span className="badge mt-5">Giai đoạn 3</span>
        <h2 className="mt-3 text-2xl font-semibold">Thử thách chính thức</h2>
        <p className="mt-2 text-ink-2">Tạo thử thách 7/21/30 ngày do Nội Tại Ẩn tổ chức, cấu hình huy hiệu và nổi bật trên bảng tin.</p>
        <p className="mt-2 text-sm text-muted">Màn hình này sẽ hoạt động khi module Cộng đồng (H1–H5) được xây ở Giai đoạn 3.</p>
      </div>
    </section>
  );
}

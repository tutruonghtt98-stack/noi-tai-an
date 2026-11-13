# Workspace — Phase 1: thêm view Bảng (Table) và Lịch (Calendar)

## Bối cảnh / vì sao

Người dùng muốn nâng Workspace (hiện chỉ có 1 kiểu xem: Kanban 5 cột cố định) theo
hướng gần với các công cụ workspace đa năng kiểu AppFlowy/Notion — nhiều kiểu view
trên cùng một tập dữ liệu, document editor, trường dữ liệu tuỳ biến, đồng bộ
real-time thật. Đây là **việc lớn, chia 4 giai đoạn độc lập**, làm từng giai đoạn
một (đã thống nhất với user). Tài liệu này chỉ thiết kế **Giai đoạn 1**.

**Nguyên tắc bắt buộc xuyên suốt cả 4 giai đoạn (đã thống nhất với user):**
- Tự viết code, không copy/fork code của AppFlowy (tránh AGPL).
- "Thêm" (bảng DB mới, cột mới có default, component mới, view mới không bắt buộc
  dùng) → tự làm, không cần hỏi lại.
- "Thay thế" (đổi ý nghĩa/xoá 5 cột cố định hiện tại, đổi cấu trúc `WorkCard`/
  `WorkBoard` theo cách phá dữ liệu cũ, đổi mô hình phân quyền, bỏ Kanban hiện tại)
  → luôn dừng lại hỏi user trước.

## Mục tiêu giai đoạn 1

Cho phép xem cùng một board dưới 3 dạng: **Kanban** (giữ nguyên như hiện tại),
**Bảng** (dạng spreadsheet, mỗi thẻ 1 dòng), **Lịch** (xếp thẻ theo `dueDate` lên
lịch tháng). Chuyển qua lại bằng một thanh chọn view nhỏ, dữ liệu là **y hệt**
dữ liệu Kanban đang có — không có "dữ liệu Bảng" hay "dữ liệu Lịch" riêng.

## Không làm trong giai đoạn này (non-goals)

- Không thêm/sửa/xoá trường dữ liệu của thẻ (field tuỳ biến thuộc giai đoạn 3).
- Không đổi cách Kanban hiện tại hoạt động (kéo-thả, 5 cột, quyền hạn).
- Không đổi cơ chế đồng bộ (vẫn polling 15s như hiện tại — thuộc giai đoạn 2).
- Không cho sửa dữ liệu trực tiếp trên ô Bảng/Lịch (click vào thẻ ở Bảng/Lịch
  chỉ mở lại đúng `CardModal` hiện có để sửa, không làm inline-edit riêng).

## Anti-goals

- Không được làm Kanban hiện tại chậm hơn hoặc vỡ layout khi thêm view mới.
- Không bắt người dùng phải hiểu "view" là gì trước khi dùng được — mặc định vẫn
  mở thẳng vào Kanban như bây giờ, view khác là tuỳ chọn thêm.

## Ràng buộc

- Next.js App Router (Server Component cho `page.tsx`, Client Component cho các
  view tương tác), Prisma/Postgres, không có WebSocket dài hạn trên Vercel.
- Phải dùng lại đúng data đã fetch trong `getAccessibleBoards` — không query thêm.
- Phải dùng lại `CardModal`, `CardBody`, `dueLabel` đã có trong
  `src/app/(app)/workspace/kanban-board.tsx` và `card-modal.tsx` để Bảng/Lịch
  hiển thị nhất quán với Kanban (nhãn, hạn chót, checklist %...).
- Theo đúng style hệ thống hiện có (`.card`, `.segmented`, `StaggerReveal`, i18n
  qua `useI18n()`/`getI18n()` — không hardcode tiếng Anh, bài học từ phiên trước).

## Approaches đã cân nhắc

**A. (Đề xuất) Chuyển view qua URL param (`?v=kanban|table|calendar`), không lưu DB.**
Dữ liệu fetch 1 lần ở `page.tsx` như hiện tại, chỉ đổi component nào được render.
Ưu: không đụng schema, implement nhanh, URL chia sẻ được đúng view đang xem,
đúng tinh thần "thêm" thuần tuý. Nhược: không nhớ view yêu thích giữa các lần ghé
board khác nhau trong cùng phiên (chấp nhận được ở giai đoạn 1).

**B. Lưu view đang chọn vào DB (cột mới trên `WorkBoard`, vd. `lastView`).**
Ưu: nhớ lựa chọn. Nhược: vẫn là "thêm" (cột mới có default) nhưng tăng độ phức
tạp không cần thiết cho giai đoạn 1 — có thể bổ sung sau như một cải tiến nhỏ,
không chặn giai đoạn 1.

**C. Hệ thống "saved views" tuỳ biến đầy đủ (filter, sort, lưu nhiều view/board).**
Đây thực chất là một phần của giai đoạn 3 (database tuỳ biến). Quá tay cho giai
đoạn 1, bỏ qua.

**Chọn: Approach A.** Đơn giản nhất, rủi ro thấp nhất, đúng yêu cầu "thêm" thuần
tuý, không ai phải quyết định gì về schema.

## Thiết kế

### 1. View switcher
Component mới `src/app/(app)/workspace/view-switcher.tsx` (client), dùng class
`.segmented` có sẵn (giống tab Ngày/Tuần ở Hành trình) với 3 nút: Kanban / Bảng /
Lịch. Đặt ngay dưới `BoardSwitcher` hiện tại, cùng hàng với `NewBoardButton` hoặc
hàng riêng bên dưới. Click đổi `router.push` giữ nguyên `?b=` hiện tại, chỉ thêm/
đổi `?v=`.

### 2. `page.tsx`
Thêm `v?: string` vào kiểu `searchParams`. Validate `v` ∈ {"kanban","table",
"calendar"}, mặc định "kanban" nếu thiếu/sai. Map `active.lists` thành
`SerializedList[]` như đang làm (không đổi), rồi render có điều kiện:
`v === "kanban" ? <KanbanBoard .../> : v === "table" ? <WorkTableView .../> : <WorkCalendarView .../>`.
Cả 3 nhận cùng `lists`, `canManage`, `teams`, `members`, `openCardId`, `timezone`.

### 3. `work-table-view.tsx` (mới, client)
- Gộp `lists[].cards` thành 1 mảng phẳng kèm `listName`/`listColor` của từng thẻ.
- Render bảng HTML (giống style bảng ở `/customers`): cột Tiêu đề (+ nhãn),
  Trạng thái (tên cột Kanban, có chấm màu `DOT` tái dùng từ kanban-board.tsx),
  Người/; team phụ trách (Avatar), Hạn chót (`dueLabel`), Checklist (x/y).
- Sort client-side theo cột (click header), không cần lưu server.
- Click 1 dòng → mở `CardModal` (tái dùng y hệt cơ chế `openCardId` của
  `KanbanBoard`: state `openId`, tìm card theo id, render `<CardModal .../>`).

### 4. `work-calendar-view.tsx` (mới, client)
- Lưới lịch tháng (tái dùng pattern tính ô/tuần đã có trong
  `components/dashboard.tsx`'s `DisciplineCalendar`, viết lại cho phù hợp — không
  import thẳng component đó vì nó gắn với điểm kỷ luật, không phải thẻ).
- Mỗi ô ngày: liệt kê các thẻ có `dueDate` rơi vào ngày đó (tên thẻ rút gọn, màu
  theo `label`/list). Thẻ không có `dueDate` hiện ở một dải "Chưa có hạn" phía trên
  lịch, không bị rơi mất khỏi view.
- Click 1 thẻ trong ô ngày → mở `CardModal` giống Bảng.
- Tháng hiển thị mặc định = tháng hiện tại theo `timezone`; có nút lùi/tiến tháng
  (chỉ điều hướng UI, không fetch lại — vẫn cùng 1 tập `lists` đã có, vì thẻ không
  theo tháng cụ thể nào cả, mọi `dueDate` đều nằm trong cùng 1 bộ dữ liệu đã tải).

### 5. Không đổi
`kanban-board.tsx`, `card-modal.tsx`, `board-switcher.tsx`, schema Prisma,
mọi server action trong `src/actions/work.ts` — giữ nguyên 100%.

## Việc còn lại để người triển khai (builder) tự quyết, không cần hỏi lại user

- Tên khoá i18n cụ thể, cấu trúc nội bộ component, cách chia nhỏ file nếu
  `work-table-view.tsx`/`work-calendar-view.tsx` quá dài.
- Cách tái dùng `DOT`/`CardBody`/`dueLabel` (export thêm nếu cần, miễn không đổi
  behaviour của `KanbanBoard`).
- Có cho sort nhiều cột cùng lúc ở Bảng hay chỉ 1 cột — mặc định 1 cột, đơn giản.

# Thiết kế: Mô tả công việc + nhiều người phụ trách ngang hàng

## Bối cảnh & lý do

Workspace hiện pool thẻ từ mọi bảng vào 1 view duy nhất (List/Kanban/Calendar).
Mỗi thẻ (`WorkCard`) hiện chỉ có:
- `label` (dùng hiển thị "Loại")
- **một** người phụ trách duy nhất: `assignee` (email dạng text, hiển thị kể cả
  khi email đó chưa có tài khoản) + `assigneeUserId` (khớp tài khoản nếu có)

Không có trường mô tả dài nào cho thẻ. So với ảnh tham khảo (Task.Co-style),
thiếu 2 thứ: một ô "Descriptions" ngắn, và khả năng gắn nhiều người vào cùng
một thẻ với avatar xếp chồng.

Người dùng xác nhận: khi nhiều người cùng phụ trách một thẻ, tất cả đều
**ngang hàng** — không có khái niệm "người chính/người phụ" — và **mỗi người
đều nhận đủ 100%** điểm thưởng/phạt kỷ luật khi thẻ hoàn thành đúng hạn hoặc
trễ hạn (không chia nhỏ điểm theo số người).

## Phát hiện quan trọng (ràng buộc kỹ thuật)

Hệ thống tính điểm kỷ luật (`src/lib/journey-score-ledger.ts`,
`src/lib/journey-scoring.ts`) ghi vào `DisciplineTransaction`, có cột
`idempotencyKey` **unique toàn cục**, sinh bởi
`workspaceScoreIdempotencyKey(cardId, eventType, localDate)` — **không có
userId trong khoá**. Nếu 2 người cùng phụ trách 1 thẻ và cả 2 đều cần được
ghi điểm cho cùng một sự kiện (vd. "trễ hạn ngày thứ N" của cùng 1 thẻ, cùng
1 ngày), bản ghi của người thứ 2 sẽ bị `skipDuplicates: true` âm thầm bỏ qua
vì trùng khoá với người thứ 1.

→ Đây là nơi **bắt buộc phải sửa** để nhiều người cùng được tính điểm độc
lập: khoá phải thêm `userId`. Đây là điểm rủi ro cao nhất của toàn bộ thay
đổi vì đụng trực tiếp vào logic tính điểm kỷ luật — core của ứng dụng.

Các nơi khác đang giả định "1 thẻ = 1 người phụ trách":
- `canActOnCard` (quyền thao tác thẻ)
- `getAccessibleBoards`'s cardGrant (ai thấy thẻ nào trong view gộp)
- `WorkCardEvent.fromAssigneeUserId` / `toAssigneeUserId` (snapshot lịch sử,
  dùng để tính thời điểm "được giao" phục vụ bonus "giao và hoàn thành cùng
  ngày" + điểm bắt đầu tính trễ hạn)
- `syncOverdueDiscipline(userId, ...)` (quét thẻ trễ hạn theo 1 userId)
- Toàn bộ UI: `AssigneePicker` (ô nhập email đơn), `card-modal.tsx`,
  `new-task-button.tsx`, `work-list-view.tsx` (cột "Phụ trách"),
  `kanban-board.tsx` (avatar trên thẻ)

## Goals

1. Thêm trường **Mô tả công việc** (text ngắn, vài dòng) cho `WorkCard`:
   sửa được trong form tạo thẻ và trong card-modal; hiển thị trong List view
   (cột mới) và Kanban (dưới tiêu đề thẻ).
2. Thay **1 người phụ trách** bằng **nhiều người phụ trách ngang hàng**:
   - Ai cũng thao tác được thẻ như người phụ trách hiện tại đang được (xem,
     sửa nội dung/tiến độ; không đổi được người/team phụ trách — vẫn là
     quyền riêng của chủ bảng, giữ nguyên nguyên tắc hiện tại).
   - Mỗi người đều được tính điểm kỷ luật đầy đủ (100%) độc lập khi thẻ
     hoàn thành đúng hạn/sớm hoặc trễ hạn.
   - UI chọn nhiều người: thay ô nhập email đơn bằng danh sách chip (thêm/bớt
     từng người), hiển thị avatar xếp chồng ở List/Kanban giống ảnh mẫu.

## Non-goals

- Không chia nhỏ điểm theo số người phụ trách (đã quyết: 100% mỗi người).
- Không thêm vai trò khác nhau giữa những người phụ trách (vd. người duyệt
  vs người làm) — tất cả ngang hàng.
- Không đổi cách gắn **team** phụ trách thẻ (`teamId`) — vẫn 1 team/thẻ,
  giữ nguyên.
- Không đổi người phụ trách **bảng** (`WorkBoard.assignee`/`assigneeUserId`)
  — đây là khái niệm khác ở cấp bảng, không đụng tới trong lần này.
- Không truy tính lại điểm cho các thẻ đã đóng (Hoàn thành) khi sau này có
  ai thêm/bớt người phụ trách — giữ nguyên nguyên tắc hiện tại: đổi người
  phụ trách không xoá các `DisciplineTransaction` đã ghi trong quá khứ.

## Anti-goals

- Không được để việc đổi khoá chống trùng làm vỡ/trùng điểm của các thẻ
  **đang có sẵn 1 người phụ trách** — các dòng `DisciplineTransaction` cũ
  giữ nguyên định dạng khoá cũ, chỉ các sự kiện **mới phát sinh sau khi
  deploy** dùng khoá có userId.
- Không được để thêm người phụ trách thứ 2 làm dừng việc tính điểm của
  người phụ trách thứ 1 đang có.

## Approaches đã cân nhắc (đã chốt trong hội thoại)

1. **(Chọn) Bảng nhiều-nhiều `WorkCardAssignee`, ngang hàng, 100% điểm mỗi
   người.** Đúng yêu cầu người dùng, đơn giản nhất về mặt khái niệm (không
   có "chính/phụ").
2. (Đã loại) Giữ `assigneeUserId` đơn làm người duy nhất được tính điểm +
   thêm danh sách "người theo dõi" chỉ xem/thao tác, không tính điểm — bị
   loại vì người dùng muốn tất cả ngang hàng và đều tính điểm.
3. (Đã loại) Chia đều điểm theo số người phụ trách — bị loại, người dùng
   chọn mỗi người nhận đủ 100%.

## Thay đổi dữ liệu (schema)

- **Bảng mới** `WorkCardAssignee`:
  - `id`, `cardId` (FK → `WorkCard`, `onDelete: Cascade`)
  - `email` (string — vẫn giữ kiểu "nhập email, hiển thị được kể cả chưa
    có tài khoản", đúng hành vi hiện tại của trường `assignee`)
  - `userId` (nullable FK → `User`, khớp nếu email đã có tài khoản,
    `onDelete: SetNull`)
  - `createdAt`
  - Unique `(cardId, email)` — không thêm trùng 1 email 2 lần vào cùng 1 thẻ.
  - Index trên `userId` (phục vụ `canActOnCard`, `getAccessibleBoards`,
    `syncOverdueDiscipline`).
- **`WorkCard`**: thêm `description String?` (không giới hạn độ dài ở DB,
  giới hạn ở tầng action, đề xuất tối đa 2000 ký tự). **Bỏ** `assignee` và
  `assigneeUserId` (thay hoàn toàn bằng quan hệ `assignees`).
- **`WorkCardEvent`**: đổi `fromAssigneeUserId`/`toAssigneeUserId` (String?)
  thành `fromAssigneeIds`/`toAssigneeIds` (Json, default `"[]"`, mảng
  userId) — snapshot toàn bộ tập người phụ trách trước/sau sự kiện, dùng để
  tính "được giao lúc nào" cho từng người (bonus cùng-ngày, mốc bắt đầu
  trễ hạn).
- **`DisciplineTransaction`**: không đổi schema (đã có `userId` riêng mỗi
  dòng) — chỉ đổi **định dạng chuỗi** `idempotencyKey` (thêm đoạn userId).
- Migrate theo quy ước đã dùng trong session này: sửa `schema.prisma` rồi
  `prisma db push` (không tạo file migration riêng, khớp cách đã làm với
  `priority`, `sortOrder` trước đó) — sẽ xin xác nhận lại trước khi chạy.
- **Backfill bắt buộc** (chạy 1 lần, trước khi xoá cột cũ): với mỗi
  `WorkCard` đang có `assignee` khác null, tạo 1 dòng `WorkCardAssignee`
  tương ứng (giữ nguyên `email`, `userId` = `assigneeUserId` cũ).

## Thay đổi hành vi (server actions / lib)

- `canActOnCard`: `isBoardOwner(...) || card.assignees.some(a => a.userId === userId) || (teamId && userTeamIds.includes(teamId))`.
- `getAccessibleBoards`'s `cardGrant`: `assignees: { some: { userId } }` thay
  `assigneeUserId: userId`.
- `createWorkCard` / `updateWorkCard`: tham số `assignee: string` đơn →
  `assignees: string[]` (danh sách email). Validate tối đa — đề xuất 10
  người/thẻ (builder tự chọn số hợp lý, không cần hỏi lại). Chỉ chủ bảng
  được đổi danh sách người phụ trách (giữ nguyên nguyên tắc hiện tại).
- Tính điểm (`recordWorkCardScoreEvent`): lặp qua từng userId đã khớp tài
  khoản trong `toAssigneeIds` (bỏ qua email chưa có tài khoản — đúng hành vi
  hiện tại là chỉ tính điểm khi có tài khoản khớp), tính điểm đầy đủ
  (100%) riêng cho từng người, khoá chống trùng thêm userId.
- `syncOverdueDiscipline(userId, ...)`: đổi điều kiện quét thẻ từ
  `assigneeUserId: userId` sang `assignees: { some: { userId } }`.
- Thông báo (`notifyAssignee`): gửi cho **từng** người phụ trách đã khớp
  tài khoản (không chỉ 1 người).

## Thay đổi UI

- `AssigneePicker` → biến thể multi-select: hiển thị chip từng người đã
  thêm (avatar + tên/email, nút xoá), cộng ô nhập email + dropdown gợi ý
  thành viên y như hiện tại để thêm người mới.
- `card-modal.tsx`, `new-task-button.tsx`: dùng multi-select picker thay ô
  đơn.
- `work-list-view.tsx`: thêm cột **"Mô tả"** (rút gọn 1 dòng, giữa "Tiêu đề"
  và "Phụ trách", theo đúng thứ tự ảnh mẫu: Tiêu đề → Mô tả → Phụ trách →
  Loại → Thời gian → Mức độ). Cột "Phụ trách" đổi từ 1 avatar sang avatar
  xếp chồng (tối đa hiển thị ~3, dư thì "+N").
- `kanban-board.tsx` (`CardBody`): thêm dòng mô tả rút gọn dưới tiêu đề;
  avatar xếp chồng thay vì 1 avatar.

## Quyết định sau builder check

Một subagent độc lập đọc bản thiết kế này và đối chiếu với code thật, nêu
2 câu hỏi ảnh hưởng trực tiếp tới kết quả tính điểm — đã chốt với người
dùng:

1. **Mốc "được giao lúc nào" của 1 người (dùng cho bonus "hoàn thành cùng
   ngày được giao" và mốc bắt đầu tính trễ hạn):** tính từ **lúc người đó
   được thêm vào thẻ**, không phải từ lúc thẻ được tạo. Cụ thể: nếu không
   tìm thấy sự kiện `WorkCardEvent` nào (loại `CARD_CREATED`/
   `ASSIGNEE_CHANGED`) trước đó mà `toAssigneeIds` chứa userId này, lấy
   `occurredAt` của chính sự kiện đang xử lý (tức "được giao ngay bây giờ")
   làm `assignedAt` — **không** còn fallback về `card.createdAt` như logic
   đơn-người cũ.
2. **Không backfill** `WorkCardEvent.fromAssigneeUserId`/`toAssigneeUserId`
   cũ sang `fromAssigneeIds`/`toAssigneeIds` mới. Chấp nhận: sau khi
   migrate, lịch sử "được giao từ khi nào" của mọi thẻ đang có sẵn (kể cả
   thẻ đang có sẵn 1 người phụ trách) coi như reset — áp dụng đúng quy tắc
   fallback ở mục 1 (coi như "được giao ngay bây giờ") cho tới khi có sự
   kiện mới ghi nhận sau khi deploy. Đơn giản hoá migration, đổi lại người
   dùng chấp nhận đánh đổi này.

## Để lại cho người lập kế hoạch/triển khai (builder's call)

- Cú pháp Prisma chính xác để lọc "mảng JSON chứa userId X" khi tính
  `assignedAt` theo từng người (chi tiết triển khai, không ảnh hưởng thiết
  kế tổng thể).
- Số lượng người phụ trách tối đa cho phép mỗi thẻ (đề xuất 10).
- Độ dài tối đa của Mô tả (đề xuất 2000 ký tự) và số dòng hiển thị rút gọn
  ở List/Kanban (đề xuất 1 dòng, `truncate`/`line-clamp`).
- Khoá chống trùng điểm mới chính xác là gì (đề xuất:
  `workspaceScoreIdempotencyKey(cardId, code, localDate, userId)` nối thêm
  userId vào cuối chuỗi hiện tại).
- Các khoá i18n mới cần thêm vào `vi.ts`/`en.ts` (nhãn "Mô tả", placeholder,
  nhãn "+N", v.v.).
- Thứ tự các bước migrate trong 1 lần `db push` (thêm bảng mới + cột mới →
  chạy script backfill → xoá cột cũ) để không mất dữ liệu giữa chừng.

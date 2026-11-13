# Workspace — thêm lại Kanban (gộp bảng), đổi tên List, badge trạng thái màu, kéo đổi thứ tự, bỏ Loại

## Vì sao

Sau khi gộp bảng (bỏ Kanban khỏi switcher), người dùng muốn có lại Kanban
(trước List trong thanh chuyển), đổi nhãn "List" → "Danh sách", style lại
tiêu đề nhóm trạng thái giống ảnh mẫu (badge màu + icon), thêm kéo-thả đổi
thứ tự thẻ trong List/Kanban và đổi thứ tự mục trong Subtask, và bỏ hẳn
trường "Loại" khỏi panel chi tiết thẻ.

**Đã thống nhất với user:**
- Kanban cũng gộp tất cả bảng (giống List/Lịch) — không quay lại 1 bảng.
- Kéo đổi thứ tự = đổi thứ tự thật, lưu lại (không phải trang trí).
- Khi kéo đổi thứ tự giữa 2 thẻ khác bảng trong cùng nhóm trạng thái đã
  gộp: đánh số lại thứ tự cho **toàn bộ** thẻ trong nhóm đó theo đúng vị
  trí mới trên màn hình (không giới hạn trong 1 bảng).
- Bỏ hẳn trường "Loại" khỏi panel — chấp nhận không sửa được Nhãn sau khi
  tạo thẻ (vẫn đặt được lúc tạo mới qua "+ Thêm việc").

## Phạm vi

### 1. Kanban quay lại, gộp bảng giống List/Lịch

`KanbanBoard` đổi theo đúng pattern đã dùng cho `WorkListView`/
`WorkCalendarView`:
- Nhận `boardListsByBoardId`/`canManageByBoardId` thay cho `canManage` đơn.
- Mở `CardModal` dùng `listId`/`lists`/`doneListId`/`reviewListId` tra theo
  `card.boardId` (y hệt List/Lịch đã sửa).
- Kéo-thả đổi cột: `overListId` hiện đang là id ảo (= tên trạng thái, vì
  `page.tsx` đặt `id: list.name` cho mỗi nhóm gộp) — khi thả, tính
  `targetListId = boardListsByBoardId[card.boardId]?.find(l => l.name === overListId)?.id`
  rồi mới gọi `moveWorkCard(card.id, targetListId)` (thay vì gọi thẳng
  `overListId` như code cũ, vốn chỉ đúng khi 1 bảng).
- Khoá kéo vào "Hoàn thành" (`!canManage`), `showApprove`, `locked` dùng
  `canManageByBoardId[card.boardId] ?? false` thay cho `canManage` chung.
- **Bỏ nút "+Thêm thẻ" trên từng cột** (`AddCardButton` tại mỗi cột) — mỗi
  cột gộp giờ chứa thẻ từ nhiều bảng, không có "1 bảng" để thêm thẻ vào;
  tạo thẻ mới dùng chung nút "+ Thêm việc" ở đầu trang (đã có từ trước).
  `add-card-button.tsx` giữ nguyên file, chỉ không còn được gọi từ Kanban.

### 2. Thanh chuyển view

`view-switcher.tsx`: `WorkView` thêm lại `"kanban"`, thứ tự hiển thị
**Kanban → Danh sách → Lịch**. Nhãn "List" đổi thành key mới
`viewList: "Danh sách"` (vi) / giữ `"List"` (en). `parseWorkView` mặc định
vẫn là `"list"` (không đổi mặc định, chỉ thêm `"kanban"` vào tập hợp lệ).

### 3. Badge trạng thái màu + icon (List + Kanban)

Thêm vào `kanban-board.tsx` (cạnh `PRIORITY_BADGE_CLASS`):
```ts
export const STATUS_BADGE_CLASS: Record<string, string> = {
  muted: "bg-muted/15 text-ink-2",
  mist: "bg-mist/15 text-mist-ink",
  ochre: "bg-ochre/15 text-ochre-ink",
  jade: "bg-jade/15 text-jade-ink",
  danger: "bg-danger/15 text-danger",
};
export const STATUS_ICON: Record<string, LucideIcon> = {
  listToDo: Circle,
  listInProgress: Clock,
  listReview: Eye,
  listDone: CheckCircle2,
  listOverdue: AlertCircle,
};
```
Thay tiêu đề nhóm (hiện: chấm tròn nhỏ + chữ) bằng badge có nền màu
(`STATUS_BADGE_CLASS[list.color]`) + icon (`STATUS_ICON[list.name]`) + chữ,
dùng ở cả `work-list-view.tsx` (tiêu đề nhóm) và `kanban-board.tsx` (tiêu
đề cột) — 1 kiểu style dùng chung cho cả 2 nơi.

### 4. Kéo đổi thứ tự thẻ trong 1 nhóm trạng thái (tính năng mới)

**Schema**: không đổi — dùng lại `WorkCard.sortOrder` (`Int`) có sẵn, chỉ
đổi ý nghĩa: trong ngữ cảnh đã gộp, giá trị này so sánh được **giữa các
bảng** trong cùng 1 nhóm trạng thái (trước đây chỉ so sánh trong 1 bảng).

**Action mới** (`src/actions/work.ts`):
```ts
export async function reorderWorkCards(cardIds: string[])
```
- Validate `cardIds` là mảng không rỗng, tối đa 200 phần tử (chặn lạm
  dụng), mỗi id là string không rỗng.
- Với mỗi id: load thẻ (kèm `list.board`), áp đúng `canActOnCard` đã có —
  **nếu bất kỳ thẻ nào không có quyền thao tác, từ chối toàn bộ** (không
  ghi một phần).
- Trong 1 transaction: ghi `sortOrder = index` cho từng thẻ theo đúng thứ
  tự trong `cardIds`.
- `revalidatePath("/workspace")`.

**Pure helper** (`src/lib/work-view.ts`): `poolListsByName` sắp xếp lại
`cards` của mỗi nhóm theo `sortOrder` tăng dần sau khi gộp (constraint
kiểu `TCard extends { sortOrder: number }`) — để thứ tự hiển thị phản ánh
đúng lần kéo-thả gần nhất, bất kể card đến từ bảng nào.

**`SerializedCard`** thêm `sortOrder: number`. `page.tsx` thêm
`sortOrder: card.sortOrder` vào mỗi thẻ khi map.

**UI**: thêm icon kéo (`GripVertical`, lucide-react) đầu mỗi dòng trong
`work-list-view.tsx` và đầu mỗi thẻ trong `kanban-board.tsx`. Kéo-thả
trong cùng 1 nhóm (không đổi cột/trạng thái) → khi thả, tính mảng id mới
theo vị trí kéo, gọi `reorderWorkCards(newOrderIds)`. Kéo-thả **khác**
cột/nhóm vẫn là hành vi cũ (`moveWorkCard`, chỉ áp dụng cho Kanban — List
view không có kéo-đổi-cột, chỉ đổi-thứ-tự-trong-cột).

### 5. Kéo đổi thứ tự Subtask (Việc cần làm)

Không cần schema/action mới — `checklist` đã là mảng JSON lưu theo đúng
thứ tự phần tử, ghi qua `updateWorkCardChecklist(id, checklist)` có sẵn.
Thêm icon kéo (`GripVertical`) đầu mỗi dòng trong `card-modal.tsx`'s mục
"Việc cần làm"; khi thả, `persistChecklist(mảng đã đổi thứ tự)`.

### 6. Bỏ trường "Loại"

`card-modal.tsx`: xoá hẳn field "Loại" (select... không, field này là
input text gắn với `label`/`setLabel`) khỏi panel — bỏ cả ô nhập, cả logic
`setLabel` trong panel. `label` vẫn được đọc/hiển thị (badge cạnh tiêu đề
ở Kanban/List) và vẫn đặt được lúc tạo mới qua `NewTaskButton`/
`AddCardButton`, chỉ không sửa lại được sau khi tạo. Hàng Cột/Type/Priority
(hiện `sm:grid-cols-3`) co lại còn Cột + Priority (`sm:grid-cols-2`).

## Không làm

- Không thêm kéo-đổi-thứ-tự giữa các cột khác nhau trong List view (List
  không có khái niệm kéo đổi cột, chỉ Kanban mới có — giữ nguyên).
- Không đổi điểm kỷ luật/`WorkCardEvent`/phân quyền — `reorderWorkCards`
  chỉ đổi `sortOrder`, không tạo sự kiện chấm điểm mới.
- Không thêm board picker lại cho Kanban — Kanban gộp y hệt List/Lịch,
  tạo thẻ mới vẫn qua "+ Thêm việc" chung.

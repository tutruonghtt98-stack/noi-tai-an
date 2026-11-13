# Workspace — gộp bảng, bỏ Kanban khỏi switcher, Priority, giao diện List mới

## Vì sao

Người dùng muốn trang Workspace không còn hiện thanh tab chọn bảng (bóng/Nam An/
ra mắt sản phẩm/a/đá), không còn mục Kanban trong thanh chuyển view, và thay
view "Bảng" (spreadsheet đơn giản) bằng view "List" trình bày giống ảnh mẫu
(Task.Co): nhóm theo trạng thái, mỗi nhóm thu gọn được, có cột Priority.

**Đã thống nhất tách phần multi-assignee cấp quyền/điểm (Giai đoạn B / (4))
ra một đợt brainstorm riêng sau** — không nằm trong tài liệu này. Việc gắn
người phụ trách trong đợt này **giữ nguyên y hệt hiện tại** (1 người chính,
qua `AssigneePicker`, không đổi `assigneeUserId`/phân quyền/điểm kỷ luật).

## Phạm vi đợt này — 3 việc

1. **Gộp bảng**: trang Workspace không còn khái niệm "bảng đang chọn". Mọi
   view (Kanban, List, Lịch) hiển thị thẻ gộp từ **tất cả bảng user có quyền
   xem** (y hệt tập hợp `getAccessibleBoards` đang trả về), nhóm theo **tên
   cột chuẩn** (`listToDo`/`listInProgress`/`listReview`/`listDone`/
   `listOverdue` — 5 tên này giống nhau ở mọi bảng, theo `DEFAULT_LISTS`).
   Không đổi schema (`WorkBoard`/`WorkList` giữ nguyên) — đây là thay đổi ở
   tầng truy vấn/hiển thị, không phải xoá/gộp dữ liệu.
2. **Bỏ Kanban khỏi thanh chuyển view**: `ViewSwitcher` chỉ còn "List" và
   "Lịch" (bỏ nút "Kanban"). Component `KanbanBoard` (kéo-thả) vẫn giữ
   nguyên trong code — không xoá, chỉ không còn đường dẫn nào trỏ tới nó từ
   UI mặc định, để dễ khôi phục nếu cần, và để không phải sửa lại toàn bộ
   logic kéo-thả đang hoạt động đúng.
3. **Priority mới**: thêm `WorkCard.priority` (enum cố định 3 mức: Thấp/
   Bình thường/Khẩn cấp, mặc định Bình thường), hiển thị trong panel chi
   tiết thẻ (badge màu) và là một cột trong view List mới.
4. **View List mới** thay cho view "Bảng" cũ (component `work-table-view.tsx`
   bị thay thế hoàn toàn bởi `work-list-view.tsx` mới): nhóm theo 5 cột
   chuẩn, mỗi nhóm có tiêu đề màu + số đếm + mũi tên thu gọn/mở rộng (mặc
   định mở), bên trong là bảng con với các cột: Tên việc (+ nhãn Type),
   Người phụ trách (avatar), Type (nhãn), Thời gian (Bắt đầu – Hạn chót),
   Priority (badge màu). Click 1 dòng mở đúng `CardModal` (panel bên phải)
   như Table cũ đang làm.

### 0. Nút "+ Thêm việc" đầu trang (mới — giải quyết lỗ hổng tạo thẻ)

`AddCardButton` hiện tại chỉ gắn với đúng 1 `listId` thật (dùng trong từng
cột Kanban). Bỏ Kanban khỏi thanh chuyển mà không thêm gì thì **không còn
cách nào tạo thẻ mới** từ giao diện mặc định — đã xác nhận với user, giải
quyết bằng 1 nút mới `NewTaskButton` đặt cạnh tiêu đề "Workspace" (giống vị
trí "+ Add Task" trong ảnh mẫu):

- Props: `boards: { id: string; name: string; lists: { id: string; name: string }[] }[]`
  (lấy từ `getAccessibleBoards`, chỉ cần id/name/lists — không cần field
  khác), `teams`, `members`.
- Form: Tiêu đề, Trạng thái (`<select>` 5 option từ `DEFAULT_LISTS`, mặc
  định `listToDo`), và **chỉ khi `boards.length > 1`** thêm 1 `<select>`
  chọn bảng (mặc định `boards[0]`) — khi chỉ có 1 bảng thì ẩn hẳn ô này,
  dùng thẳng bảng đó. Các field còn lại (Nhãn/Người phụ trách/Team/Hạn
  chót) giữ y hệt `AddCardButton` hiện có.
- Submit: tìm `listId` thật = `boards.find(b => b.id === boardId)!.lists.find(l => l.name === status)!.id`,
  gọi `createWorkCard(listId, {...})` (action có sẵn, không đổi).

### 0.1. `canManage` theo từng thẻ, không còn là 1 cờ chung

Hiện `canManage`/`canDelete` là 1 boolean duy nhất (vì chỉ có 1 bảng đang
xem). Khi gộp nhiều bảng, mỗi thẻ có thể thuộc bảng mà user là chủ hoặc chỉ
là người/team được cấp quyền — quyền thao tác khác nhau theo từng thẻ.
Giải quyết cùng cách với `boardListsByBoardId` (mục 2): `page.tsx` tính
thêm `canManageByBoardId: Record<string, boolean>` (từ `board.access ===
"owner"` của từng board), truyền xuống `WorkListView`/`WorkCalendarView`;
khi mở `CardModal` dùng `canDelete={canManageByBoardId[row.card.boardId]
?? false}` thay vì 1 prop `canManage` chung. Component con (`WorkListView`/
`WorkCalendarView`) không còn nhận `canManage` làm prop top-level nữa —
nhận `canManageByBoardId` thay thế.

## Không làm trong đợt này (để builder không tự thêm)

- Không thêm cột "Descriptions" (mô tả riêng cho thẻ) — site hiện không có
  trường mô tả cho `WorkCard` (chỉ có `label`/`checklist`), thêm trường này
  không nằm trong yêu cầu, không tự bổ sung.
- Không thêm checkbox "đánh dấu xong" trực tiếp trên dòng List — việc
  hoàn thành thẻ đi qua quy trình duyệt (Xem lại → chủ bảng duyệt) đã có,
  không tạo đường tắt mới bỏ qua quy trình đó.
- Không thêm kéo-thả/sắp xếp lại thứ tự trong List view.
- Không đổi `assigneeUserId`, phân quyền, điểm kỷ luật, `WorkCardEvent`,
  `AssigneePicker` (vẫn chọn 1 người qua email) — y hệt hiện tại.
- Không xoá khả năng tạo bảng mới (`NewBoardButton` vẫn giữ, chỉ chuyển vị
  trí vì không còn hàng tab bảng để đặt cạnh) — bảng vẫn là đơn vị cấp
  quyền ở hậu trường (vd. cấp quyền theo team cho cả một lô thẻ), chỉ không
  còn hiển thị tên ra UI.
- Không xoá `work-table-view.tsx`'s logic tái dùng (`flattenCards`,
  `sortRows`, `DOT`, `dueLabel`) — `work-list-view.tsx` mới dùng lại đúng
  các hàm này từ `@/lib/work-view` và `kanban-board.tsx`.

## Thiết kế

### 1. Gộp bảng — tầng truy vấn (`src/lib/work-queries.ts`)

Thêm hàm mới `getPooledLists(userId)`: gọi lại đúng `getAccessibleBoards`
(không đổi hàm đó), rồi với mỗi tên trong `DEFAULT_LISTS`, gộp `cards` của
list cùng tên từ mọi board thành 1 `SerializedList` ảo (giữ `color` từ
`DEFAULT_LISTS`). Trả về đúng kiểu `WorkList & { cards: WorkCard[] }[]` để
`page.tsx` map sang `SerializedList[]` như đang làm với `active.lists`.

```ts
export async function getPooledLists(userId: string) {
  const boards = await getAccessibleBoards(userId);
  return DEFAULT_LISTS.map(({ name, color }) => ({
    id: name, // id ảo — không phải id DB thật, chỉ dùng làm key React + value cho <select> cột trong CardModal
    name,
    color,
    cards: boards.flatMap((b) => b.lists.find((l) => l.name === name)?.cards ?? []),
  }));
}
```

### 2. `page.tsx` — bỏ thanh tab bảng, bỏ header 1-bảng

- Xoá import/dùng `BoardSwitcher`, `BoardHeaderCard`, `inProgressCount`,
  `overdueCount`, `totalCards` (không còn "bảng đang chọn" để tính tiến độ
  riêng).
- `const lists = await getPooledLists(user.id)` thay cho
  `active.lists.map(...)`. Map sang `SerializedList[]` y hệt cách đang làm
  (title/label/assignee/teamId/dueDate/startDate/checklist/priority).
- Giữ `NewBoardButton` (đặt cạnh tiêu đề "Workspace", thay cho vị trí cũ
  cạnh `BoardSwitcher`).
- `!lists.some(l => l.cards.length)` (không còn thẻ nào ở bất kỳ cột nào)
  → vẫn hiện `<Empty>` như nhánh `!active` cũ, nhưng kèm `NewBoardButton`.
- `ViewSwitcher` bớt nút Kanban (xem mục 3). Bỏ nhánh `view === "kanban"`
  trong khối render điều kiện — `view` giờ chỉ còn `"list" | "calendar"`.
- **Vấn đề cốt lõi cần giải quyết**: `CardModal`'s dropdown "Cột" cần id
  DB **thật** của `WorkList` (để `updateWorkCard` ghi đúng), nhưng nhóm ảo
  (`getPooledLists`) dùng id ảo (`"listToDo"` v.v.) làm key hiển thị — 2
  loại id khác nhau, và mỗi thẻ thuộc một board khác nhau nên "Cột" hợp lệ
  của nó cũng khác nhau (5 `WorkList` thật của board đó, không phải của
  board khác). Giải quyết bằng cách mang theo thông tin thật cho từng thẻ:
  - `SerializedCard` thêm 2 field mới: `listId: string` (id `WorkList` DB
    thật — khác với id ảo dùng làm key nhóm) và `boardId: string`.
  - `page.tsx` tính thêm `boardListsByBoardId: Record<string, {id:string;name:string}[]>`
    — với mỗi board trong `boards` (từ `getAccessibleBoards`, đã fetch sẵn),
    map `board.lists` thành `{id, name}[]` thật của board đó.
  - Truyền `boardListsByBoardId` xuống `WorkListView`/`WorkCalendarView`
    (prop mới). Khi 1 trong 2 view này mở `CardModal`, dùng
    `listId={row.card.listId}` (thật) và
    `lists={boardListsByBoardId[row.card.boardId] ?? []}` (đúng 5 cột thật
    của board chứa thẻ đó) — thay vì mảng `lists` gộp dùng cho nhóm hiển thị.
  - `KanbanBoard` không đổi (không còn được dùng trong UI mặc định, xem mục
    3, nhưng code giữ nguyên để không phải sửa).
  - **Hệ quả cần sửa cùng lúc**: `CardModal`'s `reviewListId`/`doneListId`
    props (dùng để tính `locked`/`showApprove` bằng cách so với `column`
    state — vốn khởi tạo từ `listId` prop) **cũng phải là id thật** của
    board chứa thẻ đó, không phải id ảo của nhóm pooled. Tính từ
    `boardListsByBoardId[row.card.boardId]`:
    `.find(l => l.name === "listDone")?.id` /
    `.find(l => l.name === "listReview")?.id` — thay cho cách
    `WorkTableView`/`WorkCalendarView` hiện tính 2 giá trị này từ `lists`
    (mảng pooled) như bây giờ.

### 3. `WorkView`/`ViewSwitcher` — bỏ Kanban

- `src/lib/work-view.ts`: `WorkView` còn `"list" | "calendar"`
  (`parseWorkView` mặc định về `"list"` thay vì `"kanban"` khi thiếu/sai).
- `view-switcher.tsx`: bỏ mục `kanban` khỏi mảng `views`.

### 4. Priority — schema + action

```prisma
enum WorkCardPriority {
  LOW
  NORMAL
  URGENT
}
```
Thêm `priority WorkCardPriority @default(NORMAL)` vào `WorkCard`.
`cardSchema` thêm `priority: z.enum(["LOW", "NORMAL", "URGENT"]).default("NORMAL")`.
`createWorkCard`/`updateWorkCard` lưu trực tiếp (không cần convert như
ngày/giờ). `SerializedCard` thêm `priority: "LOW" | "NORMAL" | "URGENT"`.

### 5. `work-list-view.tsx` (mới, client) — thay cho `work-table-view.tsx`

- Nhóm `lists` (đã gộp) theo thứ tự `DEFAULT_LISTS`, mỗi nhóm:
  - Header: chấm màu (`DOT`) + tên cột (`w[list.name]`) + số đếm + nút thu
    gọn/mở rộng (state `collapsed: Record<string, boolean>`, mặc định mở).
  - Bảng con (ẩn khi thu gọn): cột Tên việc (nhãn + title), Người phụ trách
    (Avatar), Type (nhãn — dùng lại field `label`), Thời gian
    (`startDate`–`dueDate`, tái dùng `dueLabel`), Priority (badge màu: Thấp
    = jade nhạt, Bình thường = ochre nhạt, Khẩn cấp = danger nhạt).
  - Click 1 dòng → mở `CardModal` (y hệt cơ chế `openId` của
    `WorkTableView` cũ).
- `src/app/(app)/workspace/work-table-view.tsx` bị xoá hẳn khỏi thư mục
  (thay vì giữ song song) — không còn view nào trỏ tới nó.

### 6. `card-modal.tsx` — thêm Priority vào panel chi tiết

Thêm 1 `<select>` Priority (3 option cố định) cạnh field Type (Loại), cùng
hàng `grid sm:grid-cols-2` như Cột/Type hiện có. State `priority`, gửi vào
`updateWorkCard` payload.

## Việc để builder tự quyết

- Tên biến/kiểu TypeScript cụ thể cho `boardListsByBoardId`, cách chia nhỏ
  `work-list-view.tsx` nếu quá dài.
  - Cách hiển thị Priority không có — mặc định hiện badge "Bình thường"
  (không để trống) vì field có `@default(NORMAL)`, mọi thẻ cũ sau khi
  `db push` tự nhận giá trị này.

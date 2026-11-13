# Workspace card detail — right-side panel + missing fields (Phase A)

## Vì sao

Người dùng muốn chi tiết thẻ (hiện là popup giữa dùng `<Modal>` dùng chung) chuyển
sang panel trượt từ bên phải, và bổ sung các mục còn thiếu so với ảnh mẫu
(Task.Co/AppFlowy-style): People, Timeline, Type, Attachments, Subtask có mô tả.

**Đã thống nhất tách 2 giai đoạn** (vì multi-assignee thật sự chạm vào phân
quyền/điểm kỷ luật/audit — rủi ro cao, cần thiết kế riêng):

- **Giai đoạn A (tài liệu này):** panel bên phải + Timeline + Type + Subtask có
  mô tả + Attachments dạng link + giữ nguyên Comments/People hiện có.
- **Giai đoạn B (sau, brainstorm riêng):** multi-assignee cấp quyền + điểm kỷ
  luật + audit log đầy đủ cho nhiều người/thẻ.

## Mục tiêu giai đoạn A

1. Đổi `CardModal` từ popup giữa sang panel trượt bên phải (giữ nguyên mọi
   hành vi lưu/xoá/duyệt/khoá thẻ hiện có).
2. Thêm **Timeline**: ngày bắt đầu (`startDate`, mới) cạnh hạn chót (`dueDate`,
   đã có).
3. **Type**: dùng lại trường Nhãn (`label`) hiện có, chỉ đổi cách hiển thị
   trong panel mới cho giống ảnh mẫu (không thêm trường/schema mới).
4. **Subtask có mô tả**: mỗi mục trong checklist có thêm 1 dòng mô tả tuỳ chọn.
5. **Attachments**: đính kèm bằng link (không upload file thật — đã thống nhất
   với user vì site chưa có hạ tầng lưu file). Giới hạn tối đa **10 link/thẻ**.
6. **People/Comments**: giữ nguyên như hiện tại (1 người phụ trách chính +
   team, bình luận dạng danh sách phẳng) — chỉ đổi cách trình bày cho khớp
   layout panel mới.

## Không làm trong giai đoạn này

- Không đổi `assigneeUserId`/phân quyền/điểm kỷ luật/audit (`WorkCardEvent`) —
  để nguyên 100%, dành cho Giai đoạn B.
- Không upload file thật (không cần hạ tầng lưu trữ mới).
- Không threading/like cho bình luận.
- Không đổi component `Modal` dùng chung (`src/components/ui/modal.tsx`) —
  vẫn được nhiều nơi khác trong site dùng nguyên trạng.
- Không đổi `kanban-board.tsx`/`work-table-view.tsx`/`work-calendar-view.tsx`
  phần xem trước thẻ (CardBody/dòng bảng/ô lịch) — `startDate` chỉ hiển thị
  bên trong panel chi tiết, không cần hiện ở các khung xem trước.

## Thiết kế

### 1. Panel bên phải (thay `<Modal>` trong `card-modal.tsx`)

`CardModal` không còn bọc nội dung trong `<Modal>` dùng chung nữa. Thay vào đó
tự dựng một `<dialog>` riêng (sao chép đúng cơ chế `showModal()`/`close()` của
`Modal.tsx` để giữ hành vi focus-trap/Escape/backdrop có sẵn của trình duyệt —
không viết lại tay), nhưng với class CSS mới `.side-panel` định vị bên phải,
cao full viewport, trượt vào bằng `transform: translateX()` + `transition`,
backdrop mờ qua `::backdrop`. Trên mobile: rộng 100%; desktop: rộng cố định
~28rem (448px). Nội dung bên trong cuộn dọc, phần nút Lưu/Xoá dính cố định ở
đáy panel (`position: sticky; bottom: 0`).

Class `.side-panel` thêm vào `globals.css`, không đụng `.modal`.

### 2. Schema (Prisma — chỉ thêm, không sửa/xoá cột cũ)

```prisma
model WorkCard {
  // ...giữ nguyên toàn bộ...
  startDate DateTime? // mới — ngày bắt đầu, hiển thị cùng dueDate trong "Timeline"
  attachments WorkCardAttachment[]
}

model WorkCardAttachment {
  id        String   @id @default(cuid())
  cardId    String
  url       String
  label     String?
  createdAt DateTime @default(now())

  card WorkCard @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@index([cardId])
}
```

### 3. Server actions (`src/actions/work.ts`)

- `cardSchema` (dùng bởi `updateWorkCard`): thêm field tuỳ chọn
  `startDate: z.string().trim().optional().transform(v => v || null)` — cùng
  kiểu xử lý với `dueDate` hiện có (datetime-local string → UTC qua
  `zonedDateTimeToUTC`, theo đúng pattern đang dùng cho `dueDate` trong hàm
  `updateWorkCard`).
- `checklistItemSchema`: thêm field tuỳ chọn
  `description: z.string().trim().max(300).optional().transform(v => v || undefined)`.
  Không đổi `ChecklistItem` type thành bắt buộc — item cũ không có
  `description` vẫn hợp lệ (JSON field vốn linh hoạt).
- 3 action mới, theo đúng pattern `listWorkCardComments`/`addWorkCardComment`
  đã có (lazy-load khi mở panel, không đưa vào payload `SerializedList` chính):
  - `listWorkCardAttachments(cardId)` → trả `{id, url, label}[]`.
  - `addWorkCardAttachment(cardId, {url, label?})` — validate `url` bằng
    `z.string().trim().url().max(2000)`, `label` tuỳ chọn `max(80)`. Chặn khi
    thẻ đã có ≥10 attachment (trả lỗi `ATTACHMENT_LIMIT`).
  - `deleteWorkCardAttachment(id)`.
  - Quyền: dùng lại đúng `canAccessCard` đã có (owner/assignee/team) — không
    thêm luật phân quyền mới.

### 4. `card-modal.tsx`

- `SerializedCard` thêm `startDate: string | null`.
- State mới: `startDate`, `attachments: {id,url,label}[]`, `newAttachmentUrl`,
  `newAttachmentLabel`.
- `useEffect` khi mở thẻ: thêm `setStartDate(...)` (cùng cách xử lý
  `utcToZonedDateTimeInput` như `dueDate`) và gọi
  `listWorkCardAttachments(card.id)` song song với `listWorkCardComments`.
- `saveInfo()`: thêm `startDate: startDate || undefined` vào payload gửi
  `updateWorkCard`.
- Bố cục lại nội dung panel theo thứ tự giống ảnh mẫu: Tiêu đề → hàng nhỏ
  (Cột + Type/Nhãn) → **People** (giữ `AssigneePicker` + chọn team, chỉ đổi
  tiêu đề mục) → **Timeline** (2 input datetime-local: Bắt đầu / Hạn chót,
  cùng hàng) → **Subtasks** (checklist hiện có, mỗi dòng thêm 1 ô text nhỏ
  "Mô tả (tuỳ chọn)" ngay dưới tiêu đề mục, lưu qua `persistChecklist` khi
  blur) → **Attachments** (danh sách link + nút mở tab mới + nút xoá; form
  thêm: input URL + input nhãn tuỳ chọn + nút "Thêm") → **Comments** (giữ
  nguyên) → nút Lưu/Xoá/Duyệt dính đáy panel.

### 5. i18n

Thêm các key tiếng Việt/Anh mới vào `work.workspace` trong `vi.ts`/`en.ts`:
`peopleTitle`, `timelineTitle`, `startDate`, `typeTitle` (nhãn hiển thị cho
mục Type, tái dùng field `label` nên không cần key riêng cho giá trị),
`subtaskDescriptionPh`, `attachmentsTitle`, `attachmentsEmpty`, `attachmentUrlPh`,
`attachmentLabelPh`, `attachmentAdd`, `attachmentAdded`, `attachmentDeleted`,
`attachmentLimitReached`.

## Việc còn lại để builder tự quyết

- Tên class CSS cụ thể ngoài `.side-panel`, cách chia nhỏ JSX nếu
  `card-modal.tsx` quá dài sau khi thêm các mục.
- Icon cụ thể cho từng mục (People/Timeline/Type/Attachments) — chọn từ
  `lucide-react` đã dùng trong file.
- Animation slide-in dùng CSS transition thường hay thêm `@starting-style`
  (CSS mới) — miễn mượt và không phá điện thoại.

# Thiết kế: Tách "Xác nhận thức dậy" thành tính năng riêng, theo ngày

## Bối cảnh & lý do

"Thử thách tuần" (`JourneyWeeklyChallenge`) là nội dung do admin soạn **khác
nhau cho từng tuần** (24 tuần: tuần 1 "Wake Up Challenge", tuần 2 "Digital
Detox", tuần 3 "Clean Environment"...). Nhưng code hiện tại gắn cứng cơ chế
"giờ cam kết thức dậy + chỉ xác nhận được trước/đúng giờ đó + khoá cả tuần
sau 1 lần bấm" vào nút tự xác nhận của **mọi** tuần — dù nội dung tuần đó
chẳng liên quan gì đến thức dậy. Vì "số tuần" được tính từ `currentDay`
(ngày thứ mấy của hành trình), một tài khoản bị kẹt ở ngày 1 nhiều ngày
liền (do chưa bao giờ hoàn thành ngày) sẽ mãi mãi thấy "tuần 1" — và nếu
tuần 1 từng bị bấm xác nhận 1 lần (kể cả do test), nút sẽ khoá vĩnh viễn,
gây hiểu lầm.

Tách hẳn 2 việc đang bị gộp nhầm:
1. **Xác nhận thức dậy đúng giờ** — nên là việc làm MỖI NGÀY, độc lập với
   nội dung thử thách tuần.
2. **Tự xác nhận hoàn thành thử thách tuần** — quay về đúng vai trò gốc:
   1 nút xác nhận đơn giản cho đúng nội dung tuần đó, không còn giờ giấc
   gì cả.

## Goals

1. Thêm 1 nút "Xác nhận đã thức dậy hôm nay" — bấm được MỖI NGÀY (không
   còn khoá cả tuần), chỉ bấm được trước hoặc đúng giờ cam kết của ngày
   đó, nằm độc lập, không gắn với thử thách tuần.
2. Xác nhận thức dậy đúng giờ hôm nay cũng được tính là "có hoạt động hôm
   nay" — dùng chung tín hiệu `hasJourneyActivityToday` với thói
   quen/việc Workspace (điều kiện bấm "Hoàn thành ngày"/chặn "Ngày nghỉ").
3. Bỏ hẳn phần giờ giấc khỏi `JourneyWeeklyChallengeActions` — nút tự xác
   nhận hoàn thành tuần quay về chỉ kiểm tra "đã xác nhận chưa", không còn
   kiểm tra giờ.
4. Ô chỉnh giờ thức dậy cam kết (đang nằm trong card Thử thách tuần)
   chuyển sang nằm cạnh nút xác nhận thức dậy mới — đúng chỗ của nó về
   mặt khái niệm.

## Non-goals

- Không đổi nội dung/cách admin soạn Thử thách tuần.
- Không đổi Thử thách ngày/tháng, Tổng kết chặng.
- Không backfill/sửa dữ liệu "đã xác nhận tuần 1" cũ đang có sẵn — sau khi
  bỏ khoá giờ, nút tuần sẽ tự hoạt động bình thường trở lại (đã xác nhận
  rồi thì vẫn hiện "Đã hoàn thành" cho đúng tuần đó, không có gì phải sửa
  dữ liệu).

## Approaches

Một cách làm duy nhất hợp lý (không phải nhiều lựa chọn):

- **Lưu trạng thái xác nhận thức dậy trên `JourneyDayRecord`** (1 dòng =
  1 ngày thật, đã có sẵn, mỗi ngày 1 dòng) — thêm cột `wakeConfirmedAt
  DateTime?`. Khớp tự nhiên với "mỗi ngày xác nhận 1 lần", không cần bảng
  mới.

## Constraints

- Cần 1 thay đổi schema Prisma nhỏ (`prisma db push`) — xin xác nhận
  trước khi chạy như quy ước đã có.
- Dùng lại đúng `hasJourneyActivityToday` (đã có từ trước) — chỉ thêm 1
  điều kiện OR, không đổi chữ ký hàm.
- Copy UI mới đi qua i18n, không hardcode chuỗi.

## Các quyết định cụ thể

1. **Schema**: `JourneyDayRecord.wakeConfirmedAt DateTime?`.
2. **Action mới `confirmWakeUpToday()`** (trong `src/actions/journey.ts`):
   `requireUser` → `getJourneyDashboard` → nếu không có `dayRecord` đang
   `IN_PROGRESS` → `JOURNEY_NOT_ACTIVE`; nếu `dayRecord.wakeConfirmedAt`
   đã có → trả `false` (idempotent); tính giờ hiện tại theo
   `journey.timezone`, so với `getCommittedWakeTime(...)` — nếu đã có giờ
   cam kết và hiện tại > giờ đó → throw mã lỗi mới `WAKE_UP_TOO_LATE`;
   ngược lại `update` `dayRecord.wakeConfirmedAt = new Date()`.
3. **`hasJourneyActivityToday`** (`journey-queries.ts`) thêm điều kiện OR
   thứ 3: `dashboard.dayRecord?.wakeConfirmedAt != null`.
4. **`JourneyWeeklyChallengeActions`**: bỏ hẳn toàn bộ phần giờ giấc
   (state `editingWakeTime`/`wakeTimeInput`, khối hiển thị/sửa giờ, biến
   `deadline`/`withinDeadline`, các dòng cảnh báo giờ) — nút tự xác nhận
   chỉ còn `disabled={weekly.completed || pending}`, bỏ 2 dòng cảnh báo
   giờ.
5. **Nút + ô giờ mới** — đặt trong `JourneyControls`, ngay chỗ hiện đang
   hiển thị "Giờ thức dậy cố định: {wakeTime}" (khối `{wakeTime && (...)}`
   ở đầu card "Công việc cần làm") — đổi thành 1 khối có: hiện giờ cam kết
   + nút sửa (tái dùng đúng UI chỉnh giờ vừa gỡ ra khỏi
   `JourneyWeeklyChallengeActions`) + nút "Xác nhận đã thức dậy hôm nay"
   (gọi `confirmWakeUpToday()`), đổi thành "Đã xác nhận hôm nay" (disabled)
   nếu `dayRecord.wakeConfirmedAt` đã có hôm nay. Nếu chưa đặt giờ cam kết,
   hiện nút "Đặt giờ thức dậy cam kết" như cũ.

## Để lại cho người triển khai

- Tên i18n key cụ thể cho các chuỗi mới.
- Có cảnh báo riêng khi bấm trễ giờ (`WAKE_UP_TOO_LATE`) hay dùng chung
  cách hiển thị lỗi hiện có (`use-action.ts`'s `message()` mapping).

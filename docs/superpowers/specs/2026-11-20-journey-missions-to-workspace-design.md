# Thiết kế: Bỏ Nhiệm vụ chính, dùng việc Workspace đến hạn thay thế

## Bối cảnh & lý do

Trang Hành trình 180 ngày hiện có "Nhiệm vụ chính" (`JourneyMission`) — nội dung
do admin soạn sẵn riêng cho từng ngày/cấp độ (540 mục, 180 ngày × 3 mục/ngày,
6 cấp độ). Nó xuất hiện ở ô "Công việc cần làm" (tab Ngày), và giữ 2 vai trò
kỹ thuật ngoài hiển thị:

1. Điều kiện bắt buộc để bấm "Hoàn thành ngày" (`completeJourneyDay`: phải
   tick ≥1 Nhiệm vụ chính, nếu không báo lỗi `MISSION_REQUIRED`).
2. Điều kiện bắt buộc để mở khoá cấp độ tiếp theo (`getJourneyLevelGate`:
   tỉ lệ hoàn thành Nhiệm vụ chính của cả chặng phải ≥ ngưỡng
   `completionThreshold`, mặc định 75%) và để gửi được "Tổng kết chặng"
   (`submitJourneyLevelReview`).

Người dùng phải quản lý song song 2 nơi: tick Nhiệm vụ chính ở Hành trình,
và làm việc thật ở Workspace. Muốn gộp lại: bỏ hẳn Nhiệm vụ chính khỏi luồng
dùng hằng ngày, thay bằng việc Workspace đến hạn hôm nay ngay trong ô đó, và
đổi cả 2 điều kiện trên sang dựa vào thói quen/việc Workspace thay vì
Nhiệm vụ chính.

## Goals

1. Ô "Công việc cần làm" (tab Ngày) hiển thị **việc Workspace đến hạn hôm
   nay** (dữ liệu `workspaceCards` app đã truy vấn sẵn cho tính điểm) thay
   vì 3 Nhiệm vụ chính, có dấu tích trước mỗi việc để hoàn thành nhanh —
   dùng lại đúng luật duyệt/hoàn thành đã có của Workspace (chủ bảng tích
   xong là xong; người được giao không sở hữu bảng thì tích xong chuyển
   sang "Xem lại" chờ duyệt).
2. Điều kiện bấm "Hoàn thành ngày": đổi từ "≥1 Nhiệm vụ chính" sang "**≥1
   thói quen cam kết HOẶC ≥1 việc Workspace đến hạn hôm nay đã hoàn
   thành**".
3. Điều kiện mở khoá cấp độ tiếp theo / gửi Tổng kết chặng: đổi từ "tỉ lệ
   hoàn thành Nhiệm vụ chính ≥ ngưỡng" sang "**tỉ lệ số ngày trong chặng
   được đánh dấu Hoàn thành (không tính Bỏ lỡ) ≥ ngưỡng**" — dùng lại đúng
   `completionThreshold` hiện có.
4. Bỏ khối "Nhiệm vụ còn thiếu trong chặng" (recovery missions) — gắn với
   Nhiệm vụ chính, không còn ý nghĩa khi Nhiệm vụ chính không còn hiển thị.
5. Điểm ngày: phần trọng số "Nhiệm vụ chính" (60%) không còn dữ liệu nên tự
   động không đóng góp — `calculateJourneyDailyScore` đã có sẵn cơ chế bỏ
   qua thành phần có mẫu số 0 và dồn trọng số cho các thành phần còn lại
   (Thói quen/Workspace) — không cần đổi gì ở hàm này.

## Non-goals

- Không xoá dữ liệu `JourneyMission`/`JourneyMissionCompletion` đã có (540
  mục) hay trang admin soạn nội dung — giữ nguyên, chỉ không còn được dùng
  trong luồng người dùng hằng ngày.
- Không đổi "Nhiệm vụ cá nhân" (`JourneyPersonalMission`, mục người dùng tự
  thêm) — đây là tính năng khác, độc lập với Nhiệm vụ chính do admin soạn,
  không nằm trong yêu cầu này.
- Không đổi Thử thách ngày/tuần/tháng (Daily/Weekly/Monthly Challenge) hay
  Tổng kết chặng (câu hỏi phản tư) — chỉ đổi đúng tiêu chí "mission" trong
  điều kiện mở khoá, không đổi luồng Tổng kết chặng nói chung.
- Không đổi quy tắc duyệt thẻ Workspace hiện có (chủ bảng mới được chuyển
  thẳng vào Hoàn thành) — dấu tích nhanh ở Hành trình phải tuân theo đúng
  quy tắc này, không bỏ qua bước duyệt.

## Anti-goals

- Không được để người dùng không bao giờ mở khoá được cấp độ tiếp theo sau
  khi đổi (lỗi đúng kiểu đang xảy ra với Nhiệm vụ chính hiện tại) — tiêu chí
  mới phải thực sự đạt được bằng hoạt động bình thường (hoàn thành ngày).
- Không được để việc tích nhanh 1 thẻ Workspace ở Hành trình cấp quyền vượt
  quá những gì người đó vốn đã được phép làm trên thẻ đó ở Workspace.

## Approaches

Đây là trường hợp có một cách làm hợp lý duy nhất khớp đúng ý đã chốt
(không phải nhiều phương án để chọn) — chi tiết nằm ở các quyết định nhỏ
dưới đây, đều là lựa chọn của tôi, không phải điều người dùng tự chọn:

- **Dấu tích nhanh gọi lại `moveWorkCard` đã có** (action trong
  `src/actions/work.ts`), qua 1 action bọc mới
  `completeJourneyWorkspaceCard(cardId)` tự tra xem người bấm có phải chủ
  bảng không rồi chọn đúng cột đích ("Hoàn thành" hoặc "Xem lại") — tái
  dùng toàn bộ logic phân quyền/tính điểm kỷ luật đã có, không viết lại.
- **Tiêu chí mở khoá cấp độ** chuyển từ đếm `JourneyMissionCompletion`
  sang đếm `JourneyDayRecord` có `status` là `COMPLETED` hoặc `REST`
  trong khoảng ngày của chặng (`level.startDay..level.endDay`) — ngày
  nghỉ hợp lệ không bị tính là "trượt", giống cách hệ thống đang đối xử
  với ngày nghỉ ở những chỗ khác.
- **Hàm thuần `getJourneyLevelGate`** đổi tên tham số từ
  `completedMissions`/`totalMissions`/`missionsPassed` sang tên chung hơn
  (`completedUnits`/`totalUnits`/`activityPassed`) vì khái niệm "tỉ lệ đạt
  ngưỡng" giờ dùng cho ngày-hoàn-thành chứ không phải mission — hàm vẫn
  thuần, vẫn test được bằng `tsx --test` như cũ.

## Constraints

- Không có thay đổi schema Prisma, không cần `prisma db push` — chỉ đổi
  logic đọc dữ liệu đã có sẵn (`JourneyDayRecord`, `WorkCard`).
- Giữ nguyên toàn bộ quy tắc phân quyền/duyệt thẻ hiện có của Workspace
  (`canActOnCard`, luật "chỉ chủ bảng chuyển thẳng vào Hoàn thành").
- Copy UI mới đi qua `src/lib/i18n/vi.ts`/`en.ts`, không hardcode chuỗi.

## Các quyết định cụ thể (để lại cho người lập kế hoạch dùng nguyên văn)

1. **`completeJourneyWorkspaceCard(cardId: string)`** (action mới, đặt
   trong `src/actions/journey.ts`, import `moveWorkCard` từ
   `@/actions/work`): tra `WorkCard` theo `cardId`, lấy `boardId` và
   `board.userId`; nếu `board.userId === user.id` (chủ bảng) → tìm
   `WorkList` tên `"listDone"` của đúng bảng đó làm đích; ngược lại → tìm
   `WorkList` tên `"listReview"`; gọi `moveWorkCard(cardId, targetListId)`
   (để `moveWorkCard` tự lo nốt phần kiểm tra quyền/tính điểm — action
   mới chỉ chọn đích, không tự ý ghi DB).
2. **`completeJourneyDay`**: thay điều kiện
   `completedMissions === 0 → throw MISSION_REQUIRED` bằng: đếm số thói
   quen cam kết hôm nay đã hoàn thành (`habits` trong dashboard,
   `doneHabits.length`) cộng số việc Workspace đến hạn hôm nay đã hoàn
   thành hôm nay (`workspaceDue` đã lọc `completedAt` không null, lọc
   thêm theo ngày hôm nay) — nếu tổng bằng 0 → throw mã lỗi mới
   `DAILY_ACTIVITY_REQUIRED` (thay `MISSION_REQUIRED`, xoá mã cũ).
3. **Mẫu số/tử số mở khoá cấp độ**: `totalUnits = level.endDay -
   level.startDay + 1`; `completedUnits = count(JourneyDayRecord where
   journeyId, journeyDay BETWEEN level.startDay..level.endDay, status IN
   (COMPLETED, REST))`. Áp dụng giống nhau ở cả 2 nơi gọi
   `getJourneyLevelGate` (trong `getJourneyDashboard`'s transition gate,
   và trong `submitJourneyLevelReview`).
4. **`getJourneyDashboard`**: bỏ hẳn 2 truy vấn `db.journeyMission.findMany`
   (missions của ngày, và recoveryMissions) khỏi `Promise.all` — không
   còn dùng. Bỏ `missionsDone`/`missionsDue` khỏi lời gọi
   `calculateJourneyDailyScore` (không truyền, để hàm tự redistribute).
   Trả về thêm field `workspaceTasks` (map gọn từ `workspaceCards`:
   `{id, title, dueDate, completedAt, listName, boardName}`) cho UI dùng
   trực tiếp, không cần map lại ở `page.tsx`.
5. **UI (`journey-controls.tsx`)**: đổi prop `missions`/`recoveryMissions`
   của `JourneyControls` thành 1 prop `workspaceTasks` — render đúng vị
   trí ô "Công việc cần làm" (tab Ngày) hiện tại, dấu tích gọi
   `completeJourneyWorkspaceCard(task.id)`; badge đếm đổi theo
   `workspaceTasks` (đã Hoàn thành / tổng số); việc đã hoàn thành hiện
   gạch ngang như Nhiệm vụ chính cũ. Bỏ hẳn `<section>` "Nhiệm vụ còn
   thiếu trong chặng". Xoá action `completeJourneyMission` (hết nơi gọi).
   Giữ nguyên "Nhiệm vụ cá nhân" và "Thói quen cam kết" — không đổi.
6. **`page.tsx`**: bỏ biến `missions`/`missionsDone` cũ; dùng thẳng
   `journey.workspaceTasks`. Sửa 2 dòng chú thích đang nhắc "mission"
   (ô Điểm kinh nghiệm: "từ mission & thử thách"; ô Điểm ngày: "mission,
   thói quen, Workspace") cho khớp nội dung mới (bỏ chữ "mission").

## Quyết định sau builder check

Một subagent độc lập đọc thiết kế này và đối chiếu với code thật, nêu 3 lỗ
hổng — đã xử lý:

1. **`setJourneyRestDay` sẽ mất tác dụng.** Guard chặn "đã làm việc rồi còn
   đòi ghi ngày nghỉ" (`REST_AFTER_PROGRESS`) hiện đếm
   `JourneyMissionCompletion` — khi bỏ Nhiệm vụ chính, số này luôn là 0,
   guard không còn chặn được gì, mở lỗ hổng "làm xong việc rồi vẫn ghi
   được ngày nghỉ". **Quyết định:** đổi guard này dùng chung đúng 1 tín
   hiệu "có hoạt động hôm nay" với mục 2 bên dưới (thói quen đã làm hôm
   nay, hoặc có sự kiện Workspace hôm nay) — có hoạt động thì chặn ghi
   nghỉ, giống hệt logic cũ, chỉ đổi nguồn đếm.
2. **Tín hiệu "đã hoàn thành việc Workspace hôm nay" không khớp với cách
   tích nhanh hoạt động.** `moveWorkCard` chỉ ghi `completedAt` khi thẻ
   vào thẳng "Hoàn thành" (chỉ chủ bảng làm được) — người được giao không
   sở hữu bảng tích xong thì thẻ sang "Xem lại", `completedAt` vẫn null,
   nên điều kiện "hoàn thành ngày"/"ghi ngày nghỉ" sẽ không bao giờ nhận
   ra hoạt động của người đó cùng ngày (phải chờ chủ bảng duyệt, có khi
   khác ngày, có khi không bao giờ). Phần hiển thị gạch ngang cũng không
   khớp: thẻ chủ bảng tích xong biến mất khỏi danh sách luôn (đã vào
   "Hoàn thành", bị lọc khỏi truy vấn `workspaceCards` sẵn có), còn thẻ
   người được giao tích thì vẫn còn trong danh sách (đang ở "Xem lại")
   chứ không có cờ "đã xong" nào để gạch ngang.
   **Quyết định:**
   - Tín hiệu "có hoạt động Workspace hôm nay" (dùng cho cả điều kiện
     "Hoàn thành ngày" và guard ngày nghỉ ở mục 1) đổi sang: có
     `WorkCardEvent` hôm nay mà `actorUserId` là người này và
     `toStatus` thuộc `("listReview", "listDone")` — tức "đã tích/gửi
     hôm nay" tính luôn, không chờ duyệt xong. Việc tích này vốn đã tự
     tạo `WorkCardEvent` sẵn qua `moveWorkCard`, không cần hạ tầng mới.
   - Phần **điểm ngày** (component "workspace" trong
     `calculateJourneyDailyScore`) **giữ nguyên** dùng `completedAt`
     như hiện tại — chỉ tín hiệu "được phép hoàn thành ngày" đổi, không
     đổi cách tính điểm.
   - Hiển thị: thẻ chủ bảng tích xong biến mất khỏi danh sách (đã vào
     Hoàn thành, đúng như Workspace vốn hoạt động). Thẻ người được giao
     tích xong **vẫn hiện trong danh sách** nhưng đổi dấu tích thành
     badge "Đang chờ duyệt" (không gạch ngang, vì hệ thống chưa coi là
     xong) thay vì biến mất.
3. **Trùng với mục "Việc được giao hôm nay" có sẵn.** `page.tsx` đang có
   1 khối riêng (ô bên, không có dấu tích) hiện đúng danh sách
   `workspaceCards` này rồi, link sang Workspace. Nếu giữ nguyên, trang sẽ
   hiện cùng 1 danh sách 2 lần sau khi đổi. **Quyết định:** bỏ khối "Việc
   được giao hôm nay" riêng đó — hợp lý vì mục tiêu gốc là "chỉ còn 1 chỗ
   quản lý", giữ cả 2 sẽ đi ngược lại đúng điều đang muốn sửa.

## Để lại cho người lập kế hoạch/triển khai (builder's call)

- Tên i18n key cụ thể cho chuỗi UI mới (nhãn ô, placeholder nếu có, thông
  báo lỗi `DAILY_ACTIVITY_REQUIRED`).
- Cách hiển thị `listName`/`boardName` của mỗi việc Workspace trong danh
  sách (có cần hiện tên bảng không, hay chỉ tiêu đề + hạn).
- Cấu trúc test mới cho `getJourneyLevelGate` sau khi đổi tên tham số
  (giữ 2 test hiện có, đổi tên field; thêm test cho trường hợp REST không
  bị tính là trượt nếu thấy cần).

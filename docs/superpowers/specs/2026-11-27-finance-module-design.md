# Thiết kế: Module quản lý tài chính cá nhân (thu nhập, chi tiêu, ngân sách)

## Nguồn

Artifact thiết kế trước khi code (4 sequence diagram), đã chốt với người
dùng: https://claude.ai/artifact/9bjtxshp2P82eihvJPKnbz

4 luồng:
1. Ghi nhận thu nhập phát sinh (nhập tay 1 lần, không duyệt, không kiểm
   tra ngân sách).
2. Thu nhập định kỳ — khai báo 1 lần, tự sinh giao dịch mỗi kỳ.
3. Ghi nhận chi tiêu + kiểm tra ngân sách tức thời (cảnh báo 80/90/100%).
4. Chi phí cố định — tự động trừ vào ngân sách tháng, tạo thông báo nếu
   vượt ngưỡng.

Artifact ghi chú rõ: luồng 03/04 "sẽ ghép vào đúng phần tài chính trong
Thử thách 180 ngày... sơ đồ này chưa vẽ điểm nối đó" — điểm nối với
`JourneyExpenseEntry` (ghi nhanh "chi tiêu hôm nay" đã có trong Thử thách
ngày) **chưa được thiết kế**, nên spec này dựng module tài chính như một
hệ thống độc lập, không migrate/thay thế `JourneyExpenseEntry`.

## Quyết định kiến trúc khác với artifact

Artifact vẽ "Cron hàng ngày (Vercel Cron)" cho luồng 02/04. Dự án này
**chưa có hạ tầng cron thật nào** (không `vercel.json`, không route
`/api/cron/*`) — quy ước hiện có cho "việc cần chạy định kỳ" là tính toán
bắt kịp (catch-up) ngay khi người dùng tải trang, xem
`syncOverdueDiscipline()` (`src/lib/journey-score-ledger.ts`), được gọi ở
đầu `journey/page.tsx`. Module tài chính dùng đúng mẫu này:
`runDueRecurringRules(userId, throughAt)` chạy ở đầu `finance/page.tsx`,
xử lý bắt kịp mọi kỳ bị bỏ lỡ (kể cả nhiều kỳ liên tiếp nếu người dùng
lâu không mở app) trong 1 vòng lặp, idempotent.

## Mô hình dữ liệu

Không có khái niệm "Tài khoản" (ví/ngân hàng) quản lý riêng trong artifact
— cả "tài khoản nhận" (luồng 01/02) và "phương thức thanh toán" (luồng
03/04) chỉ là 1 ô nhập tự do trên form. Quyết định: 1 field text tự do
`accountName` dùng chung cho cả thu/chi, không tạo model `Account` mới
(YAGNI — không có yêu cầu quản lý danh sách tài khoản).

Không có danh mục (category) cố định theo enum — artifact chỉ nêu ví dụ
("Ăn uống"). Quyết định: `category` là text tự do người dùng gõ khi tạo
giao dịch/ngân sách; ngân sách (`Budget`) khoá theo cặp
`(userId, category)`, không phân biệt hoa thường/khoảng trắng thừa (trim
trước khi so khớp).

```prisma
// Lưu ý: schema thật dùng dạng multi-line chuẩn của file (như mọi enum khác)
// — parser Prisma của dự án từ chối cú pháp 1 dòng dưới đây; tên/giá trị
// enum giữ nguyên, chỉ khác cách xuống dòng.
enum FinanceTransactionType { INCOME EXPENSE }
enum FinanceRecurringCycle { WEEKLY MONTHLY }

model FinanceTransaction {
  id              String                  @id @default(cuid())
  userId          String
  type            FinanceTransactionType
  amountVnd       Int
  category        String?                 // bắt buộc ở tầng action cho EXPENSE, tự do cho INCOME
  accountName     String?
  note            String?
  occurredAt      DateTime                @db.Date
  recurringRuleId String?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  recurringRule   FinanceRecurringRule?   @relation(fields: [recurringRuleId], references: [id], onDelete: SetNull)

  @@index([userId, type, occurredAt])
  @@index([userId, category, occurredAt])
}

model FinanceRecurringRule {
  id            String                  @id @default(cuid())
  userId        String
  type          FinanceTransactionType
  amountVnd     Int
  category      String?
  accountName   String?
  note          String?
  cycle         FinanceRecurringCycle   @default(MONTHLY)
  startDate     DateTime                @db.Date
  nextRunDate   DateTime                @db.Date
  active        Boolean                 @default(true)
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt
  user          User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions  FinanceTransaction[]

  @@index([userId, active, nextRunDate])
}

model FinanceBudget {
  id              String   @id @default(cuid())
  userId          String
  category        String
  monthlyLimitVnd Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, category])
}
```

`User` thêm 3 relation: `financeTransactions`, `financeRecurringRules`,
`financeBudgets`.

## Ngưỡng cảnh báo ngân sách

Hàm thuần `budgetWarningLevel(spentVnd: number, limitVnd: number):
"NONE" | "WARN_80" | "WARN_90" | "OVER_100"`:
- `limitVnd <= 0` → `"NONE"` (chưa đặt ngân sách thực sự).
- `spentVnd / limitVnd >= 1` → `"OVER_100"`.
- `>= 0.9` → `"WARN_90"`.
- `>= 0.8` → `"WARN_80"`.
- else → `"NONE"`.

Chưa có `FinanceBudget` cho category đó → không tính cảnh báo (coi như
`limitVnd = 0` → `"NONE"`), khớp luồng 03's `else`.

## Luồng 01 — Ghi nhận thu nhập phát sinh

`createFinanceTransaction({ type: "INCOME", amountVnd, category?,
accountName?, note?, occurredAt })` — validate `amountVnd` 1..1_000_000_000
(số nguyên), `occurredAt` hợp lệ; `INSERT FinanceTransaction`; không có
bước kiểm tra ngân sách. Trả `{ warning: "NONE" }` luôn cho INCOME (khớp
đúng kiểu `BudgetWarningLevel`, không phải `null`).

## Luồng 02 — Thu nhập định kỳ

`createFinanceRecurringRule({ type, amountVnd, category?, accountName?,
note?, cycle, startDate })` — `nextRunDate` khởi tạo = `startDate`.

`runDueRecurringRules(userId, throughAt = new Date())` (lib, DB-coupled,
gọi ở đầu `finance/page.tsx`, giống mẫu `syncOverdueDiscipline`):
- Lấy mọi rule `active = true` của user có `nextRunDate <= todayISO`.
- Với mỗi rule, lặp: `INSERT FinanceTransaction` (occurredAt =
  `rule.nextRunDate`, `recurringRuleId = rule.id`), nếu `type === EXPENSE`
  tính `budgetWarningLevel` cho category đó trong tháng chứa
  `rule.nextRunDate` — nếu khác `"NONE"` thì `INSERT Notification` (xem
  luồng 04); sau đó `rule.nextRunDate = nextRunDateFor(rule.cycle,
  rule.nextRunDate)`; lặp tới khi `nextRunDate > todayISO`.
- `UPDATE` 1 lần `nextRunDate` cuối cùng của rule đó.
- Trả về số giao dịch đã tự sinh (để test đếm được, giống
  `syncOverdueDiscipline` trả số dòng).

`nextRunDateFor(cycle, from: ISODate): ISODate` (pure, `src/lib/finance.ts`):
`WEEKLY` → `addDays(from, 7)`; `MONTHLY` → `addMonths(from, 1)` (hàm mới,
xem bên dưới).

## Luồng 03 — Ghi nhận chi tiêu + kiểm tra ngân sách tức thời

`createFinanceTransaction({ type: "EXPENSE", amountVnd, category
(bắt buộc), accountName?, note?, occurredAt })`:
1. Validate, `INSERT FinanceTransaction`.
2. `SUM(amountVnd)` mọi `EXPENSE` của user trong cùng category, cùng
   tháng (theo `occurredAt`, dùng `monthBounds` đã có).
3. Tra `FinanceBudget` của `(userId, category)`; tính
   `budgetWarningLevel(spent, limit ?? 0)`.
4. Trả `{ warning: BudgetWarningLevel }` cho client hiện toast tương ứng
   (không tạo `Notification` ở nhánh này — người dùng đang thao tác trực
   tiếp, thấy ngay kết quả, khác luồng 04 nơi không ai đang xem màn
   hình).

## Luồng 04 — Chi phí cố định tự động

Dùng chung `runDueRecurringRules` ở luồng 02. Khi
`budgetWarningLevel != "NONE"` cho 1 giao dịch `EXPENSE` tự sinh:
`db.notification.create({ data: { userId, actorId: null, type:
"FINANCE_BUDGET_WARNING", title, body, href: "/finance" } })` — theo đúng
mẫu đang dùng ở `src/actions/work.ts`/`departments.ts` (actor `null` =
hệ thống).

## Quản lý ngân sách (không có trong artifact nhưng artifact giả định tồn
tại — "hạn mức danh mục")

`upsertFinanceBudget({ category, monthlyLimitVnd })` — tạo/sửa hạn mức 1
danh mục (`@@unique([userId, category])` nên dùng `db.financeBudget.upsert`).

## Trang `/finance`

Route mới `src/app/(app)/finance/page.tsx` (server component) +
`finance-controls.tsx` ("use client", theo đúng mẫu `journey-controls.tsx`/
`work-list-view.tsx`):
- Gọi `runDueRecurringRules(user.id)` rồi `getFinanceDashboard(user.id)`
  (lib, DB-coupled) đầu trang, giống `journey/page.tsx` gọi
  `syncOverdueDiscipline`.
- 3 thẻ tổng quan: tổng thu tháng này, tổng chi tháng này, số dư tháng
  này (thu trừ chi).
- Danh sách ngân sách theo danh mục: tên danh mục, đã chi/hạn mức, thanh
  tiến trình màu theo `budgetWarningLevel` (tái dùng `ProgressBar`,
  `@/components/ui/progress-ring`).
- 2 form nhanh: "Thêm khoản thu" / "Thêm khoản chi" (số tiền, danh mục,
  tài khoản, ngày, ghi chú) — form chi hiện toast cảnh báo theo
  `warning` trả về.
- Danh sách giao dịch định kỳ: liệt kê rule đang `active`, nút tạm dừng/
  tiếp tục (`toggleFinanceRecurringRule`), nút xoá
  (`deleteFinanceRecurringRule`), form thêm rule mới.
- Danh sách giao dịch gần đây (gộp thu + chi, sắp xếp `occurredAt` giảm
  dần, giới hạn hợp lý ví dụ 20 dòng gần nhất — không cần phân trang ở
  v1, YAGNI).

Thêm mục nav "Tài chính" (`/finance`) vào `NAV` (`src/components/nav.tsx`)
+ key i18n `nav.finance`.

## Nối với Hành trình 180 ngày — "chi tiêu hôm nay"

Người dùng xác nhận: ô "chi tiêu hôm nay" trong Thử thách ngày đại diện
cho **phần chi tiêu KHÔNG cố định trong ngày** — tức đúng là luồng 03
(ghi nhận chi tiêu tự do), khác với chi phí cố định tự động của luồng 04.
Nối thật trong chính plan này, thay vì để riêng:

- **Không xoá bảng/dữ liệu `JourneyExpenseEntry`** (tránh mất dữ liệu đã
  ghi) — chỉ ngừng ghi mới vào đó, đổi vai trò thành dữ liệu lịch sử đông
  cứng. Bỏ `include: { expense: true }` khỏi `getJourneyDashboard`.
- Thẻ "TÀI CHÍNH · chi tiêu hôm nay" trong `JourneyControls` (card Thử
  thách ngày) đổi hẳn nguồn dữ liệu: thay vì 1 dòng `JourneyExpenseEntry`
  (upsert, 1 dòng/ngày), giờ hiển thị **tổng + danh sách** mọi
  `FinanceTransaction` loại `EXPENSE`, `recurringRuleId IS NULL` (= không
  cố định), `occurredAt` = hôm nay, của user đó — khớp đúng ngữ nghĩa
  "chi tiêu không cố định hôm nay", và khớp đúng mô hình thật của luồng
  03 (nhiều khoản/ngày, không phải 1 dòng upsert).
- Form ghi nhanh trong Journey giữ nguyên UX rút gọn (chỉ số tiền + ghi
  chú, không bắt chọn danh mục) nhưng gọi thẳng `createFinanceTransaction`
  — vì action này bắt buộc `category` cho `EXPENSE`, điểm ghi nhanh này
  truyền cố định `category: "Khác"` (danh mục mặc định cho chi tiêu
  không phân loại từ Journey). Người dùng muốn phân loại kỹ hơn thì vào
  thẳng `/finance`.
- `saveJourneyExpense` (`src/actions/journey.ts`) bị xoá — không còn nơi
  nào gọi.
- `src/lib/finance-queries.ts` thêm `getTodayVariableExpenses(userId,
  timezone): Promise<{ totalVnd: number; entries: { id: string;
  amountVnd: number; note: string | null }[] }>` — query
  `FinanceTransaction` đúng 3 điều kiện ở trên; `journey/page.tsx` gọi
  hàm này song song với `getJourneyDashboard` (`Promise.all`), truyền
  kết quả vào `JourneyControls`'s prop `expense` (đổi type từ
  `{ amountVnd, note } | null` sang đúng shape trả về của hàm này).

## Non-goals (để lại cho thiết kế sau)

- Không có model `Account` (ví/ngân hàng) riêng — chỉ 1 field text tự do.
- Không giới hạn gói (`plan.ts`) cho số giao dịch/ngân sách/rule — giống
  `customers`/`workspace`, không phải tài nguyên bị giới hạn gói trong
  thiết kế hiện tại.
- Không xuất báo cáo/biểu đồ — artifact chỉ nói "báo cáo sẽ xây ở giai
  đoạn sau".
- Không phân trang danh sách giao dịch.

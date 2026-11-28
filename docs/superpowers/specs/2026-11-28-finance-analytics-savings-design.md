# Thiết kế: Biểu đồ xu hướng thu/chi, lịch 30 ngày, và mục Tiết kiệm

## Bối cảnh & ý định

Module Tài chính (`/finance`) hiện có: tổng thu/chi/số dư tháng này (số thuần),
ngân sách theo danh mục, giao dịch định kỳ, danh sách giao dịch gần đây. Người
dùng muốn thêm 4 phần, lấy cảm hứng bố cục từ 3 ảnh tham khảo (card "Revenue
Forecast", card "Profit Margin", lịch có chấm màu) nhưng **đổi màu theo đúng
token hệ thống hiện có** (`--jade`/`--danger`/`--ochre`...), không dùng màu
xanh dương của ảnh gốc, và bỏ các chi tiết không có thật (vd "AI Forecast
Model v2.3", "Confidence: 87%" — đó là trang trí của ảnh mẫu, không phải dữ
liệu thật của app này).

Người dùng đã chọn 2 quyết định kiến trúc:
1. **Tự vẽ biểu đồ bằng SVG thuần** — khớp phong cách `ProgressRing`/
   `ProgressBar` đã có, không thêm thư viện chart.
2. **Tiết kiệm dùng lại đúng bảng `FinanceTransaction` hiện có** (Cách A) —
   1 khoản "gửi tiết kiệm" = 1 `FinanceTransaction` loại `EXPENSE`; 1 khoản
   "rút tiết kiệm" = 1 `FinanceTransaction` loại `INCOME`. Hệ quả được người
   dùng chấp nhận: "Tổng chi tháng này" sẽ tăng khi gửi tiết kiệm (vì về bản
   chất đó là tiền rời khỏi dòng tiền chi tiêu được), và ngược lại khi rút ra.

## Goals

1. 2 thẻ xu hướng (Tổng thu / Tổng chi), mỗi thẻ: số lớn hiện tại + % so với
   kỳ trước + biểu đồ cột (mỗi cột 1 kỳ) kèm đường xu hướng mượt đè lên trên,
   xem theo Ngày / Tuần / Tháng qua 1 bộ chọn chung cho cả 2 thẻ.
2. Lịch tháng (lưới 7 cột, bo viền mảnh — tái dùng đúng kiểu đã làm ở
   `work-calendar-view.tsx`), mỗi ngày có giao dịch hiện chấm xanh (có thu)
   và/hoặc chấm đỏ (có chi) kèm số tiền; bấm vào 1 ngày mở modal liệt kê từng
   giao dịch của đúng ngày đó.
3. Mục "Tiết kiệm" mới: nhiều mục tiêu tiết kiệm (tên, số tiền mục tiêu,
   hạn tuỳ chọn), nút Gửi vào / Rút ra cho từng mục tiêu, thanh tiến độ %,
   tổng đã tiết kiệm, và dòng gợi ý "Tháng này có thể tiết kiệm thêm X đ".
4. 1 thẻ xu hướng riêng cho Tiết kiệm (kiểu "Profit Margin"): % tiết kiệm
   ròng theo tháng (= tiết kiệm ròng tháng đó / thu nhập tháng đó) qua các
   tháng gần đây, dạng đường + chấm tròn từng điểm.

## Non-goals

- Không thêm thư viện biểu đồ ngoài.
- Không có bảng dữ liệu tách riêng cho tiết kiệm (theo Cách A đã chọn) — chỉ
  thêm 1 bảng nhỏ cho **mục tiêu** (tên/số tiền mục tiêu), không phải sổ
  gửi/rút riêng.
- Không chặn người dùng đặt `FinanceBudget` trùng tên danh mục "Tiết kiệm" —
  nếu họ tự làm vậy, ngân sách đó sẽ nhận luôn các khoản gửi tiết kiệm làm
  "chi tiêu" của danh mục đó; đây là hệ quả tự nhiên của Cách A, không xử lý
  đặc biệt (YAGNI).
- Không dự báo tương lai (forecast) — "xu hướng" ở đây là dữ liệu lịch sử
  thật, không suy đoán.
- Không làm biểu đồ tương tác nâng cao (zoom, kéo chọn vùng) — chỉ hover để
  xem số liệu từng cột/điểm, theo đúng mức "Add the hover layer by default"
  của skill dataviz, không hơn.

## Quyết định cụ thể

### 1. Schema — chỉ thêm 1 model nhỏ cho mục tiêu

```prisma
model FinanceSavingsGoal {
  id         String    @id @default(cuid())
  userId     String
  name       String
  targetVnd  Int
  targetDate DateTime? @db.Date
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions FinanceTransaction[]

  @@index([userId])
}
```

`FinanceTransaction` thêm 1 cột tuỳ chọn: `savingsGoalId String?` +
relation `savingsGoal FinanceSavingsGoal? @relation(fields: [savingsGoalId],
references: [id], onDelete: SetNull)` — xoá mục tiêu không xoá lịch sử giao
dịch (giữ đúng quy ước `onDelete: SetNull` đã dùng cho `recurringRuleId`).

`User` thêm 1 relation: `financeSavingsGoals FinanceSavingsGoal[]`.

Số tiền đã tiết kiệm của 1 mục tiêu = tổng `amountVnd` các
`FinanceTransaction` có `savingsGoalId` đó và `type=EXPENSE`, trừ đi tổng các
dòng `type=INCOME` cùng `savingsGoalId` (rút ra).

### 2. Gửi vào / Rút ra một mục tiêu

Dùng lại đúng `createFinanceTransaction` đã có (không viết action mới) —
chỉ cần action này nhận thêm 1 field tuỳ chọn `savingsGoalId`. Khi gửi vào 1
mục tiêu: `createFinanceTransaction({ type: "EXPENSE", category: "Tiết
kiệm", amountVnd, occurredAt: today, savingsGoalId })`. Khi rút ra:
`type: "INCOME"` cùng `category`/`savingsGoalId`. Vì đây vẫn là
`FinanceTransaction` bình thường, nó tự động xuất hiện trong "Giao dịch gần
đây" và cộng vào Tổng thu/chi tháng — đúng theo Cách A.

**Quyết định (builder check hỏi, tự chốt):** rút quá số đã tiết kiệm của 1
mục tiêu (làm `savedVnd` âm) **bị chặn**, không phải "cứ rút rồi thanh tiến
độ về 0 âm thầm". Chặn ở cả 2 lớp, theo đúng quy ước validate client + server
đã có (vd `CATEGORY_REQUIRED`): UI vô hiệu hoá nút "Rút ra" nếu số nhập lớn
hơn `savedVnd` hiện tại của mục tiêu đó; `createFinanceTransaction` khi
`savingsGoalId` có giá trị và `type === "INCOME"`, tính lại `savedVnd` hiện
tại của mục tiêu (server-side, không tin số client gửi) và throw
`UserError("WITHDRAWAL_EXCEEDS_SAVED")` nếu vượt quá.

### 3. Mục tiêu tiết kiệm — CRUD

3 action mới trong `src/actions/finance.ts`:
- `createFinanceSavingsGoal({ name, targetVnd, targetDate? })`
- `updateFinanceSavingsGoal(id, { name, targetVnd, targetDate? })` (sửa mục
  tiêu, không đụng lịch sử gửi/rút)
- `deleteFinanceSavingsGoal(id)` (chỉ xoá mục tiêu, giao dịch cũ giữ
  nguyên nhờ `onDelete: SetNull`)

### 4. Đọc dữ liệu cho UI — tải 1 lần ở server, lọc ở client (không thêm action đọc riêng)

**Quyết định (builder check hỏi, tự chốt):** calendar điều hướng tháng,
bấm xem chi tiết 1 ngày, và bộ chọn Ngày/Tuần/Tháng của biểu đồ xu hướng
đều cần dữ liệu "mới" sau lần tải trang đầu — nhưng thay vì thêm action đọc
riêng gọi qua lại từ client (kiểu GET qua server action, không khớp quy ước
hiện có của app — mọi nơi khác chỉ dùng server action cho ghi + `router.
refresh()`), dùng đúng kiến trúc `work-calendar-view.tsx` đã có: **tải 1
mảng `FinanceTransaction` đủ rộng ngay ở `page.tsx` (server component), rồi
mọi điều hướng tháng / bấm xem ngày / đổi đơn vị Ngày-Tuần-Tháng đều lọc
**hoàn toàn ở client** từ mảng đã tải, không gọi lại server.** Khoảng tải:
400 ngày gần nhất (đủ cho xu hướng 12 tháng + điều hướng lịch vài tháng
quanh hiện tại, với 1 cá nhân thì vài nghìn dòng vẫn nhẹ). Vì vậy:

- `src/lib/finance-queries.ts` chỉ cần 1 hàm mới:
  `getFinanceTransactionsWindow(userId, timezone, days = 400):
  Promise<SerializedFinanceTransaction[]>` — trả về đã serialize (giống
  cách `recentTransactions` đang serialize), `page.tsx` gọi 1 lần cùng lúc
  với `getFinanceDashboard`/`runDueRecurringRules` (`Promise.all`), truyền
  xuống `FinanceControls` làm 1 prop mới.
- `getFinanceSavingsGoals(userId)`: vẫn là 1 hàm DB riêng (đọc lúc SSR, như
  các phần khác của dashboard) — trả từng mục tiêu kèm `savedVnd` tính sẵn.
- `getIncomeExpenseTrend`, `getSavingsRateTrend`, `getDayTransactions`,
  `getMonthCalendarSummary` ở mục dưới đây **không còn là hàm DB** — đổi
  thành 4 hàm **thuần** (`src/lib/finance.ts`, cùng file với
  `budgetWarningLevel`) nhận `transactions: SerializedFinanceTransaction[]`
  đã tải sẵn làm tham số, tính toán hoàn toàn trong bộ nhớ ở client:
  `computeIncomeExpenseTrend(transactions, timezone, unit, weekStartsOn):
  {label, incomeVnd, expenseVnd}[]`,
  `computeSavingsRateTrend(transactions, timezone): {label, ratePercent}[]`,
  `getTransactionsForDate(transactions, timezone, date): SerializedFinanceTransaction[]`,
  `getMonthCalendarSummary(transactions, timezone, year, month):
  Record<ISODate, {incomeVnd, expenseVnd}>`.

Hệ quả: `FinanceControls` (client) tự giữ `monthOffset`/`trendUnit` bằng
`useState` y hệt `work-calendar-view.tsx`, tính lại các hàm thuần trên mỗi
lần render — không có loading state, không có round-trip server nào cho 3
tương tác này.

**Quy tắc tính `computeSavingsRateTrend`:** 6 tháng gần nhất, mỗi tháng
`ratePercent = round((tiết kiệm ròng tháng đó / thu nhập THẬT tháng đó) *
100)`. **Quyết định (builder check hỏi, tự chốt):** "thu nhập THẬT" = tổng
giao dịch `INCOME` trong tháng **trừ** các dòng có `savingsGoalId` khác
null (loại tiền rút tiết kiệm ra khỏi mẫu số) — nếu tính cả tiền rút vào
mẫu số, 1 tháng rút nhiều sẽ vừa làm mẫu số phồng lên vừa làm tử số (tiết
kiệm ròng) âm, ra tỷ lệ sai lệch ngay trên thẻ vốn mô phỏng "Profit Margin"
(vốn cần mượt/có nghĩa). "Tiết kiệm ròng" = tổng gửi (EXPENSE có
`savingsGoalId`) trừ tổng rút (INCOME có `savingsGoalId`) trong tháng. Mẫu
số = 0 → `ratePercent = 0`. `ratePercent` **có thể âm** (tháng rút nhiều
hơn gửi) — `TrendLineChart` phải vẽ được giá trị âm (có đường mốc 0, điểm
dưới mốc vẽ bên dưới), không giả định luôn dương như ảnh mẫu.

### 5. Component biểu đồ thuần SVG mới (`src/components/ui/`)

- `TrendBarChart` ({ data: {label, value}[], color, label, deltaPercent }):
  cột (rounded ends 4px theo `marks-and-anatomy.md`) + đường xu hướng mượt
  (polyline/path qua điểm trung bình trượt 3 kỳ) đè lên, tối đa ~30 cột;
  hover 1 cột hiện tooltip nhỏ (label + giá trị) — đúng "hover layer by
  default" của skill dataviz. 1 chuỗi dữ liệu → không cần legend.
- `TrendLineChart` ({ data: {label, value}[], color }): đường + chấm tròn
  ở mỗi điểm (>=8px theo mark spec), hover 1 điểm hiện tooltip; dùng cho
  thẻ tỷ lệ tiết kiệm.
- Cả 2 dùng màu theo `color` prop truyền vào (caller quyết định
  `var(--jade-ink)` cho thu, `var(--danger)` cho chi, `var(--accent)` cho
  tiết kiệm) — không hard-code màu xanh dương của ảnh mẫu.
- Copy thật thay cho trang trí giả của ảnh mẫu: bỏ "Confidence: 87%"/"AI
  Forecast Model v2.3"; giữ số lớn + dòng phụ "+X% so với kỳ trước"/"so với
  6 tháng trước" + nhãn trục ngắn dưới biểu đồ.

### 6. Khoảng dữ liệu mặc định cho xu hướng thu/chi

- Ngày: 30 ngày gần nhất (mỗi cột 1 ngày).
- Tuần: 12 tuần gần nhất (`weekStartsOn` theo cài đặt user, dùng
  `startOfWeek` đã có).
- Tháng: 12 tháng gần nhất.
"% so với kỳ trước" = so kỳ hiện tại (cột cuối) với kỳ ngay trước nó.

### 7. Lịch 30 ngày

Tái dùng đúng khung UI của `work-calendar-view.tsx` (lưới bo viền mảnh,
`StaggerReveal` cho các ô, số ngày "hôm nay" bọc vòng tròn đen). Mỗi ô ngày
có giao dịch hiện tối đa 2 dòng nhỏ: chấm xanh + tổng thu ngày đó (nếu > 0),
chấm đỏ + tổng chi ngày đó (nếu > 0). Bấm vào ô ngày (có giao dịch) mở
`Modal` liệt kê từng giao dịch đúng ngày đó (số tiền, danh mục, ghi chú).
Điều hướng tháng trước/sau như lịch Workspace đã có.

### 8. Mục "Tiết kiệm" trong trang Tài chính

1 `<section className="card">` mới, đặt sau phần Ngân sách:
- Dòng gợi ý trên cùng: "Tháng này có thể tiết kiệm thêm {vnd(suggest)}"
  với `suggest = max(0, incomeThisMonth - expenseThisMonth)` (dùng lại đúng
  2 số đã có trên `FinanceDashboard`, không tính thêm).
- Danh sách mục tiêu: tên, thanh tiến độ (`ProgressBar` đã có,
  `savedVnd/targetVnd`), số đã lưu/mục tiêu, hạn (nếu có), 2 nút nhỏ "Gửi
  vào"/"Rút ra" (mở ô nhập số tiền inline, theo đúng mẫu "Sửa hạn mức" 2
  bước đã dùng ở `BudgetsSection`), nút xoá mục tiêu (xác nhận 2 bước như
  các chỗ khác).
- Form thêm mục tiêu mới: tên, số tiền mục tiêu (`AmountInput` đã có), hạn
  (tuỳ chọn, `type="date"`).

### 9. Thẻ xu hướng tiết kiệm

Đặt cạnh/dưới mục Tiết kiệm: số lớn = tỷ lệ tiết kiệm tháng này (%) + dòng
phụ "+X điểm % so với 6 tháng trước" + `TrendLineChart` 6 tháng gần nhất.

## Để lại cho người viết plan

- Tên icon lucide cụ thể cho từng phần (mẫu đã có sẵn nhiều icon tái dùng
  được: `PiggyBank`, `TrendingUp`...).
- Cách chính xác vẽ đường xu hướng mượt trong `TrendBarChart` (trung bình
  trượt hay spline) — miễn khớp mark spec của skill dataviz.
- Vị trí chính xác đặt 2 thẻ xu hướng thu/chi và lịch 30 ngày trong bố cục
  trang (trên/dưới mục Ngân sách) — giữ nguyên thứ tự các phần đã có, chèn
  thêm vào chỗ hợp lý.

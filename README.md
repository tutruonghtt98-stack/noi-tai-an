# Nội Tại Ẩn — Kỷ luật từ bên trong

Nền tảng kỷ luật cá nhân cho nhiều người dùng: mục tiêu năm → quý → tháng, theo dõi thói quen, Top 3 ưu tiên mỗi ngày và phiên tập trung sâu.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Prisma 6 + PostgreSQL (Supabase) · Auth.js v5 (Google) · Tailwind CSS 4 · Be Vietnam Pro · i18n Việt/Anh.

---

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **1** | Nền tảng, đăng nhập Google, **A** Dashboard, **B** Goal System, **C** Habit Tracker, **D** Daily Execution, **I** Cài đặt giao diện | ✅ Hoàn thành |
| **2** | **E** Progress Analytics, **F** Reflection, **G** Payment (PayOS/SePay), Admin, trang pháp lý | ✅ Hoàn thành |
| **3** | **H1–H5** Cộng đồng: bảng tin, thử thách, bảng xếp hạng, nhóm đồng hành, hồ sơ hành trình (ảnh lưu Cloudflare R2) | ✅ Hoàn thành |

### Giai đoạn 1 gồm những gì

- **Dashboard**: lời chào theo giờ, điểm kỷ luật hôm nay (40% Top 3, 40% thói quen, 20% thời gian tập trung), lịch kỷ luật trong tháng, 4 chỉ số, đồng hồ tập trung, timeline trong ngày, Top 3, check-in thói quen, tiến độ mục tiêu.
- **Mục tiêu**: cây Năm → Quý → Tháng, "vì sao" của từng mục tiêu, chỉ số đo lường (VD: 17/24 cuốn), dự án và hành động cụ thể. Tiến độ được tính đệ quy từ hành động và mục tiêu con.
- **Thói quen**: lặp theo ngày trong tuần, nhiều lần mỗi ngày, chuỗi hiện tại/dài nhất, tỷ lệ duy trì 30 ngày, lịch tháng, check-in lùi tối đa 7 ngày.
- **Thực thi**: ý định trong ngày và mức năng lượng, Top 3 (tối đa 3), nhiệm vụ có giờ và ước tính, dời sang mai, kéo việc tồn đọng vào hôm nay, đồng hồ Pomodoro (giữ trạng thái khi chuyển trang hoặc tab, tự ghi phiên).
- **Cài đặt**: sáng/tối/hệ thống, 4 màu nhấn, mật độ thoáng/gọn, ngôn ngữ, múi giờ, ngày đầu tuần, độ dài phiên, xuất dữ liệu JSON.
- **Gói cước**: Free giới hạn 3 mục tiêu đang chạy và 5 thói quen (`src/lib/plan.ts`); Pro/Team không giới hạn.

### Giai đoạn 2 gồm những gì

- **Phân tích** (`/analytics`): báo cáo tuần/tháng, các khoảng 7/30/90 ngày (gói Free chỉ xem được 7 ngày); điểm kỷ luật theo ngày, thời gian tập trung, heatmap lịch sử thói quen, tỷ lệ duy trì theo từng thói quen, tiến độ mục tiêu, bảng so sánh với kỳ trước. Biểu đồ có tooltip, xem được dạng bảng, màu đã qua kiểm tra tương phản và mù màu.
- **Suy ngẫm** (`/reflection`): nhật ký cuối ngày (tâm trạng, điều làm tốt, bài học, biết ơn, cải thiện cho ngày mai, gắn thẻ 8 nguyên nhân trì hoãn kèm gợi ý xử lý), đánh giá tuần (điểm tuần, điểm sáng, trở ngại, nguyên nhân gốc, thử nghiệm cho tuần tới, 3 trọng tâm) kèm số liệu tự động, và mục "Thấu hiểu trì hoãn" tổng hợp khuôn mẫu 30 ngày cùng kế hoạch cải thiện.
- **Thanh toán**: `/pricing` (Free/Pro/Team, theo tháng hoặc năm, Team tính theo số chỗ), `/billing` (gói hiện tại, lịch sử giao dịch), trang QR VietQR tự kiểm tra trạng thái. Hỗ trợ **SePay** (webhook xác thực bằng API Key) hoặc **PayOS** (link thanh toán + webhook có chữ ký HMAC, tra lại trạng thái khi người dùng quay về). Kích hoạt idempotent: webhook lặp không cộng hạn hai lần; gia hạn được nối tiếp vào hạn cũ. Bảng giá nằm trong `src/lib/billing.ts`.
- **Quản trị** (`/admin`, chỉ ADMIN): KPI (người dùng, hoạt động 7 ngày, thuê bao, MRR, doanh thu 30 ngày), biểu đồ doanh thu; quản lý người dùng (tìm kiếm, cấp gói thủ công, cấp/gỡ quyền ADMIN, khoá tài khoản); giao dịch (lọc, đối soát thủ công khi khách chuyển sai nội dung, huỷ đơn). Mục Kiểm duyệt và Thử thách chính thức sẽ hoạt động từ Giai đoạn 3.
- **Pháp lý** (công khai): `/terms`, `/privacy` (theo NĐ 13/2023), `/refund`, `/contact`; footer hiển thị tên đơn vị, MST và địa chỉ (cấu hình qua `.env`). Đây là các trang PayOS/SePay thường yêu cầu khi duyệt merchant. **Hãy nhờ người có chuyên môn pháp lý rà soát nội dung trước khi công bố.**

### Giai đoạn 3 gồm những gì

- **H1 Bảng tin** (`/community`): đăng bài theo 6 chủ đề, đính kèm ảnh minh chứng (tuỳ chọn), động viên, bình luận, báo cáo vi phạm, lọc theo chủ đề, phân trang. Ảnh được nén ngay trên trình duyệt (WebP, cạnh dài tối đa 1600px, xoá EXIF/GPS) rồi tải **thẳng lên R2** qua URL ký sẵn; server xác minh file trước khi gắn vào bài.
- **H2 Thử thách** (`/community/challenges`): thử thách 7, 21 hoặc 30 ngày; tham gia, check-in mỗi ngày kèm ghi chú (có thể chia sẻ lên bảng tin), lưới tiến độ cá nhân, tiến độ chung, xếp hạng trong thử thách. Hoàn thành khi check-in đủ 80% số ngày. Tạo thử thách cần gói Pro; thử thách chính thức do Admin tạo và trao huy hiệu riêng.
- **H3 Bảng xếp hạng tích cực** (`/community/leaderboard`): xếp theo tuần hoặc theo thử thách. Điểm = 50% tỷ lệ hoàn thành + 30% số ngày check-in + 20% chuỗi ngày, **không tính lượt thích**. Người dùng có thể ẩn mình khỏi bảng xếp hạng.
- **H4 Nhóm đồng hành** (`/community/groups`): nhóm 3–25 người, mời bằng link (trưởng nhóm tạo được link mới), cam kết tuần, bảng tin riêng của nhóm, tổng kết tuần (số liệu tổng hợp của từng thành viên, không lộ nhật ký). Mỗi người tham gia tối đa 5 nhóm.
- **H5 Hồ sơ hành trình** (`/u/<tên>`): chỉ số, mục tiêu đang theo đuổi, 12 loại huy hiệu (tự trao sau các sự kiện), thử thách đã hoàn thành, dòng thời gian cột mốc, bài viết. Bật/tắt công khai riêng cho từng phần trong **Cài đặt → Hồ sơ hành trình**; mặc định hồ sơ ở chế độ riêng tư.
- **Admin**: Kiểm duyệt (ẩn nội dung, bỏ qua, khoá tác giả, khôi phục bài đã ẩn) và Thử thách chính thức (tạo, lưu trữ).
- **An toàn**: giới hạn tần suất đăng bài, bình luận, động viên, upload; người xem chỉ thấy bài trong nhóm khi là thành viên; tài khoản bị khoá bị ẩn khỏi bảng tin.

### Bổ sung sau Giai đoạn 3

- **Theo dõi hồ sơ**: nút Theo dõi trên hồ sơ công khai, số người theo dõi/đang theo dõi, tab "Đang theo dõi" trên bảng tin.
- **Ảnh đại diện**: tải lên trong Cài đặt hoặc trên hồ sơ của mình (cắt vuông, nén WebP 512×512, lưu R2).
- **Nhóm đồng hành**: tối đa 25 thành viên. Nhóm công khai được hiện trong Gợi ý và Tìm nhóm gần tôi; thành viên Pro gửi yêu cầu tham gia, trưởng nhóm duyệt.
- **Thử thách**: khi tạo thử thách có thể mời những người đang theo dõi hoặc theo dõi bạn; người được mời chấp nhận/từ chối trong tab Thử thách. Thành viên mời thêm được bằng nút "Mời thêm".
- **Thành tích tự động**: chuỗi cá nhân (7/21/30/66/100/365 ngày) và chuỗi nhóm (3/7/14/30/60/100 ngày) tự đăng lên bảng tin; có thể tắt trong Cài đặt.
- **Dashboard**: câu nói động lực đổi mỗi 10 giây; lịch trình Ngày có vạch "Bây giờ" cố định ở giữa, công việc trôi theo giờ thực; thêm chế độ lịch Tuần.
- **Thực thi**: nút "+" mở pop-up điền đầy đủ (ngày, giờ, ước tính, mục tiêu, ghi chú, Top 3); gõ tên + Enter vẫn thêm nhanh.
- **Mục tiêu**: thêm cấp **Tuần** (cột mốc tuần, con của mục tiêu tháng).
- **Nhắc nhở**: thông báo hệ thống + âm thanh khi đến giờ lịch trình và khi hết giờ tập trung.

> Bảng xếp hạng tuần đang tính trực tiếp từ dữ liệu 40 ngày gần nhất. Khi vượt khoảng vài nghìn người dùng hoạt động, nên chuyển sang cache (bảng tổng hợp chạy định kỳ).

---

## Ảnh cộng đồng: Cloudflare R2

Trên máy local, nếu chưa cấu hình R2, ảnh được lưu vào thư mục `.uploads/` (đã có trong `.gitignore`). Production **bắt buộc** cấu hình R2.

1. Cloudflare Dashboard → **R2** → tạo bucket (VD `noitaian-media`).
2. **Settings → Public access**: gắn Custom Domain (khuyên dùng, VD `media.ten-mien.vn`) hoặc bật `r2.dev`. Điền URL này vào `R2_PUBLIC_URL`.
3. **Manage R2 API Tokens** → tạo token có quyền *Object Read & Write* cho bucket → điền `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; `R2_ACCOUNT_ID` lấy ở trang tổng quan R2.
4. **Settings → CORS policy** của bucket (bắt buộc để trình duyệt tải ảnh thẳng lên):

```json
[
  {
    "AllowedOrigins": ["https://ten-mien-cua-ban.vn"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Thanh toán

Trên máy local, nếu không đặt `PAYMENT_PROVIDER`, hệ thống chạy **chế độ giả lập**: trang QR có nút "Giả lập thanh toán thành công". Production **bắt buộc** cấu hình một cổng thanh toán.

**SePay (khuyên dùng cho cá nhân / hộ kinh doanh)**

1. Đăng ký tại my.sepay.vn và liên kết tài khoản ngân hàng nhận tiền.
2. Vào *Webhooks* → thêm URL `https://ten-mien.vn/api/payments/sepay`, kiểu chứng thực **API Key**, rồi chép key vào `SEPAY_API_KEY`.
3. Điền vào `.env`: `PAYMENT_PROVIDER=sepay`, `SEPAY_BANK`, `SEPAY_ACCOUNT_NO`, `SEPAY_ACCOUNT_NAME`.

**PayOS**

1. Tạo kênh thanh toán tại my.payos.vn, lấy Client ID, API Key và Checksum Key.
2. Đặt webhook `https://ten-mien.vn/api/payments/payos` (PayOS sẽ gửi một request thử, hệ thống trả 200).
3. Điền vào `.env`: `PAYMENT_PROVIDER=payos`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.

Mã nội dung chuyển khoản có dạng `NTA` + 6 ký tự. Nếu khách chuyển sai nội dung, vào **Admin → Giao dịch → Đánh dấu đã thu** để đối soát thủ công.

---

## Chạy trên máy (Windows/macOS/Linux)

Yêu cầu: Node.js ≥ 20.9.

```bash
npm install
cp .env.example .env        # rồi sửa giá trị (xem bên dưới)
```

**Cơ sở dữ liệu: Supabase** (Postgres hosted, dùng chung cho local và production).

1. Tạo project tại [supabase.com](https://supabase.com/dashboard).
2. **Project Settings → Database → Connection string**: lấy chuỗi kết nối kiểu *Transaction pooler* (cổng `6543`) cho `DATABASE_URL`, và kiểu *Session/Direct* (cổng `5432`) cho `DIRECT_URL`.
3. Điền cả hai vào `.env`, rồi tạo bảng và seed dữ liệu:

```bash
npx prisma db push          # tạo bảng (dùng DIRECT_URL)
npm run db:seed             # dữ liệu demo (tuỳ chọn)
npm run dev                 # http://localhost:3000
```

`.env` cho local:

```env
DATABASE_URL="postgresql://postgres.xxxx:MAT_KHAU@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxxx:MAT_KHAU@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="chuoi-ngau-nhien-dai"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true
ALLOW_DEV_LOGIN=true        # hiện nút "Vào bằng tài khoản demo" — chỉ hoạt động khi NODE_ENV != production
```

> `DATABASE_URL` (pooler, cổng 6543) dùng lúc app chạy; `DIRECT_URL` (cổng 5432) chỉ cần cho `prisma db push` / `prisma migrate`.

---

## Đăng nhập Google

1. Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID** → *Web application*.
2. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://ten-mien-cua-ban.vn/api/auth/callback/google`
3. Điền `AUTH_GOOGLE_ID` và `AUTH_GOOGLE_SECRET` vào `.env`.
4. Thêm email của bạn vào `ADMIN_EMAILS` để tài khoản nhận quyền quản trị khi đăng nhập lần đầu.

---

## Đưa lên GitHub

```bash
git remote add origin git@github.com:<user>/noi-tai-an.git
git push -u origin main
```

`.env`, `.pglite`, `node_modules` và `.next` đều đã nằm trong `.gitignore`.

---

## Deploy lên Hostinger VPS

### 1. Cài đặt lần đầu (một lần duy nhất)

Trỏ bản ghi **A** của `ten-mien.vn` và `www.ten-mien.vn` về IP của VPS, rồi SSH vào VPS bằng root:

```bash
git clone https://github.com/<user>/noi-tai-an.git /tmp/nta
DOMAIN=ten-mien.vn EMAIL=ban@email.com REPO=git@github.com:<user>/noi-tai-an.git \
  bash /tmp/nta/deploy/setup-vps.sh
```

Script sẽ cài Node 22, PM2, Nginx, tường lửa UFW và SSL Let's Encrypt, tạo user `deploy`. Database dùng **Supabase** (không cài Postgres trên VPS). Sau đó làm theo hướng dẫn script in ra:

```bash
sudo -iu deploy
git clone git@github.com:<user>/noi-tai-an.git /var/www/noi-tai-an
cd /var/www/noi-tai-an
cp .env.example .env && nano .env     # DATABASE_URL + DIRECT_URL (Supabase), AUTH_SECRET, AUTH_URL, Google, ADMIN_EMAILS
bash deploy/deploy.sh
```

> User `deploy` cần một **deploy key** (SSH key chỉ đọc) trong GitHub repo → *Settings → Deploy keys* để `git clone`/`git fetch` được.

### 2. Tự động deploy khi push lên `main`

Trong GitHub repo → *Settings → Secrets and variables → Actions*, thêm:

| Secret | Giá trị |
|---|---|
| `VPS_HOST` | IP của VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | private key được phép SSH vào user `deploy` |
| `VPS_PORT` | (tuỳ chọn) cổng SSH, mặc định 22 |

Sau đó vào tab *Variables* (cùng trang), tạo biến `DEPLOY_ENABLED` = `true`. Khi chưa đặt biến này, workflow chỉ typecheck và build, không deploy.

Workflow `.github/workflows/deploy.yml` sẽ typecheck và build, rồi SSH vào VPS chạy `deploy/deploy.sh`: pull code → `npm ci` → `prisma migrate deploy` → build → `pm2 startOrReload` → kiểm tra `/api/health`.

### Vận hành

```bash
pm2 logs noi-tai-an          # xem log
pm2 status
curl https://ten-mien.vn/api/health
```

Sao lưu database: Supabase tự động backup hằng ngày (Dashboard → Database → Backups). Gói trả phí có Point-in-Time Recovery.

---

## Cấu trúc thư mục

```
prisma/              schema, migration, seed
src/
  auth.ts            Auth.js (Google + đăng nhập demo cho local)
  actions/           Server Actions: goals, tasks, habits, settings
  app/
    (app)/           các trang cần đăng nhập: dashboard, today, habits, goals, settings…
    login/           đăng nhập + chọn ngôn ngữ
    api/             auth, export (xuất dữ liệu), health
  components/        UI: focus-timer, tasks, habits, goals, dashboard, nav…
  lib/
    i18n/            từ điển vi/en (TypeScript bắt lỗi thiếu khoá)
    queries.ts       truy vấn + tính streak, tiến độ, điểm kỷ luật
    stats.ts         công thức streak / tiến độ / điểm kỷ luật
    plan.ts          giới hạn gói Free/Pro/Team
  app/globals.css    design tokens (sáng/tối, màu nhấn, mật độ)
deploy/              setup-vps.sh, deploy.sh, nginx.conf
ecosystem.config.cjs PM2
```

## Thay logo

Logo hiện tại là logo tạm (`src/components/logo.tsx`). Khi có logo chính thức, đặt file vào `public/logo.svg` rồi thay `<LogoMark />` bằng `<img src="/logo.svg" alt="" />`. Có thể đặt thêm `src/app/icon.png` (512×512) để làm favicon.

## Design system

- **Màu:** "Giấy & mực": nền ngà `#F5F3EE`, mực `#1D1C1A`; màu nhấn Hổ phách `#F2C14E`, Ngọc bích `#86CFAF`, Sương lam `#A8D4F0`, Đất nung `#E89B7E`. Có đủ bản tối.
- **Chữ:** Be Vietnam Pro (hiển thị dấu tiếng Việt chuẩn).
- **Hình khối:** card bo góc 28px, điều hướng dạng pill như template gốc, vùng chạm tối thiểu 44px, focus ring rõ ràng, tôn trọng `prefers-reduced-motion`.

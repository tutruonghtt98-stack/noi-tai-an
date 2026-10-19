# Nội Tại Ẩn — Kỷ luật từ bên trong

Nền tảng kỷ luật cá nhân cho nhiều người dùng: mục tiêu năm → quý → tháng, theo dõi thói quen, Top 3 ưu tiên mỗi ngày và phiên tập trung sâu.

**Stack:** Next.js 16 (App Router, Server Actions) · TypeScript · Prisma 6 + PostgreSQL · Auth.js v5 (Google) · Tailwind CSS 4 · Be Vietnam Pro · i18n Việt/Anh.

---

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| **1** | Nền tảng, đăng nhập Google, **A** Dashboard, **B** Goal System, **C** Habit Tracker, **D** Daily Execution, **I** Cài đặt giao diện | ✅ Hoàn thành |
| 2 | **E** Progress Analytics, **F** Reflection, **G** Payment (PayOS/SePay), Admin, trang pháp lý | ⏳ |
| 3 | **H1–H5** Cộng đồng: bảng tin, thử thách, bảng xếp hạng, nhóm đồng hành, hồ sơ hành trình (ảnh lưu Cloudflare R2) | ⏳ |

### Giai đoạn 1 gồm những gì

- **Dashboard**: lời chào theo giờ, điểm kỷ luật hôm nay (40% Top 3, 40% thói quen, 20% thời gian tập trung), lịch kỷ luật trong tháng, 4 chỉ số, đồng hồ tập trung, timeline trong ngày, Top 3, check-in thói quen, tiến độ mục tiêu.
- **Mục tiêu**: cây Năm → Quý → Tháng, "vì sao" của từng mục tiêu, chỉ số đo lường (VD: 17/24 cuốn), dự án và hành động cụ thể. Tiến độ được tính đệ quy từ hành động và mục tiêu con.
- **Thói quen**: lặp theo ngày trong tuần, nhiều lần mỗi ngày, chuỗi hiện tại/dài nhất, tỷ lệ duy trì 30 ngày, lịch tháng, check-in lùi tối đa 7 ngày.
- **Thực thi**: ý định trong ngày và mức năng lượng, Top 3 (tối đa 3), nhiệm vụ có giờ và ước tính, dời sang mai, kéo việc tồn đọng vào hôm nay, đồng hồ Pomodoro (giữ trạng thái khi chuyển trang hoặc tab, tự ghi phiên).
- **Cài đặt**: sáng/tối/hệ thống, 4 màu nhấn, mật độ thoáng/gọn, ngôn ngữ, múi giờ, ngày đầu tuần, độ dài phiên, xuất dữ liệu JSON.
- **Gói cước**: Free giới hạn 3 mục tiêu đang chạy và 5 thói quen (`src/lib/plan.ts`); Pro/Team không giới hạn.

---

## Chạy trên máy (Windows/macOS/Linux)

Yêu cầu: Node.js ≥ 20.9.

```bash
npm install
cp .env.example .env        # rồi sửa giá trị (xem bên dưới)
```

**Cơ sở dữ liệu local không cần cài Postgres:** dự án kèm PGlite (Postgres chạy bằng WASM).

```bash
npm run db:local            # cửa sổ 1: Postgres local ở cổng 5433
npx prisma db push          # cửa sổ 2: tạo bảng
npm run db:seed             # dữ liệu demo (tuỳ chọn)
npm run dev                 # http://localhost:3000
```

`.env` cho local:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&connection_limit=1&pgbouncer=true"
AUTH_SECRET="chuoi-ngau-nhien-dai"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true
ALLOW_DEV_LOGIN=true        # hiện nút "Vào bằng tài khoản demo" — chỉ hoạt động khi NODE_ENV != production
```

> `pgbouncer=true` chỉ cần cho PGlite. **Không** dùng trên VPS.

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

Script sẽ cài Node 22, PM2, PostgreSQL, Nginx, tường lửa UFW và SSL Let's Encrypt, tạo user `deploy` và database `noitaian`, rồi **in mật khẩu DB một lần**. Sau đó làm theo hướng dẫn script in ra:

```bash
sudo -iu deploy
git clone git@github.com:<user>/noi-tai-an.git /var/www/noi-tai-an
cd /var/www/noi-tai-an
cp .env.example .env && nano .env     # DATABASE_URL, AUTH_SECRET, AUTH_URL, Google, ADMIN_EMAILS
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

Workflow `.github/workflows/deploy.yml` sẽ typecheck và build, rồi SSH vào VPS chạy `deploy/deploy.sh`: pull code → `npm ci` → `prisma migrate deploy` → build → `pm2 startOrReload` → kiểm tra `/api/health`.

### Vận hành

```bash
pm2 logs noi-tai-an          # xem log
pm2 status
curl https://ten-mien.vn/api/health
pg_dump noitaian > backup-$(date +%F).sql   # sao lưu (nên đặt cron hằng ngày)
```

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

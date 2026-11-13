# Workspace view area — AppFlowy-style restyle (CSS only, scoped to Workspace)

## Vì sao

Sau khi thêm view Bảng/Lịch (Phase 1), người dùng muốn khu vực view của Workspace
(thanh chuyển Kanban/Bảng/Lịch + nội dung Kanban/Bảng/Lịch bên dưới) có phong cách
gần với AppFlowy hơn: tab gạch chân thay vì viên nang, viền mảnh 1px thay cho nền
xám đặc, bo góc nhỏ hơn, nhiều khoảng trắng hơn.

## Phạm vi (đã chốt với user)

- **Chỉ CSS/markup của khu vực view trong trang Workspace** — không đổi cấu trúc
  trang (vẫn giữ thanh chọn bảng ngang hiện tại ở trên), không đổi hành vi
  (kéo-thả, click mở thẻ, sort, điều hướng tháng... giữ nguyên 100%).
- Áp dụng cho cả 3 view: Kanban, Bảng, Lịch — và thanh chuyển view — để đồng bộ
  phong cách, không chỉ 2 view mới.
- Không đổi `.card`/`.segmented` dùng chung toàn site (Khách hàng, Hành trình,
  Dashboard... giữ nguyên) — thêm class CSS mới chỉ Workspace dùng.
- Không đổi màu/token (`--ink`, `--bg`, `--surface`, `--line`...) — vẫn tự đổi
  theo chế độ sáng/tối người dùng đang chọn.

## Thiết kế

Thêm các class mới trong `src/app/globals.css` (tiền tố `wsx-` để tránh đụng
class dùng chung), chỉ được tham chiếu từ 4 file trong `src/app/(app)/workspace/`:

1. **`view-switcher.tsx`**: thay `.segmented` bằng `.wsx-tabs` — hàng ngang, mỗi
   tab là link phẳng (không nền viên nang), viền dưới 2px trong suốt, khi active
   (`aria-current="page"`) viền dưới đổi màu `var(--ink)` + chữ đậm hơn.

   ```
   Kanban   Bảng   Lịch
   ──────
   (gạch chân dưới tab đang chọn, không còn nền đen bo tròn)
   ```

2. **`kanban-board.tsx`**: cột đổi từ nền xám đặc (`bg-surface-3`, bo 24px) sang
   khung viền mảnh: nền `var(--surface)`, viền 1px `var(--line)`, bo góc nhỏ hơn
   (~10px). Thẻ bên trong: bớt shadow nặng, dùng viền 1px thay shadow dày.

3. **`work-table-view.tsx`**: khung bảng bo góc nhỏ hơn, viền 1px thay cho
   `.card` mặc định (vốn bo 28px theo `--radius-card` của site).

4. **`work-calendar-view.tsx`**: ô ngày đổi từ nền xám đặc sang viền 1px mảnh,
   bo góc nhỏ hơn.

Không có class/biến mới nào được dùng ngoài 4 file này — về mặt kỹ thuật là một
thay đổi "thêm" thuần tuý (file CSS mới cộng vào `globals.css`, không sửa class
cũ), đúng ranh giới đã thống nhất với user.

## Không làm

- Không thêm sidebar/cây trang kiểu AppFlowy (user đã chọn không làm ở bước này).
- Không đổi hành vi kéo-thả, click, sort, điều hướng tháng.
- Không đổi bất kỳ trang nào ngoài `/workspace`.

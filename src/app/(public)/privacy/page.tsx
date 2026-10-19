import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { business } from "@/lib/business";

export const metadata: Metadata = { title: "Chính sách bảo mật" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Chính sách bảo mật">
      <p>
        {business.legalName} (&quot;chúng tôi&quot;) tôn trọng quyền riêng tư của bạn. Chính sách này giải thích dữ liệu nào được thu thập khi bạn dùng {business.brand}, mục đích sử dụng và quyền của bạn, phù hợp với Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
      </p>
      <section>
        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li>
            <strong>Thông tin tài khoản</strong> từ Google: tên, email, ảnh đại diện.
          </li>
          <li>
            <strong>Nội dung bạn tạo</strong>: mục tiêu, dự án, nhiệm vụ, thói quen, phiên tập trung, nhật ký, đánh giá tuần, bài viết và ảnh trong cộng đồng.
          </li>
          <li>
            <strong>Thông tin thanh toán</strong>: mã đơn, gói, số tiền, trạng thái và mã giao dịch do cổng thanh toán trả về. Chúng tôi <strong>không</strong> lưu số thẻ hay thông tin đăng nhập ngân hàng.
          </li>
          <li>
            <strong>Dữ liệu kỹ thuật</strong>: cookie phiên đăng nhập, tuỳ chọn giao diện, nhật ký máy chủ (địa chỉ IP, thời gian truy cập) để bảo mật và khắc phục sự cố.
          </li>
        </ul>
      </section>
      <section>
        <h2>2. Mục đích sử dụng</h2>
        <ul>
          <li>Cung cấp, duy trì và cải thiện các tính năng của dịch vụ.</li>
          <li>Xử lý thanh toán và kích hoạt gói.</li>
          <li>Tính toán thống kê cá nhân (điểm kỷ luật, chuỗi ngày, báo cáo) — chỉ hiển thị cho chính bạn trừ khi bạn chọn công khai.</li>
          <li>Bảo vệ an toàn hệ thống, phòng chống gian lận và lạm dụng.</li>
        </ul>
        <p>Chúng tôi không bán dữ liệu cá nhân và không dùng nội dung nhật ký của bạn cho quảng cáo.</p>
      </section>
      <section>
        <h2>3. Chia sẻ với bên thứ ba</h2>
        <ul>
          <li>Google (đăng nhập OAuth).</li>
          <li>Đối tác thanh toán (PayOS / SePay) để xử lý giao dịch.</li>
          <li>Nhà cung cấp hạ tầng: máy chủ (Hostinger) và lưu trữ ảnh (Cloudflare R2).</li>
          <li>Cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu.</li>
        </ul>
      </section>
      <section>
        <h2>4. Lưu trữ & bảo mật</h2>
        <p>Dữ liệu được mã hoá khi truyền (HTTPS), lưu trên máy chủ có tường lửa và được sao lưu định kỳ. Chỉ nhân sự được uỷ quyền mới truy cập hệ thống, và chỉ khi cần thiết cho vận hành hoặc hỗ trợ.</p>
      </section>
      <section>
        <h2>5. Quyền của bạn</h2>
        <ul>
          <li>Xem và tải về toàn bộ dữ liệu (Cài đặt → Xuất dữ liệu).</li>
          <li>Chỉnh sửa, đặt chế độ riêng tư hoặc xoá nội dung bất kỳ lúc nào.</li>
          <li>Yêu cầu xoá tài khoản và toàn bộ dữ liệu — chúng tôi xử lý trong vòng 30 ngày.</li>
          <li>Rút lại sự đồng ý xử lý dữ liệu bằng cách ngừng sử dụng và yêu cầu xoá tài khoản.</li>
        </ul>
      </section>
      <section>
        <h2>6. Cookie</h2>
        <p>Chúng tôi chỉ dùng cookie cần thiết cho đăng nhập và lưu tuỳ chọn giao diện/ngôn ngữ. Không dùng cookie quảng cáo hay theo dõi bên thứ ba.</p>
      </section>
      <section>
        <h2>7. Liên hệ</h2>
        <p>
          Mọi yêu cầu về dữ liệu cá nhân xin gửi tới <a href={`mailto:${business.email}`}>{business.email}</a>.
        </p>
      </section>
    </LegalPage>
  );
}

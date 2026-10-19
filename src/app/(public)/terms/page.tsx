import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal";
import { business } from "@/lib/business";

export const metadata: Metadata = { title: "Điều khoản sử dụng" };

export default function TermsPage() {
  return (
    <LegalPage title="Điều khoản sử dụng">
      <p>
        Chào mừng bạn đến với <strong>{business.brand}</strong> ({business.domain}), dịch vụ do <strong>{business.legalName}</strong> (MST {business.taxId}) cung cấp. Khi tạo tài khoản hoặc sử dụng dịch vụ, bạn đồng ý với các điều khoản dưới đây.
      </p>
      <section>
        <h2>1. Dịch vụ</h2>
        <p>
          {business.brand} là ứng dụng web giúp người dùng quản lý mục tiêu, theo dõi thói quen, lập kế hoạch hằng ngày, ghi nhật ký suy ngẫm và tham gia cộng đồng kỷ luật. Dịch vụ có gói miễn phí (Free) và các gói trả phí (Pro, Team) với tính năng mở rộng như mô tả tại{" "}
          <Link href="/pricing">Bảng giá</Link>.
        </p>
      </section>
      <section>
        <h2>2. Tài khoản</h2>
        <ul>
          <li>Bạn đăng nhập bằng tài khoản Google và chịu trách nhiệm bảo mật tài khoản đó.</li>
          <li>Bạn phải từ đủ 13 tuổi; người dưới 18 tuổi cần có sự đồng ý của cha mẹ hoặc người giám hộ.</li>
          <li>Mỗi người chỉ sử dụng một tài khoản cá nhân; không chia sẻ hoặc bán lại tài khoản.</li>
        </ul>
      </section>
      <section>
        <h2>3. Thanh toán & gia hạn</h2>
        <ul>
          <li>Gói trả phí được thanh toán trước theo tháng hoặc theo năm qua chuyển khoản ngân hàng (VietQR) thông qua đối tác thanh toán.</li>
          <li>Gói được kích hoạt ngay khi hệ thống xác nhận đã nhận đủ tiền. Gói <strong>không tự động gia hạn</strong>; khi hết hạn, tài khoản tự chuyển về gói Free và dữ liệu được giữ nguyên.</li>
          <li>Giá có thể thay đổi; thay đổi không ảnh hưởng tới kỳ bạn đã thanh toán.</li>
          <li>Chính sách hoàn tiền xem tại <Link href="/refund">Chính sách hoàn tiền</Link>.</li>
        </ul>
      </section>
      <section>
        <h2>4. Nội dung của bạn</h2>
        <ul>
          <li>Bạn sở hữu toàn bộ nội dung mình tạo ra (mục tiêu, nhật ký, bài viết, hình ảnh). Bạn có thể xuất dữ liệu bất cứ lúc nào trong phần Cài đặt.</li>
          <li>Với nội dung bạn chọn chia sẻ công khai trong Cộng đồng, bạn cấp cho chúng tôi quyền hiển thị nội dung đó trong phạm vi dịch vụ.</li>
          <li>Nhật ký cá nhân và nội dung đặt chế độ riêng tư không được hiển thị cho người khác, kể cả quản trị viên gói Team.</li>
        </ul>
      </section>
      <section>
        <h2>5. Quy tắc cộng đồng</h2>
        <p>Không đăng nội dung vi phạm pháp luật Việt Nam, xúc phạm, quấy rối, phân biệt đối xử, khiêu dâm, spam/quảng cáo, hoặc vi phạm quyền sở hữu trí tuệ của người khác. Chúng tôi có quyền ẩn nội dung và tạm khoá tài khoản vi phạm.</p>
      </section>
      <section>
        <h2>6. Giới hạn trách nhiệm</h2>
        <p>
          Dịch vụ được cung cấp &quot;nguyên trạng&quot;. {business.brand} là công cụ hỗ trợ thói quen và năng suất, không thay thế tư vấn y tế, tâm lý hay chuyên môn. Chúng tôi nỗ lực đảm bảo dịch vụ hoạt động ổn định nhưng không chịu trách nhiệm cho thiệt hại gián tiếp phát sinh từ việc sử dụng dịch vụ.
        </p>
      </section>
      <section>
        <h2>7. Chấm dứt</h2>
        <p>Bạn có thể ngừng sử dụng và yêu cầu xoá tài khoản bất kỳ lúc nào qua email hỗ trợ. Chúng tôi có thể chấm dứt tài khoản vi phạm nghiêm trọng điều khoản này.</p>
      </section>
      <section>
        <h2>8. Liên hệ</h2>
        <p>
          {business.legalName} · {business.address} · {business.email} · {business.phone}
        </p>
      </section>
    </LegalPage>
  );
}

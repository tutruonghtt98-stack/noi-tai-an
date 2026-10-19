import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { business } from "@/lib/business";

export const metadata: Metadata = { title: "Chính sách hoàn tiền" };

export default function RefundPage() {
  return (
    <LegalPage title="Chính sách hoàn tiền">
      <p>Chúng tôi muốn bạn chỉ trả tiền cho thứ thực sự giúp ích. Vì vậy {business.brand} áp dụng chính sách hoàn tiền rõ ràng như sau.</p>
      <section>
        <h2>1. Hoàn tiền trong 7 ngày</h2>
        <p>
          Với <strong>lần mua gói trả phí đầu tiên</strong> (Pro hoặc Team, theo tháng hoặc theo năm), bạn được hoàn <strong>100%</strong> nếu gửi yêu cầu trong vòng <strong>7 ngày</strong> kể từ khi thanh toán thành công.
        </p>
      </section>
      <section>
        <h2>2. Sau 7 ngày</h2>
        <ul>
          <li>Gói tháng: không hoàn tiền phần còn lại của kỳ.</li>
          <li>Gói năm: hoàn tiền theo tỷ lệ số tháng chưa sử dụng (tính tròn tháng), trừ phí giao dịch nếu có.</li>
        </ul>
      </section>
      <section>
        <h2>3. Trường hợp đặc biệt</h2>
        <ul>
          <li>Thanh toán trùng hoặc chuyển nhầm số tiền: hoàn đầy đủ phần chênh lệch.</li>
          <li>Đã chuyển khoản nhưng gói chưa được kích hoạt sau 24 giờ: liên hệ để được kích hoạt thủ công hoặc hoàn tiền.</li>
          <li>Tài khoản bị khoá do vi phạm Điều khoản sử dụng: không áp dụng hoàn tiền.</li>
        </ul>
      </section>
      <section>
        <h2>4. Cách yêu cầu</h2>
        <p>
          Gửi email tới <a href={`mailto:${business.email}`}>{business.email}</a> với tiêu đề &quot;Hoàn tiền – mã đơn NTAxxxxxx&quot;, kèm email tài khoản và số tài khoản nhận tiền. Chúng tôi phản hồi trong 2 ngày làm việc và hoàn tiền qua chuyển khoản ngân hàng trong tối đa 7 ngày làm việc kể từ khi xác nhận.
        </p>
      </section>
      <section>
        <h2>5. Sau khi hoàn tiền</h2>
        <p>Tài khoản chuyển về gói Free ngay khi hoàn tiền. Toàn bộ dữ liệu của bạn được giữ nguyên.</p>
      </section>
    </LegalPage>
  );
}

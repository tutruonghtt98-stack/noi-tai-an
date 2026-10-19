/**
 * Thông tin pháp lý hiển thị trên các trang chính sách & footer.
 * Điền qua biến môi trường để không phải sửa code. Cổng thanh toán (PayOS/SePay)
 * thường yêu cầu các thông tin này hiển thị công khai trước khi duyệt merchant.
 */
export const business = {
  brand: "Nội Tại Ẩn",
  legalName: process.env.BUSINESS_LEGAL_NAME || "[Tên hộ kinh doanh / công ty]",
  taxId: process.env.BUSINESS_TAX_ID || "[Mã số thuế]",
  address: process.env.BUSINESS_ADDRESS || "[Địa chỉ đăng ký kinh doanh]",
  email: process.env.SUPPORT_EMAIL || "hotro@ten-mien.vn",
  phone: process.env.SUPPORT_PHONE || "[Số điện thoại hỗ trợ]",
  domain: (process.env.AUTH_URL || "https://ten-mien.vn").replace(/^https?:\/\//, "").replace(/\/$/, ""),
  updated: "19/10/2026",
};

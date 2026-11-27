-- AlterTable: thêm cột dùng thử (chỉ ADD, không đụng cột nào khác)
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- CreateTable: bảng cấu hình giá gói Pro
CREATE TABLE "AppSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "proPriceMonthly" INTEGER NOT NULL DEFAULT 35000,
    "proPriceYearly" INTEGER NOT NULL DEFAULT 350000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

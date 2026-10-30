import type { Metadata } from "next";
import { Package } from "lucide-react";
import { requireUser } from "@/lib/session";
import { WorkPlaceholder } from "@/components/work-placeholder";

export const metadata: Metadata = { title: "Đơn hàng" };

export default async function WorkOrdersPage() {
  await requireUser();
  return <WorkPlaceholder icon={Package} titleKey="orders" />;
}

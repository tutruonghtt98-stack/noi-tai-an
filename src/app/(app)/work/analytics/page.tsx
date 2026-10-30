import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { requireUser } from "@/lib/session";
import { WorkPlaceholder } from "@/components/work-placeholder";

export const metadata: Metadata = { title: "Phân tích" };

export default async function WorkAnalyticsPage() {
  await requireUser();
  return <WorkPlaceholder icon={ChartColumn} titleKey="analytics" />;
}

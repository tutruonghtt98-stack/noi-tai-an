import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { requireUser } from "@/lib/session";
import { WorkPlaceholder } from "@/components/work-placeholder";

export const metadata: Metadata = { title: "Tự động hoá" };

export default async function WorkAutomationsPage() {
  await requireUser();
  return <WorkPlaceholder icon={Workflow} titleKey="automations" />;
}

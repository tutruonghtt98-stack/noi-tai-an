import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Suy ngẫm" };

export default async function Page() {
  const { t } = await getI18n();
  return <ComingSoon icon={NotebookPen} title={t.nav.reflection} text={t.soon.reflection} phase={2} t={t} />;
}

import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Phân tích" };

export default async function Page() {
  const { t } = await getI18n();
  return <ComingSoon icon={ChartColumn} title={t.nav.analytics} text={t.soon.analytics} phase={2} t={t} />;
}

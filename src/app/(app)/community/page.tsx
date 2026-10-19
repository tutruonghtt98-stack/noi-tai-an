import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Cộng đồng" };

export default async function Page() {
  const { t } = await getI18n();
  return <ComingSoon icon={Users} title={t.nav.community} text={t.soon.community} phase={3} t={t} />;
}

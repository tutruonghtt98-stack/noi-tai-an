import type { LucideIcon } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { ComingSoon } from "@/components/coming-soon";

export async function WorkPlaceholder({ icon, titleKey }: { icon: LucideIcon; titleKey: keyof Awaited<ReturnType<typeof getI18n>>["t"]["work"]["nav"] }) {
  const { t } = await getI18n();
  return <ComingSoon icon={icon} title={t.work.nav[titleKey]} text={t.work.customersSoon} phase={2} t={t} />;
}

import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import {
  getFinanceDashboard,
  getFinanceSavingsGoals,
  getFinanceTransactionsWindow,
  runDueRecurringRules,
} from "@/lib/finance-queries";
import { PageHeader } from "@/components/page-header";
import { FinanceControls } from "./finance-controls";
import { getI18n } from "@/lib/i18n";
import { isoInZone } from "@/lib/dates";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { title: "Tài chính" };

export default async function FinancePage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const today = isoInZone(new Date(), user.timezone);

  await runDueRecurringRules(user.id, user.timezone);
  const [dashboard, transactionsWindow, savingsGoals] = await Promise.all([
    getFinanceDashboard(user.id, user.timezone),
    getFinanceTransactionsWindow(user.id, user.timezone),
    getFinanceSavingsGoals(user.id),
  ]);

  return (
    <>
      <PageHeader title={t.nav.finance} subtitle={t.finance.subtitle} />
      <FinanceControls
        dashboard={dashboard}
        today={today}
        transactionsWindow={transactionsWindow}
        savingsGoals={savingsGoals}
        timezone={user.timezone}
        weekStartsOn={user.weekStartsOn}
      />
    </>
  );
}

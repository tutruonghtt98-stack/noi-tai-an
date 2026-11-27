import { getI18n } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { CommunityTabs } from "./tabs";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.community.title} subtitle={t.community.subtitle} />
      <CommunityTabs profileHref={user.username ? `/u/${user.username}` : "/settings#privacy"} />
      {children}
    </>
  );
}

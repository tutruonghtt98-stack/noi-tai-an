import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

export default async function WorkDashboardPage() {
  await requireUser();
  redirect("/work/customers");
}

import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/session";
import { WorkPlaceholder } from "@/components/work-placeholder";

export const metadata: Metadata = { title: "Tin nhắn" };

export default async function WorkMessagesPage() {
  await requireUser();
  return <WorkPlaceholder icon={MessageSquare} titleKey="messages" />;
}

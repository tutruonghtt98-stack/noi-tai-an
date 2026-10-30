import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/session";
import { WorkPlaceholder } from "@/components/work-placeholder";

export const metadata: Metadata = { title: "Sản phẩm" };

export default async function WorkProductsPage() {
  await requireUser();
  return <WorkPlaceholder icon={ShoppingBag} titleKey="products" />;
}

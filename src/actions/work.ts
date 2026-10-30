"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  city: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  channel: z.enum(["ONLINE", "IN_STORE"]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CustomerInput = z.input<typeof customerSchema>;

export async function createWorkCustomer(input: CustomerInput) {
  return run(async () => {
    const user = await requireUser();
    const data = customerSchema.parse(input);
    await db.workCustomer.create({ data: { ...data, userId: user.id } });
    revalidatePath("/work/customers");
  });
}

export async function deleteWorkCustomer(id: string) {
  return run(async () => {
    const user = await requireUser();
    const row = await db.workCustomer.findUnique({ where: { id }, select: { userId: true } });
    if (!row || row.userId !== user.id) throw new UserError("VALIDATION");
    await db.workCustomer.delete({ where: { id } });
    revalidatePath("/work/customers");
  });
}

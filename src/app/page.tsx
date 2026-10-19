import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/session";

export default async function Home() {
  redirect((await getOptionalUser()) ? "/dashboard" : "/login");
}

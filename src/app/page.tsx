import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";

export default async function Home() {
  await requireProfile();
  redirect("/admin");
}

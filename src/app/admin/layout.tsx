import { requireAdmin } from "@/lib/session";
import TopBar from "@/components/TopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <>
      <TopBar profile={profile} />
      {children}
    </>
  );
}

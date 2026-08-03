import { requireAdmin } from "@/lib/session";
import TopBar from "@/components/TopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <>
      <TopBar />
      {children}
    </>
  );
}

import Link from "next/link";
import LoginForm from "./LoginForm";
import Logo from "@/components/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-ink text-accent flex items-center justify-center">
            <Logo className="w-8 h-7" />
          </div>
          <div className="text-center">
            <p className="font-extrabold text-lg tracking-tight">ATG Trucking LLC</p>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted">
              Fleet Management
            </p>
          </div>
        </div>
        <LoginForm next={next ?? "/"} />
        <Link
          href="/clock"
          className="mt-4 block rounded-md border border-border bg-surface text-ink font-bold text-sm py-2.5 text-center hover:bg-surface-2"
        >
          Clock In / Out
        </Link>
      </div>
    </main>
  );
}

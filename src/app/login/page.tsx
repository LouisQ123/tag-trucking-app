import LoginForm from "./LoginForm";

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
          <div className="w-12 h-12 rounded-lg bg-ink text-accent flex items-center justify-center font-extrabold text-sm">
            ATG
          </div>
          <div className="text-center">
            <p className="font-extrabold text-lg tracking-tight">ATG Trucking LLC</p>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted">
              Driver Production
            </p>
          </div>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}

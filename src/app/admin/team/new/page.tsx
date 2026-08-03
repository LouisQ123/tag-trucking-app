import NewAdminForm from "./NewAdminForm";

export default function NewAdminPage() {
  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Add Admin</h1>
        <p className="text-sm text-ink-2 mt-0.5">Creates a new account that can sign in and manage the fleet.</p>
      </div>
      <NewAdminForm />
    </main>
  );
}

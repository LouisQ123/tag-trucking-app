import NewClientForm from "./NewClientForm";

export default function NewClientPage() {
  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Add Client</h1>
        <p className="text-sm text-ink-2 mt-0.5">Billing info for the &quot;Bill To&quot; box on an invoice.</p>
      </div>
      <NewClientForm />
    </main>
  );
}

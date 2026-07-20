import NewDriverForm from "./NewDriverForm";

export default function NewDriverPage() {
  return (
    <main className="max-w-lg mx-auto px-5 py-7">
      <h1 className="text-xl font-extrabold tracking-tight mb-0.5">Add Driver</h1>
      <p className="text-sm text-ink-2 mb-6">
        Creates a login for this driver. Share the temporary password with them directly — they can
        change it from their Account page.
      </p>
      <NewDriverForm />
    </main>
  );
}

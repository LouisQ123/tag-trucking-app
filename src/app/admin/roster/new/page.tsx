import NewDriverForm from "./NewDriverForm";

export default function NewRosterDriverPage() {
  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Add Driver</h1>
        <p className="text-sm text-ink-2 mt-0.5">Adds them to the roster and the driver picker on sheets.</p>
      </div>
      <NewDriverForm />
    </main>
  );
}

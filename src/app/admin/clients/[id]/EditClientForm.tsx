"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateClientEntry, deleteClientEntry } from "@/lib/actions/clients";
import type { ActionState } from "@/lib/actions/auth";
import type { Client } from "@/lib/types/database";
import PhoneInput from "@/components/PhoneInput";

const initialState: ActionState = {};

export default function EditClientForm({ client }: { client: Client }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateClientEntry, initialState);
  const [removing, setRemoving] = useState(false);

  const [lastHandledState, setLastHandledState] = useState(state);
  const [saved, setSaved] = useState(false);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) setSaved(true);
  }

  async function handleRemove() {
    if (!confirm(`Remove ${client.name} from clients? This can't be undone.`)) return;
    setRemoving(true);
    try {
      await deleteClientEntry(client.id);
      router.push("/admin/clients");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={client.id} />

      <Section title="Client">
        <Grid>
          <Field label="Name">
            <input name="name" defaultValue={client.name} required className="input" />
          </Field>
          <Field label="Company">
            <input
              name="company"
              defaultValue={client.company ?? ""}
              placeholder="Business name, if different from contact"
              className="input"
            />
          </Field>
          <Field label="Address">
            <input
              name="address_line1"
              defaultValue={client.address_line1 ?? ""}
              placeholder="Street address"
              className="input"
            />
          </Field>
          <Field label="City, State ZIP">
            <input name="city_state_zip" defaultValue={client.city_state_zip ?? ""} className="input" />
          </Field>
          <Field label="Phone">
            <PhoneInput name="phone" defaultValue={client.phone ?? ""} />
          </Field>
          <Field label="Fax">
            <PhoneInput name="fax" defaultValue={client.fax ?? ""} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={client.email ?? ""} className="input" />
          </Field>
          <Field label="Default Rate ($/hr)">
            <input
              name="default_rate"
              type="number"
              min={0}
              step={0.25}
              defaultValue={client.default_rate ?? ""}
              className="input"
            />
          </Field>
        </Grid>
      </Section>

      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          className="text-xs font-bold text-critical/70 hover:text-critical disabled:opacity-50"
        >
          {removing ? "Removing…" : "Remove client"}
        </button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-semibold text-good">Saved.</span>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3.5">{title}</p>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
    </div>
  );
}

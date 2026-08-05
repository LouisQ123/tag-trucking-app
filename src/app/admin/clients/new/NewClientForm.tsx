"use client";

import { useActionState } from "react";
import { createClientEntry } from "@/lib/actions/clients";
import type { ActionState } from "@/lib/actions/auth";
import PhoneInput from "@/components/PhoneInput";

const initialState: ActionState = {};

export default function NewClientForm() {
  const [state, formAction, pending] = useActionState(createClientEntry, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Section title="Client">
        <Grid>
          <Field label="Name">
            <input name="name" required className="input" />
          </Field>
          <Field label="Company">
            <input name="company" placeholder="Business name, if different from contact" className="input" />
          </Field>
          <Field label="Address">
            <input name="address_line1" placeholder="Street address" className="input" />
          </Field>
          <Field label="City, State ZIP">
            <input name="city_state_zip" className="input" />
          </Field>
          <Field label="Phone">
            <PhoneInput name="phone" />
          </Field>
          <Field label="Fax">
            <PhoneInput name="fax" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className="input" />
          </Field>
          <Field label="Default Rate ($/hr)">
            <input name="default_rate" type="number" min={0} step={0.25} className="input" />
          </Field>
        </Grid>
      </Section>

      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add Client"}
      </button>
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

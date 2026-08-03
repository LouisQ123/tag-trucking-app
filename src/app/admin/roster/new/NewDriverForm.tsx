"use client";

import { useActionState } from "react";
import { createDriver } from "@/lib/actions/roster";
import type { ActionState } from "@/lib/actions/auth";
import DateInput from "@/components/DateInput";
import PhoneInput from "@/components/PhoneInput";

const initialState: ActionState = {};

export default function NewDriverForm() {
  const [state, formAction, pending] = useActionState(createDriver, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Section title="Contact">
        <Grid>
          <Field label="Full Name">
            <input name="full_name" required className="input" />
          </Field>
          <Field label="Phone">
            <PhoneInput name="phone" />
          </Field>
          <Field label="Hourly Pay ($)">
            <input name="hourly_pay" type="number" min={0} step={0.25} className="input" />
          </Field>
        </Grid>
      </Section>

      <Section title="Compliance">
        <Grid>
          <Field label="CDL Number">
            <input name="cdl_number" className="input" />
          </Field>
          <Field label="License Expiration">
            <DateInput name="license_expiration" />
          </Field>
          <Field label="Medical Card Expiration">
            <DateInput name="medical_card_expiration" />
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
        {pending ? "Adding…" : "Add Driver"}
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

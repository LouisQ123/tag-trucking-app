"use client";

import { useActionState } from "react";
import { createDriver } from "@/lib/actions/drivers";
import type { ActionState } from "@/lib/actions/auth";

const initialState: ActionState = {};

export default function NewDriverForm() {
  const [state, formAction, pending] = useActionState(createDriver, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Section title="Login">
        <Grid>
          <Field label="Full Name">
            <input name="full_name" required className="input" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required className="input" />
          </Field>
          <Field label="Temporary Password" hint="At least 8 characters">
            <input name="password" type="text" required minLength={8} className="input" />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue="driver" className="input">
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="Assignment & Pay">
        <Grid>
          <Field label="Truck Number">
            <input name="truck_number" className="input" />
          </Field>
          <Field label="Hourly Pay ($)">
            <input name="hourly_pay" type="number" min={0} step={0.25} className="input" />
          </Field>
          <Field label="Phone" hint="Drivers can sign in with this instead of email">
            <input name="phone" type="tel" placeholder="(555) 555-5555" className="input" />
          </Field>
        </Grid>
      </Section>

      <Section title="Compliance">
        <Grid>
          <Field label="CDL Number">
            <input name="cdl_number" className="input" />
          </Field>
          <Field label="License Expiration">
            <input name="license_expiration" type="date" className="input" />
          </Field>
          <Field label="Medical Card Expiration">
            <input name="medical_card_expiration" type="date" className="input" />
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
        {pending ? "Creating…" : "Create Driver"}
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
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

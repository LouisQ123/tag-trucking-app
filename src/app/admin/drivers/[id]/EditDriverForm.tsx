"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateDriver } from "@/lib/actions/drivers";
import type { ActionState } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types/database";

const initialState: ActionState = {};

export default function EditDriverForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateDriver, initialState);

  // Turn the confirmation on during render (reacting to `state`, already
  // produced by this render) — turn it off later via a timer effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  const [saved, setSaved] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) setSaved(true);
  }

  useEffect(() => {
    if (!saved) return;
    if (passwordRef.current) passwordRef.current.value = "";
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={profile.id} />

      <Section title="Profile">
        <Grid>
          <Field label="Full Name">
            <input name="full_name" defaultValue={profile.full_name} required className="input" />
          </Field>
          <Field label="Email" hint="Used to sign in — changing this updates their login">
            <input name="email" type="email" defaultValue={profile.email ?? ""} required className="input" />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={profile.phone ?? ""} type="tel" className="input" />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue={profile.role} className="input">
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="Login">
        <Field label="Reset Password" hint="Leave blank to keep their current password. Share the new one with them directly.">
          <input
            ref={passwordRef}
            name="new_password"
            type="text"
            minLength={8}
            placeholder="Leave blank to keep current password"
            className="input"
          />
        </Field>
      </Section>

      <Section title="Assignment & Pay">
        <Grid>
          <Field label="Truck Number">
            <input name="truck_number" defaultValue={profile.truck_number ?? ""} className="input" />
          </Field>
          <Field label="Hourly Pay ($)">
            <input
              name="hourly_pay"
              type="number"
              min={0}
              step={0.25}
              defaultValue={profile.hourly_pay ?? ""}
              className="input"
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Compliance">
        <Grid>
          <Field label="CDL Number">
            <input name="cdl_number" defaultValue={profile.cdl_number ?? ""} className="input" />
          </Field>
          <Field label="License Expiration">
            <input
              name="license_expiration"
              type="date"
              defaultValue={profile.license_expiration ?? ""}
              className="input"
            />
          </Field>
          <Field label="Medical Card Expiration">
            <input
              name="medical_card_expiration"
              type="date"
              defaultValue={profile.medical_card_expiration ?? ""}
              className="input"
            />
          </Field>
        </Grid>
      </Section>

      <label className="flex items-center gap-2.5 bg-surface border border-border rounded-xl px-4 py-3.5 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={profile.active} className="w-4 h-4 accent-[var(--accent)]" />
        Active — can sign in and submit sheets
      </label>

      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        {saved && <span className="text-sm font-semibold text-good">Saved.</span>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
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
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { createAdminUser } from "@/lib/actions/admins";
import type { ActionState } from "@/lib/actions/auth";

const initialState: ActionState = {};

export default function NewAdminForm() {
  const [state, formAction, pending] = useActionState(createAdminUser, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3.5">
        <Field label="Full Name">
          <input name="full_name" required className="input" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className="input" />
        </Field>
        <Field label="Temporary Password" hint="At least 8 characters">
          <input name="password" type="text" required minLength={8} className="input" />
        </Field>
        <Field label="Phone" hint="Can sign in with this instead of email">
          <input name="phone" type="tel" placeholder="(555) 555-5555" className="input" />
        </Field>
      </div>

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
        {pending ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
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

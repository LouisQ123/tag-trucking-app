"use client";

import { useActionState } from "react";
import { signIn, type ActionState } from "@/lib/actions/auth";

const initialState: ActionState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form
      action={formAction}
      className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide text-ink-2">
          Email or Phone Number
        </label>
        <input
          id="email"
          name="email"
          type="text"
          required
          autoComplete="username"
          placeholder="you@company.com or (555) 555-5555"
          className="rounded-md border border-border bg-page px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-ink-2">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-border bg-page px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {state.error && <p className="text-sm text-critical">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-accent text-accent-ink font-bold text-sm py-2.5 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign In"}
      </button>
      <p className="text-xs text-muted text-center leading-relaxed">
        New driver accounts are created by your dispatcher. Contact them if you
        don&apos;t have a login yet.
      </p>
    </form>
  );
}

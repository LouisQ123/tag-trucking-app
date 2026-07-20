"use client";

import { useActionState, useEffect, useState } from "react";
import { changePassword, type ActionState } from "@/lib/actions/auth";

const initialState: ActionState = {};

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  // Turn the confirmation on during render (reacting to `state`, already
  // produced by this render) — turn it off later via a timer effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  const [done, setDone] = useState(false);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) setDone(true);
  }

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 3000);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-ink-2">
          New Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-border bg-page px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-xs font-bold uppercase tracking-wide text-ink-2">
          Confirm Password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-border bg-page px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {state.error && <p className="text-sm text-critical">{state.error}</p>}
      {done && <p className="text-sm text-good">Password updated.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent text-accent-ink font-bold text-sm px-4 py-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update Password"}
      </button>
    </form>
  );
}

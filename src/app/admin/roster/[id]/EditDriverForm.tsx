"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDriver, deleteDriver } from "@/lib/actions/roster";
import { setDriverPin, clearDriverPin } from "@/lib/actions/timeclock";
import type { ActionState } from "@/lib/actions/auth";
import type { Driver } from "@/lib/types/database";
import DateInput from "@/components/DateInput";
import PhoneInput from "@/components/PhoneInput";

const initialState: ActionState = {};

export default function EditDriverForm({ driver, hasPin }: { driver: Driver; hasPin: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateDriver, initialState);
  const [removing, setRemoving] = useState(false);
  const [pinSet, setPinSet] = useState(hasPin);
  const [pinText, setPinText] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function savePin() {
    setPinBusy(true);
    setPinMessage(null);
    const result = await setDriverPin(driver.id, pinText);
    setPinBusy(false);
    if ("error" in result) {
      setPinMessage({ ok: false, text: result.error });
      return;
    }
    setPinSet(true);
    setPinText("");
    setPinMessage({ ok: true, text: "PIN saved." });
  }

  async function removePin() {
    if (!confirm(`Remove ${driver.full_name}'s time clock PIN? They won't be able to clock in until you set a new one.`)) return;
    setPinBusy(true);
    setPinMessage(null);
    const result = await clearDriverPin(driver.id);
    setPinBusy(false);
    if ("error" in result) {
      setPinMessage({ ok: false, text: result.error });
      return;
    }
    setPinSet(false);
    setPinMessage({ ok: true, text: "PIN removed." });
  }

  const [lastHandledState, setLastHandledState] = useState(state);
  const [saved, setSaved] = useState(false);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) setSaved(true);
  }

  async function handleRemove() {
    if (!confirm(`Remove ${driver.full_name} from the roster? This can't be undone.`)) return;
    setRemoving(true);
    try {
      await deleteDriver(driver.id);
      router.push("/admin/roster");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={driver.id} />

      <Section title="Contact">
        <Grid>
          <Field label="Full Name">
            <input name="full_name" defaultValue={driver.full_name} required className="input" />
          </Field>
          <Field label="Phone">
            <PhoneInput name="phone" defaultValue={driver.phone ?? ""} />
          </Field>
          <Field label="Hourly Pay ($)">
            <input
              name="hourly_pay"
              type="number"
              min={0}
              step={0.25}
              defaultValue={driver.hourly_pay ?? ""}
              className="input"
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Time Clock">
        <p className="text-[12.5px] text-ink-2 mb-3">
          {pinSet ? "A PIN is set." : "No PIN yet."} They clock in and out from the login page with their name and this
          4-digit PIN — no account needed.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={pinText}
            onChange={(e) => setPinText(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="4 digits"
            aria-label="New PIN"
            autoComplete="off"
            className="input w-28"
          />
          <button
            type="button"
            onClick={savePin}
            disabled={pinBusy || pinText.length !== 4}
            className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2 disabled:opacity-60"
          >
            {pinSet ? "Change PIN" : "Set PIN"}
          </button>
          {pinSet && (
            <button
              type="button"
              onClick={removePin}
              disabled={pinBusy}
              className="text-xs font-bold text-critical/70 hover:text-critical disabled:opacity-50"
            >
              Remove PIN
            </button>
          )}
        </div>
        {pinMessage && (
          <p className={`text-sm font-semibold mt-2 ${pinMessage.ok ? "text-good" : "text-critical"}`}>
            {pinMessage.text}
          </p>
        )}
      </Section>

      <Section title="Compliance">
        <Grid>
          <Field label="CDL Number">
            <input name="cdl_number" defaultValue={driver.cdl_number ?? ""} className="input" />
          </Field>
          <Field label="License Expiration">
            <DateInput name="license_expiration" defaultValue={driver.license_expiration ?? ""} />
          </Field>
          <Field label="Medical Card Expiration">
            <DateInput name="medical_card_expiration" defaultValue={driver.medical_card_expiration ?? ""} />
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
          {removing ? "Removing…" : "Remove from roster"}
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

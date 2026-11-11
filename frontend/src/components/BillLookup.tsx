"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Consent, ErrorBox } from "./ui";

const COMPANIES = ["LESCO", "IESCO", "FESCO", "GEPCO", "MEPCO", "PESCO", "HESCO", "SEPCO", "QESCO", "TESCO", "HAZECO"];

/** Fetch a duplicate bill from the official PITC portal by 14-digit reference number. */
export default function BillLookup<T>({ onResult, consent: outerConsent }: { onResult: (r: T) => void; consent?: boolean }) {
  const [disco, setDisco] = useState("LESCO");
  const [ref, setRef] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agreed = outerConsent || consent;
  const digits = ref.replace(/\D/g, "");

  async function go() {
    setBusy(true); setError(null);
    try { onResult(await api.post<T>("/bill/lookup", { disco, reference: digits, consent: agreed })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-line p-4 space-y-3">
      <p className="font-medium">Or fetch it with your reference number</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="disco">Electricity company</label>
          <select id="disco" value={disco} onChange={(e) => setDisco(e.target.value)}>
            {COMPANIES.map((c) => <option key={c}>{c}</option>)}
            <option value="K-Electric">K-Electric (upload a photo instead)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="refno">14-digit reference number (top of your bill)</label>
          <input id="refno" inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="12 11234 5678901 U" />
        </div>
      </div>
      {!outerConsent && <Consent checked={consent} onChange={setConsent} />}
      <ErrorBox error={error} />
      <Button onClick={go} disabled={busy || digits.length !== 14 || !agreed || disco === "K-Electric"}>
        {busy ? "Fetching from the official portal…" : "Fetch my bill"}
      </Button>
      <p className="text-xs text-muted">
        Roshni requests your duplicate bill from the official PITC portal (bill.pitc.com.pk), once, on your request. We don&apos;t store your
        reference number. If the portal asks for a CAPTCHA, we stop and ask you to upload a photo instead.
      </p>
    </div>
  );
}

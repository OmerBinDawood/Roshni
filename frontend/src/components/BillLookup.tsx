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
  const raw = ref.replace(/\D/g, "");
  const digits = raw.length === 15 ? raw.slice(0, 14) : raw; // a trailing 15th digit takes the place of the letter on some bills
  const reasons = [
    ...(digits.length !== 14 ? [`the reference needs 14 digits (you typed ${raw.length})`] : []),
    ...(!agreed ? ["tick the AI consent box"] : []),
    ...(disco === "K-Electric" ? ["K-Electric bills must be uploaded as a photo"] : []),
  ];

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
      {reasons.length > 0 && !busy && <p className="text-sm font-medium text-warn">To continue: {reasons.join("; ")}.</p>}
      {raw.length === 15 && <p className="text-xs text-muted">15 digits entered: Roshni will use the first 14 (the last character on a bill is often a letter).</p>}
      <p className="text-xs text-muted">
        Roshni requests your duplicate bill from the official PITC portal (bill.pitc.com.pk), once, on your request. We don&apos;t store your
        reference number. If the portal asks for a CAPTCHA, we stop and ask you to upload a photo instead.
      </p>
    </div>
  );
}

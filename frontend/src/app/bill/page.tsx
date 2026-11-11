"use client";
import { useState } from "react";
import BillLookup from "@/components/BillLookup";
import FilePick from "@/components/FilePick";
import { Button, Card, Consent, ErrorBox, Issues } from "@/components/ui";
import { api, rs, type Bill } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Line = { label: string; amount_rs: number | null; explanation_en: string; explanation_ur: string; solar_can_reduce: "yes" | "partly" | "no" };
type Decoded = { bill: Bill; lines: Line[]; protected_threshold: number; units_to_threshold: number | null; rules_as_of: string; warnings: string[] };

export default function BillPage() {
  const { lang, t } = useLang();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Decoded | null>(null);

  async function decode() {
    setBusy(true); setError(null);
    const fd = new FormData(); fd.append("file", files[0]); fd.append("consent", String(consent));
    try { setD(await api.upload<Decoded>("/extract/bill", fd)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const b = d?.bill;
  const hist = b?.monthly_units_history ?? [];
  const max = Math.max(...hist, d?.protected_threshold ?? 200, 1);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("decodeBill")} <span className="urdu font-normal text-muted">· اپنا بل سمجھیں</span></h1>
      <ErrorBox error={error} />
      {!d && (
        <Card className="space-y-3">
          <FilePick files={files} onChange={setFiles} multiple={false} label="Upload a photo or PDF of your electricity bill" />
          <p className="text-xs text-muted">Your name, address and reference number are not stored or shown.</p>
          <Consent checked={consent} onChange={setConsent} />
          <Button onClick={decode} disabled={busy || !files.length || !consent}>{busy ? t("working") : "Explain my bill"}</Button>
        </Card>
      )}
      {!d && (
        <BillLookup<Decoded> onResult={setD} />
      )}
      {d && b && (
        <>
          <Issues issues={(d.warnings ?? []).map((msg) => ({ level: "warn", msg }))} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Card><div className="text-sm text-muted">This month</div><div className="text-2xl font-bold">{b.current_units ?? "–"} units</div><div className="text-sm text-muted">{b.provider} · {b.tariff_category}</div></Card>
            <Card><div className="text-sm text-muted">Total payable</div><div className="text-2xl font-bold">{rs(b.total_amount_rs)}</div>
              <div className="text-sm text-muted">{b.current_units && b.total_amount_rs ? `≈ Rs ${(b.total_amount_rs / b.current_units).toFixed(1)} per unit all-in` : ""}</div></Card>
            <Card className={d.units_to_threshold != null && d.units_to_threshold >= 0 && d.units_to_threshold < 30 ? "border-warn" : ""}>
              <div className="text-sm text-muted">200-unit protected limit</div>
              <div className="text-2xl font-bold">{d.units_to_threshold == null ? "–" : d.units_to_threshold >= 0 ? `${d.units_to_threshold} units below` : `${-d.units_to_threshold} units above`}</div>
              <div className="text-sm text-muted">{b.protected ? "You are shown as protected." : "Not shown as protected."} Crossing 200 once can cost protected status for 6 months.</div>
            </Card>
          </div>

          {hist.length > 0 && (
            <Card>
              <h2 className="font-semibold">Your last {hist.length} months</h2>
              <div className="relative mt-3 h-36 flex items-end gap-1" dir="ltr">
                <div className="absolute inset-x-0 border-t-2 border-dashed border-warn" style={{ bottom: `${(d.protected_threshold / max) * 100}%` }}>
                  <span className="absolute -top-5 end-0 text-xs text-warn">200 units</span>
                </div>
                {hist.map((u, i) => <div key={i} className={`flex-1 rounded-t ${u > d.protected_threshold ? "bg-sun" : "bg-leaf/70"}`} style={{ height: `${(u / max) * 100}%` }} title={`${u} units`} />)}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold">Every line, explained</h2>
            <ul className="mt-2 divide-y divide-line">
              {d.lines.map((l, i) => (
                <li key={i} className="py-3 flex gap-3 justify-between">
                  <div>
                    <div className="font-medium">{l.label}</div>
                    <p className={`text-sm ${lang === "ur" ? "urdu" : "text-muted"}`} dir="auto">{lang === "ur" ? l.explanation_ur : l.explanation_en}</p>
                    <span className={`text-xs ${l.solar_can_reduce === "no" ? "text-bad" : l.solar_can_reduce === "yes" ? "text-leaf" : "text-warn"}`}>
                      {l.solar_can_reduce === "no" ? "Solar cannot remove this" : l.solar_can_reduce === "yes" ? "Solar can reduce this" : "Solar can partly reduce this"}
                    </span>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{rs(l.amount_rs)}</div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Rules as of {d.rules_as_of}. Explanations are AI-generated from your bill; amounts are as printed.</p>
          </Card>
          <div className="flex gap-2">
            <Button onClick={() => { setD(null); setFiles([]); }} variant="ghost">Decode another bill</Button>
            <Button onClick={() => window.dispatchEvent(new Event("roshni:open-assistant"))}>💬 Ask about my bill</Button>
          </div>
        </>
      )}
    </div>
  );
}

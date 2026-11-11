"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, ErrorBox } from "@/components/ui";
import { api, rs } from "@/lib/api";
import { deviceReports, useSession, type DeviceReport } from "@/lib/supabase";

type Row = {
  id: string; title: string; mode: string; total_rs: number | null; dc_kwp: number; inverter_kw: number | null; inverter_type: string;
  battery_usable_kwh: number; rs_per_w_system: number | null; rs_per_w_panels: number | null; rs_per_usable_kwh_battery: number | null;
  savings_monthly: { low: number; expected: number; high: number } | null; payback_years: number | null; net_10y: number | null;
  critical: number; clarify: number; verdict: "red" | "amber" | "green"; works_in_outage: boolean; backup_hours: number; critical_titles: string[];
};
type Result = { rows: Row[]; notes: string[]; note: string };
const SEV = { red: "CRITICAL", amber: "CLARIFY", green: "OK" } as const;

export default function Page() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Compare /></Suspense>;
}

function idFromInput(s: string): string | null {
  const m = s.trim().match(/report\/([a-f0-9]{8,24})/i) || s.trim().match(/^([a-f0-9]{8,24})$/i);
  return m ? m[1] : null;
}

function Compare() {
  const params = useSearchParams();
  const { session } = useSession();
  const [choices, setChoices] = useState<DeviceReport[]>([]);
  const [picked, setPicked] = useState<string[]>(() => (params.get("ids") || "").split(",").filter(Boolean).slice(0, 4));
  const [paste, setPaste] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const local = deviceReports.list();
    queueMicrotask(() => setChoices(local));
    if (session) {
      api.get<{ reports: { id: string; title: string | null; created_at: string | null }[] }>("/me/reports").then((r) => {
        const mine = r.reports.map((x) => ({ id: x.id, title: x.title || x.id, created: x.created_at || "" }));
        setChoices([...mine, ...local.filter((l) => !mine.some((m) => m.id === l.id))]);
      }).catch(() => {});
    }
  }, [session]);

  const key = picked.join(",");
  useEffect(() => {
    if (picked.length < 2) { queueMicrotask(() => setRes(null)); return; }
    let live = true;
    queueMicrotask(() => { setBusy(true); setError(null); });
    api.post<Result>("/compare", { ids: picked }).then((r) => live && setRes(r)).catch((e) => live && setError(e.message)).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));
  const addPasted = () => { const id = idFromInput(paste); if (id) { toggle(id); setPaste(""); } else setError("Paste a Roshni report link (…/report/abc123…)."); };

  const lines: [string, (r: Row) => React.ReactNode][] = useMemo(() => [
    ["Total price", (r) => rs(r.total_rs)],
    ["System size", (r) => `${r.dc_kwp} kWp · ${r.inverter_kw ?? "?"} kW ${r.inverter_type.replace("_", "-")}`],
    ["Price per watt (whole system)", (r) => (r.rs_per_w_system ? `Rs ${r.rs_per_w_system}/W` : "–")],
    ["Panels per watt", (r) => (r.rs_per_w_panels ? `Rs ${r.rs_per_w_panels}/W` : "–")],
    ["Battery (usable)", (r) => (r.battery_usable_kwh ? `${r.battery_usable_kwh} kWh${r.rs_per_usable_kwh_battery ? ` · ${rs(r.rs_per_usable_kwh_battery)}/kWh` : ""}` : "None")],
    ["Works in load-shedding", (r) => (r.works_in_outage ? (r.backup_hours ? `Yes, ~${r.backup_hours} h on battery` : "Daytime only") : "No")],
    ["Saving / month", (r) => (r.savings_monthly ? `${rs(r.savings_monthly.low)}–${rs(r.savings_monthly.high)}` : "–")],
    ["Payback", (r) => (r.payback_years ? `${r.payback_years} yrs` : "–")],
    ["Net after 10 years", (r) => rs(r.net_10y)],
    ["Issues found", (r) => `${r.critical} critical · ${r.clarify} to clarify`],
  ], []);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Compare quotes</h1>
      <p className="text-muted">Put up to four checked quotes side by side on the same basis: price per watt, price per usable battery kWh, the same tariff and your household.</p>
      <ErrorBox error={error} />
      <Card className="space-y-3">
        <h2 className="font-semibold">Pick 2–4 reports</h2>
        {choices.length === 0 && <p className="text-sm text-muted">No reports on this device yet. <Link className="underline" href="/audit">Check a quote</Link> first, or paste report links below.</p>}
        <div className="grid sm:grid-cols-2 gap-2">
          {choices.map((c) => (
            <label key={c.id} className="!text-ink !text-sm flex items-center gap-2 rounded-xl border border-line p-2">
              <input type="checkbox" className="w-4 h-4" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
              <span className="truncate">{c.title}</span>
              <span className="ms-auto text-muted text-xs">{c.created ? new Date(c.created).toLocaleDateString("en-PK") : ""}</span>
            </label>
          ))}
          {picked.filter((p) => !choices.some((c) => c.id === p)).map((p) => (
            <label key={p} className="!text-ink !text-sm flex items-center gap-2 rounded-xl border border-line p-2">
              <input type="checkbox" className="w-4 h-4" checked onChange={() => toggle(p)} /><span>Report {p}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input aria-label="Paste a report link" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a report link to add it" />
          <Button variant="ghost" onClick={addPasted} disabled={!paste.trim()}>Add</Button>
        </div>
        <p className="text-sm"><Link className="underline" href={picked[0] ? `/audit?compare=${picked[0]}` : "/audit"}>+ Check another quote and compare</Link></p>
      </Card>

      {busy && <p className="text-muted">Comparing…</p>}
      {res && (
        <>
          {res.notes.length > 0 && (
            <Card><ul className="space-y-1">{res.notes.map((n) => <li key={n}>💡 {n}</li>)}</ul></Card>
          )}
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-start p-3 w-44"></th>
                  {res.rows.map((r) => (
                    <th key={r.id} className="text-start p-3 align-top">
                      <Link href={`/report/${r.id}`} className="font-semibold underline">{r.title}</Link>
                      <div className="mt-1"><Badge severity={SEV[r.verdict]} /></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(([label, fn]) => (
                  <tr key={label} className="border-t border-line">
                    <td className="p-3 text-muted">{label}</td>
                    {res.rows.map((r) => <td key={r.id} className="p-3">{fn(r)}</td>)}
                  </tr>
                ))}
                <tr className="border-t border-line align-top">
                  <td className="p-3 text-muted">Critical issues</td>
                  {res.rows.map((r) => <td key={r.id} className="p-3 text-bad">{r.critical_titles.length ? r.critical_titles.map((t) => <div key={t}>• {t}</div>) : <span className="text-leaf">None</span>}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">{res.note} The cheapest quote is not always the best: check critical issues first.</p>
        </>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import FilePick from "@/components/FilePick";
import { Button, Card, Consent, ErrorBox, Num } from "@/components/ui";
import { api } from "@/lib/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Row = { month: string; actual: number; expected: number; expected_low: number; expected_high: number; ratio: number | null; status: "good" | "low" | "very_low" };
type Out = { verdict: "healthy" | "underperforming" | "seriously_low"; average_ratio: number | null; rows: Row[]; possible_causes: string[]; settings_checklist: string[]; note: string };
const V = {
  healthy: ["bg-leaf/10 border-leaf/40 text-leaf", "Your system looks healthy"],
  underperforming: ["bg-warn/10 border-warn/40 text-warn", "Your system is making less than expected"],
  seriously_low: ["bg-bad/10 border-bad/40 text-bad", "Your system is making far less than expected"],
} as const;

export default function Health() {
  const [cities, setCities] = useState<string[]>(["Lahore"]);
  const [city, setCity] = useState("Lahore");
  const [dc, setDc] = useState<number | null>(5);
  const [inv, setInv] = useState<number | null>(5);
  const [type, setType] = useState<"on_grid" | "hybrid" | "off_grid">("hybrid");
  const [facing, setFacing] = useState("180");
  const [readings, setReadings] = useState<{ month: number; kwh: number | null }[]>([{ month: 1, kwh: null }]);
  const [zeroExport, setZeroExport] = useState(false);
  const [billNotDropping, setBillNotDropping] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [shotNote, setShotNote] = useState<string | null>(null);
  useEffect(() => {
    api.get<{ cities: string[] }>("/meta").then((m) => setCities(m.cities)).catch(() => {});
    // Default to last month (computed in the browser, not during prerender)
    const last = new Date().getMonth() || 12;
    queueMicrotask(() => setReadings((r) => (r.length === 1 && r[0].kwh === null ? [{ month: last, kwh: null }] : r)));
  }, []);

  async function readShot() {
    setBusy(true); setError(null); setShotNote(null);
    const fd = new FormData(); shot.forEach((f) => fd.append("files", f)); fd.append("consent", String(consent));
    try {
      const r = await api.upload<{ readings: { month: number; kwh: number }[]; note: string | null }>("/extract/readings", fd);
      if (r.readings.length) setReadings(r.readings.map((x) => ({ month: x.month, kwh: x.kwh })));
      setShotNote((r.readings.length ? `Filled in ${r.readings.length} month(s) from your screenshot. Please check them against the app. ` : "No monthly values could be read. ") + (r.note ?? ""));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function go() {
    setBusy(true); setError(null);
    try {
      setOut(await api.post<Out>("/health-check", {
        city, dc_kw: dc, inverter_kw: inv, inverter_type: type, azimuth: Number(facing), tilt: facing === "flat" ? 5 : 20,
        readings: readings.filter((r) => r.kwh !== null).map((r) => ({ month: r.month, kwh: r.kwh })),
        zero_export: zeroExport, bill_not_dropping: billNotDropping,
      }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Is my solar system working properly?</h1>
      <p className="text-muted">For homes that already have solar. Enter how many units your panels made (from the inverter app, or the solar/generation meter) and Roshni compares it with what a healthy system of your size makes in your city.</p>
      <ErrorBox error={error} />
      <Card className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label htmlFor="hc-city">City</label><select id="hc-city" value={city} onChange={(e) => setCity(e.target.value)}>{cities.map((c) => <option key={c}>{c}</option>)}</select></div>
          <Num label="Solar size (kWp)" step={0.5} value={dc} onChange={setDc} />
          <Num label="Inverter (kW)" step={0.5} value={inv} onChange={setInv} />
          <div><label htmlFor="hc-type">Inverter type</label>
            <select id="hc-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="on_grid">On-grid</option><option value="hybrid">Hybrid</option><option value="off_grid">Off-grid</option></select></div>
          <div><label htmlFor="hc-face">Panels face</label>
            <select id="hc-face" value={facing} onChange={(e) => setFacing(e.target.value)}>
              <option value="180">South</option><option value="135">South-east</option><option value="225">South-west</option>
              <option value="90">East</option><option value="270">West</option><option value="0">North</option></select></div>
        </div>
        <fieldset className="space-y-2">
          <legend className="font-semibold">Solar units generated</legend>
          <div className="rounded-xl bg-bg p-3 space-y-2">
            <FilePick files={shot} onChange={setShot} label="Easier: upload a screenshot of your inverter app's monthly generation (optional)" />
            {shot.length > 0 && <Consent checked={consent} onChange={setConsent} />}
            {shot.length > 0 && <Button variant="ghost" onClick={readShot} disabled={busy || !consent}>{busy ? "Reading…" : "Read my screenshot"}</Button>}
            {shotNote && <p className="text-sm text-info">{shotNote}</p>}
          </div>
          {readings.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div><label htmlFor={`m${i}`}>Month</label>
                <select id={`m${i}`} value={r.month} onChange={(e) => setReadings(readings.map((x, j) => (j === i ? { ...x, month: Number(e.target.value) } : x)))}>
                  {MONTHS.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}
                </select></div>
              <Num label="Units (kWh) that month" value={r.kwh} onChange={(v) => setReadings(readings.map((x, j) => (j === i ? { ...x, kwh: v } : x)))} />
              <button className="text-bad text-sm pb-2" onClick={() => setReadings(readings.filter((_, j) => j !== i))} disabled={readings.length === 1}>Remove</button>
            </div>
          ))}
          {readings.length < 12 && <Button variant="ghost" onClick={() => setReadings([...readings, { month: (readings[readings.length - 1].month % 12) + 1, kwh: null }])}>+ Add a month</Button>}
          <p className="text-xs text-muted">Only have a daily number? Multiply it by the days in that month (e.g. 22 units/day × 31 = 682).</p>
        </fieldset>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="!text-ink !text-sm inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={zeroExport} onChange={(e) => setZeroExport(e.target.checked)} />No net metering / export limited (zero export)</label>
          <label className="!text-ink !text-sm inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={billNotDropping} onChange={(e) => setBillNotDropping(e.target.checked)} />My bill hasn&apos;t dropped much</label>
        </div>
        <Button onClick={go} disabled={busy || !dc || !readings.some((r) => r.kwh !== null)}>{busy ? "Checking…" : "Check my system"}</Button>
      </Card>

      {out && (
        <>
          <div className={`rounded-2xl border p-5 ${V[out.verdict][0]}`}>
            <h2 className="text-2xl font-bold">{V[out.verdict][1]}</h2>
            {out.average_ratio !== null && <p className="text-ink mt-1">On average it made {Math.round(out.average_ratio * 100)}% of the expected units.</p>}
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead><tr className="text-muted"><th className="text-start py-1">Month</th><th className="text-start">Your units</th><th className="text-start">Expected (normal range)</th><th className="text-start">Status</th></tr></thead>
              <tbody>{out.rows.map((r, i) => (
                <tr key={i} className="border-t border-line"><td className="py-2">{r.month}</td><td>{r.actual}</td><td>{r.expected} ({r.expected_low}–{r.expected_high})</td>
                  <td>{r.status === "good" ? "✅ Normal" : r.status === "low" ? "⚠️ Low" : "❌ Very low"}</td></tr>
              ))}</tbody>
            </table>
          </Card>
          {out.possible_causes.length > 0 && <Card><h3 className="font-semibold">Possible causes</h3><ul className="mt-2 list-disc ps-5 space-y-1 text-sm">{out.possible_causes.map((c) => <li key={c}>{c}</li>)}</ul></Card>}
          {out.settings_checklist.length > 0 && <Card><h3 className="font-semibold">Settings to check with your installer</h3><ul className="mt-2 space-y-1 text-sm">{out.settings_checklist.map((c) => <li key={c}>☐ {c}</li>)}</ul></Card>}
          <p className="text-xs text-muted">{out.note} Thinking about adding a battery? <a className="underline" href="/battery">Try the battery advisor</a>.</p>
        </>
      )}
    </div>
  );
}

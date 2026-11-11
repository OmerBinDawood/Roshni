"use client";
import { useState } from "react";
import { Button, Card, ErrorBox, Num } from "@/components/ui";
import { api } from "@/lib/api";

type In = {
  owns_home: boolean; landlord_permission: boolean; roof_area_sqft: number | null; shade: "none" | "some" | "heavy";
  avg_monthly_units: number | null; protected: boolean; sanctioned_load_kw: number | null; wants_net_billing: boolean;
  roof_condition: "good" | "old" | "unsure"; budget_lakh: number | null;
};
type Out = { verdict: "ready" | "check_first" | "not_now"; stop: string[]; caution: string[]; good: string[]; suggested_kw: number | null; max_kw_roof: number | null; note: string };

const V = {
  ready: ["bg-leaf/10 border-leaf/40 text-leaf", "Ready to ask for quotes"],
  check_first: ["bg-warn/10 border-warn/40 text-warn", "Possible — check a few things first"],
  not_now: ["bg-bad/10 border-bad/40 text-bad", "Not now — here's why"],
} as const;

export default function Readiness() {
  const [v, setV] = useState<In>({ owns_home: true, landlord_permission: false, roof_area_sqft: null, shade: "none",
    avg_monthly_units: null, protected: false, sanctioned_load_kw: null, wants_net_billing: true, roof_condition: "good", budget_lakh: null });
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof In>(k: K, x: In[K]) => { setV({ ...v, [k]: x }); setOut(null); };

  async function go() {
    setError(null);
    try { setOut(await api.post<Out>("/readiness", v)); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Is solar right for me yet?</h1>
      <p className="text-muted">A 2-minute check. Roshni sells nothing, so it can honestly say “not now”.</p>
      <ErrorBox error={error} />
      <Card className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label>Do you own the house?</label>
            <select value={v.owns_home ? "1" : "0"} onChange={(e) => set("owns_home", e.target.value === "1")}><option value="1">Yes</option><option value="0">No, I rent</option></select></div>
          {!v.owns_home && <div><label>Written permission from the owner?</label>
            <select value={v.landlord_permission ? "1" : "0"} onChange={(e) => set("landlord_permission", e.target.value === "1")}><option value="0">No</option><option value="1">Yes</option></select></div>}
          <div><label>Shade on the roof (trees, buildings, tanks)</label>
            <select value={v.shade} onChange={(e) => set("shade", e.target.value as In["shade"])}><option value="none">None</option><option value="some">Some</option><option value="heavy">Heavy</option></select></div>
          <div><label>Roof condition</label>
            <select value={v.roof_condition} onChange={(e) => set("roof_condition", e.target.value as In["roof_condition"])}><option value="good">Good</option><option value="old">Old / needs repair</option><option value="unsure">Not sure</option></select></div>
          <Num label="Free roof area (sq ft)" step={50} value={v.roof_area_sqft} onChange={(x) => set("roof_area_sqft", x)} />
          <Num label="Average monthly units (from bill)" step={10} value={v.avg_monthly_units} onChange={(x) => set("avg_monthly_units", x)} />
          <Num label="Sanctioned load (kW, on bill)" step={0.5} value={v.sanctioned_load_kw} onChange={(x) => set("sanctioned_load_kw", x)} />
          <Num label="Budget (lakh Rs)" step={0.5} value={v.budget_lakh} onChange={(x) => set("budget_lakh", x)} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="!text-ink !text-sm inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={v.protected} onChange={(e) => set("protected", e.target.checked)} />My bill says “protected”</label>
          <label className="!text-ink !text-sm inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={v.wants_net_billing} onChange={(e) => set("wants_net_billing", e.target.checked)} />I want to connect to the grid (net billing)</label>
        </div>
        <Button onClick={go}>Check</Button>
      </Card>
      {out && (
        <div className={`rounded-2xl border p-5 space-y-3 ${V[out.verdict][0]}`}>
          <h2 className="text-2xl font-bold">{V[out.verdict][1]}</h2>
          {out.stop.length > 0 && <ul className="text-ink space-y-1">{out.stop.map((s) => <li key={s}>⛔ {s}</li>)}</ul>}
          {out.caution.length > 0 && <ul className="text-ink space-y-1">{out.caution.map((s) => <li key={s}>⚠️ {s}</li>)}</ul>}
          {out.good.length > 0 && <ul className="text-ink space-y-1">{out.good.map((s) => <li key={s}>✅ {s}</li>)}</ul>}
          <p className="text-sm text-muted">{out.note}</p>
          {out.verdict !== "not_now" && <p className="text-ink">Next: get 2–3 quotes, then <a className="underline font-medium" href="/audit">check them with Roshni</a>.</p>}
        </div>
      )}
    </div>
  );
}

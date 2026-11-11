"use client";
import { useEffect, useState } from "react";
import ProfileForm from "@/components/ProfileForm";
import { Button, Card, ErrorBox, Num } from "@/components/ui";
import { api, rs, type Bill } from "@/lib/api";
import { savedBill, usePersistedProfile } from "@/lib/shared";

type Range = { low: number; high: number; mid: number; parts: Record<string, { low: number; high: number }> };
type Option = {
  name: string; dc_kw: number; inverter_kw: number; inverter_type: "on_grid" | "hybrid"; battery_kwh: number; cost: Range;
  savings_monthly: { low: number; expected: number; high: number }; payback_years: number | null; export_share: number;
  backup_hours: number; backup_load_kw: number; works_in_outage: boolean; within_budget: boolean; why: string[];
};
type Price = { category: string; product: string; unit: string; low: number; high: number; as_of: string | null; confidence: string; source: string; note?: string; kw?: number | null; kwh?: number | null };
type BrandRow = { id: string; name: string; kind: string; origin: string; about: string; pakistan: string; verify?: { label: string; url: string } | null; prices: Price[] };
type EstPart = { low: number; high: number; basis: string; product?: string; as_of?: string | null; source?: string; confidence?: string; why?: string };
type Est = { parts: Record<string, EstPart>; total: { low: number; high: number }; notes: string[]; from_listings: string[]; disclaimer: string; budget_rs?: number; budget_verdict?: "within" | "maybe" | "over" };
type Out = {
  summary: { annual_load_kwh: number; avg_monthly_units: number; daytime_share: number | null; bill_today_monthly_rs: number; effective_rate_rs: number;
    regime_label: string; roof_limit_kw: number | null };
  options: Option[]; brand_options: Record<string, { label: string; checks: string[]; brands: BrandRow[] }>;
  cost_note: string; prices_as_of: string; next: string; policy: string; assumptions: string[];
  price_disclaimer: string; price_as_of: string; market_notes: { text: string; source: string; as_of: string }[];
};
const PART_LABEL: Record<string, string> = { panels: "Panels", inverter: "Inverter", battery: "Battery", structure_install: "Structure, wiring, installation" };
const priceText = (p: Price) => p.unit === "per_w"
  ? `Rs ${p.low}${p.high !== p.low ? `–${p.high}` : ""} per watt` : `${rs(p.low)}${p.high !== p.low ? `–${rs(p.high)}` : ""}`;
const lakh = (n: number) => `Rs ${(n / 100000).toFixed(n >= 1000000 ? 1 : 2)} lakh`;

export default function SizePage() {
  const [profile, setProfile, profileFrom] = usePersistedProfile();
  const [bill, setBill] = useState<Bill | null>(null);
  const [history, setHistory] = useState("");
  const [budgetLakh, setBudgetLakh] = useState<number | null>(null);
  const [roof, setRoof] = useState<number | null>(null);
  const [goal, setGoal] = useState<"bill" | "backup" | "both">("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<Out | null>(null);
  const [cat, setCat] = useState("panel");
  const [kind, setKind] = useState<"all" | "international" | "pakistan-market">("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [optIdx, setOptIdx] = useState(0);
  const [pick, setPick] = useState<{ panel: string; inverter: string; battery_lithium: string }>({ panel: "", inverter: "", battery_lithium: "" });
  const [est, setEst] = useState<Est | null>(null);

  useEffect(() => { queueMicrotask(() => setBill(savedBill.get())); }, []);

  async function go() {
    setBusy(true); setError(null);
    const units = history.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n) && n > 0);
    const useBill = units.length ? ({ monthly_units_history: units, current_units: units[units.length - 1] } as Bill) : bill;
    try {
      const r = await api.post<Out>("/size", { profile: { ...profile, goal }, bill: useBill, budget_rs: budgetLakh ? budgetLakh * 100000 : null, roof_area_sqft: roof, goal });
      setOut(r); setCat(Object.keys(r.brand_options)[0]); setOptIdx(0); setEst(null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  useEffect(() => {
    const o = out?.options[optIdx];
    if (!out || !o) return;
    api.post<Est>("/size/estimate", { dc_kw: o.dc_kw, inverter_kw: o.inverter_kw, inverter_type: o.inverter_type, battery_kwh: o.battery_kwh,
      panel_brand: pick.panel || null, inverter_brand: pick.inverter || null, battery_brand: pick.battery_lithium || null,
      budget_rs: budgetLakh ? budgetLakh * 100000 : null }).then(setEst).catch(() => setEst(null));
  }, [out, optIdx, pick, budgetLakh]);

  const grp = out?.brand_options[cat];
  const shown = (grp?.brands ?? []).filter((b) => (kind === "all" || b.kind === kind) && (!verifiedOnly || b.verify));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Size my solar <span className="urdu font-normal text-muted">· میرا سولر کتنا ہونا چاہیے</span></h1>
      <p className="text-muted">Tell Roshni what runs in your home and what your bill is. It works out your load, then shows a few system sizes with cost ranges, savings, payback and backup hours. Then it lists the brands for each part, with facts and checks, not rankings.</p>
      <ErrorBox error={error} />

      <Card className="space-y-4">
        <h2 className="font-semibold">1. Your home</h2>
        <p className="text-xs text-muted">{profileFrom === "none" ? "Your answers are saved on this device so you only enter them once." : `Loaded from your ${profileFrom === "account" ? "account" : "last visit"}.`}</p>
        <ProfileForm key={profileFrom} value={profile} onChange={setProfile} showRegime />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">2. Your bill, budget and roof</h2>
        {bill?.monthly_units_history?.length ? (
          <p className="text-sm rounded-xl bg-leaf/10 text-leaf p-3">Using the bill you decoded ({bill.monthly_units_history.length} months of units). <a className="underline" href="/bill">Decode a different one</a>.</p>
        ) : (
          <p className="text-sm text-muted">No bill yet. <a className="underline" href="/bill">Decode your bill</a> (photo, PDF or reference number) for the most accurate result, or type your monthly units below.</p>
        )}
        <div><label htmlFor="sz-hist">Monthly units from your bill (optional, oldest first){bill?.monthly_units_history?.length ? " — leave empty to use your decoded bill" : ""}</label>
          <input id="sz-hist" value={history} onChange={(e) => setHistory(e.target.value)} placeholder="300, 280, 320, 450, 600, 750, 800, 780, 700, 550, 350, 300" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Num label="Budget (lakh Rs, optional)" step={1} value={budgetLakh} onChange={setBudgetLakh} />
          <Num label="Roof area (sq ft, optional)" step={50} value={roof} onChange={setRoof} />
          <div><label htmlFor="sz-goal">What matters most</label>
            <select id="sz-goal" value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)}>
              <option value="both">Lower bill + backup</option><option value="bill">Lower bill only</option><option value="backup">Backup in load-shedding</option>
            </select></div>
        </div>
        <Button onClick={go} disabled={busy}>{busy ? "Working out your load and options…" : "Size my solar"}</Button>
      </Card>

      {out && (
        <>
          <Card className="space-y-2">
            <h2 className="font-semibold text-lg">Your load and your bill today</h2>
            <div className="grid sm:grid-cols-4 gap-3 text-sm">
              <div><div className="text-muted">Average use</div><div className="text-xl font-bold">{out.summary.avg_monthly_units} units/mo</div></div>
              <div><div className="text-muted">Used in daytime</div><div className="text-xl font-bold">{out.summary.daytime_share != null ? `${Math.round(out.summary.daytime_share * 100)}%` : "–"}</div></div>
              <div><div className="text-muted">Bill without solar</div><div className="text-xl font-bold">{rs(out.summary.bill_today_monthly_rs)}/mo</div></div>
              <div><div className="text-muted">All-in price per unit</div><div className="text-xl font-bold">Rs {out.summary.effective_rate_rs}</div></div>
            </div>
            <p className="text-xs text-muted">{out.summary.regime_label}. Only daytime use is served directly by solar; a battery moves evening use onto solar. {out.summary.roof_limit_kw ? `Your roof fits about ${out.summary.roof_limit_kw} kW.` : ""}</p>
          </Card>

          <h2 className="text-lg font-semibold">System options</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {out.options.map((o) => (
              <Card key={o.name} className={`space-y-2 ${o.within_budget ? "" : "border-warn"}`}>
                <h3 className="font-semibold">{o.name}</h3>
                <div className="text-sm">{o.dc_kw} kW panels · {o.inverter_kw} kW {o.inverter_type.replace("_", "-")} inverter{o.battery_kwh ? ` · ${o.battery_kwh} kWh battery` : ""}</div>
                <div><span className="text-2xl font-bold">{lakh(o.cost.low)}–{lakh(o.cost.high).replace("Rs ", "")}</span>{!o.within_budget && <span className="ms-2 text-warn text-sm">over budget</span>}</div>
                <ul className="text-sm space-y-0.5">
                  <li>Saves about <b>{rs(o.savings_monthly.expected)}</b>/month ({rs(o.savings_monthly.low)}–{rs(o.savings_monthly.high)})</li>
                  <li>Simple payback {o.payback_years ?? "–"} years</li>
                  <li>{o.works_in_outage ? `Backup ~${o.backup_hours} h for ~${o.backup_load_kw} kW` : "No backup in load-shedding"}</li>
                </ul>
                <details className="text-xs text-muted"><summary className="cursor-pointer">Where the money goes and why this size</summary>
                  <ul className="mt-1 space-y-0.5">{Object.entries(o.cost.parts).map(([k, v]) => <li key={k}>{PART_LABEL[k] ?? k}: {rs(v.low)}–{rs(v.high)}</li>)}</ul>
                  <ul className="mt-2 list-disc ps-4 space-y-0.5">{o.why.map((w) => <li key={w}>{w}</li>)}</ul>
                </details>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted">{out.cost_note} Prices as of {out.prices_as_of}. {out.assumptions.join(" ")}</p>

          <Card className="space-y-3">
            <h2 className="font-semibold text-lg">Brands you will meet for each part</h2>
            <p className="text-sm text-muted">{out.policy} Listed alphabetically. Roshni does not score brands. Prices below are public dealer listings collected on {out.price_as_of}; they change weekly, so compare exact models and written quotes.</p>
            <p className="rounded-xl bg-warn/10 text-warn text-sm p-3"><b>Re-verify every price before you pay.</b> {out.price_disclaimer}</p>
            {out.market_notes.map((m) => <p key={m.source} className="text-xs text-muted">{m.as_of}: {m.text} <a className="underline" href={m.source} target="_blank" rel="noreferrer">source</a></p>)}
            <div className="flex flex-wrap gap-2" role="tablist">
              {Object.entries(out.brand_options).map(([k, v]) => (
                <button key={k} role="tab" aria-selected={cat === k} onClick={() => setCat(k)}
                  className={`rounded-full border px-3 py-1 text-sm ${cat === k ? "bg-sun/25 border-sun font-semibold" : "border-line"}`}>{v.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-sm items-center">
              <label className="!text-ink !text-sm inline-flex items-center gap-2">Made by
                <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="!w-auto">
                  <option value="all">Any</option><option value="international">International brands</option><option value="pakistan-market">Pakistan-market brands</option>
                </select></label>
              <label className="!text-ink !text-sm inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />Has an official check or compatibility list</label>
            </div>
            {grp && (
              <div className="rounded-xl bg-bg p-3 text-sm">
                <div className="font-medium">Before you buy any {grp.label.toLowerCase()}</div>
                <ul className="list-disc ps-5 mt-1 space-y-0.5">{grp.checks.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            )}
            <ul className="divide-y divide-line">
              {shown.map((b) => (
                <li key={b.id} className="py-2 text-sm">
                  <div className="font-medium"><a className="underline" href={`/brands#${b.id}`}>{b.name}</a> <span className="text-muted font-normal">· {b.origin}</span></div>
                  <p className="text-muted">{b.about}</p>
                  <p>{b.pakistan}</p>
                  {b.prices.length > 0 ? (
                    <ul className="mt-1 rounded-lg bg-sun/10 px-2 py-1 text-xs space-y-0.5">
                      {b.prices.map((p) => (
                        <li key={p.product}><b>{priceText(p)}</b> · {p.product} · {p.as_of ? `listed ${p.as_of}` : "undated"} ({p.confidence}) · <a className="underline" href={p.source} target="_blank" rel="noreferrer">source</a>{p.note ? ` · ${p.note}` : ""}</li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-muted">No public price listing found for this brand.</p>}
                  {b.verify?.url && <p><a className="underline text-leaf" href={b.verify.url} target="_blank" rel="noreferrer">{b.verify.label}</a></p>}
                </li>
              ))}
              {shown.length === 0 && <li className="py-3 text-muted text-sm">No brands match these filters.</li>}
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="font-semibold text-lg">Build your own estimate with brands</h2>
            <p className="text-sm text-muted">Pick one of the options above and the brands you are considering. Roshni uses each brand&apos;s public listing where one exists and market ranges for the rest. This is an estimate to prepare for quotes, not a price.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label htmlFor="est-opt">System</label>
                <select id="est-opt" value={optIdx} onChange={(e) => setOptIdx(Number(e.target.value))}>
                  {out.options.map((o, i) => <option key={o.name} value={i}>{o.name}: {o.dc_kw} kW{o.battery_kwh ? ` + ${o.battery_kwh} kWh` : ""}</option>)}
                </select></div>
              {(["panel", "inverter", "battery_lithium"] as const).filter((k) => out.brand_options[k]).filter((k) => k !== "battery_lithium" || out.options[optIdx]?.battery_kwh).map((k) => (
                <div key={k}><label htmlFor={`est-${k}`}>{out.brand_options[k].label} brand</label>
                  <select id={`est-${k}`} value={pick[k]} onChange={(e) => setPick({ ...pick, [k]: e.target.value })}>
                    <option value="">Not decided (market range)</option>
                    {out.brand_options[k].brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.prices.some((p) => p.category === k) ? "" : " (no price listed)"}</option>)}
                  </select></div>
              ))}
            </div>
            {est && (
              <div className="space-y-2">
                <table className="w-full text-sm">
                  <thead><tr className="text-muted"><th className="text-start py-1">Part</th><th className="text-start">Estimate</th><th className="text-start">Based on</th></tr></thead>
                  <tbody>{Object.entries(est.parts).map(([k, p]) => (
                    <tr key={k} className="border-t border-line align-top"><td className="py-1">{PART_LABEL[k] ?? k}</td><td>{rs(p.low)}–{rs(p.high)}</td>
                      <td className="text-xs text-muted">{p.basis === "brand listing" ? <>{p.product} · {p.as_of ? `listed ${p.as_of}` : "undated"} · <a className="underline" href={p.source} target="_blank" rel="noreferrer">source</a></> : `Market range (${p.why})`}</td></tr>
                  ))}</tbody>
                </table>
                <div className="text-lg font-bold">Total about {rs(est.total.low)}–{rs(est.total.high)}</div>
                {est.budget_verdict && (
                  <p className={`text-sm ${est.budget_verdict === "within" ? "text-leaf" : est.budget_verdict === "maybe" ? "text-warn" : "text-bad"}`}>
                    {est.budget_verdict === "within" ? "Within your budget." : est.budget_verdict === "maybe" ? "The low end fits your budget, the high end does not." : "Above your budget; try a smaller option or a cheaper battery."}
                  </p>
                )}
                {est.notes.map((n) => <p key={n} className="text-xs text-muted">{n}</p>)}
                <p className="text-xs text-warn">Approval and meter fees are extra. Re-verify prices, grade and warranty with the seller in writing before paying.</p>
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <h2 className="font-semibold">Next</h2>
            <p className="text-sm">{out.next}</p>
            <div className="flex gap-2 flex-wrap">
              <a href="/audit" className="rounded-xl px-4 py-2.5 bg-sun font-semibold">Check a quote</a>
              <a href="/financing" className="rounded-xl px-4 py-2.5 border border-line hover:bg-bg">Loan vs savings</a>
              <Button variant="ghost" onClick={() => window.dispatchEvent(new Event("roshni:open-assistant"))}>💬 Ask Madadgar</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

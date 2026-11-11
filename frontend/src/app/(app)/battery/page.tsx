"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ProfileForm from "@/components/ProfileForm";
import { Button, Card, ErrorBox, Num } from "@/components/ui";
import { api, rs, type Bill, type Profile } from "@/lib/api";
import { savedBill, usePersistedProfile } from "@/lib/shared";
import { useLang } from "@/lib/i18n";

type Opt = { usable_kwh: number; savings_monthly: { low: number; expected: number; high: number }; extra_saving_monthly: number;
  indicative_cost_rs: number; simple_payback_years: number | null; backup_hours: number; annual: { export_kwh: number; import_kwh: number } };
type Res = { regime: string; options: Opt[]; backup_load_kw: number; cost_per_usable_kwh_assumed: number; note: string };

export default function BatteryPage() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Battery /></Suspense>;
}

function Battery() {
  const { t } = useLang();
  const params = useSearchParams();
  const [profile, setProfile, profileFrom] = usePersistedProfile();
  const [prefill, setPrefill] = useState<string | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [dcKw, setDcKw] = useState<number | null>(6);
  const [invKw, setInvKw] = useState<number | null>(6);
  const [invType, setInvType] = useState("on_grid");
  const [cost, setCost] = useState<number | null>(55000);
  const [history, setHistory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Res | null>(null);

  // From a report: reuse its system, household and bill. Otherwise reuse a bill decoded earlier in this tab.
  useEffect(() => {
    const id = params.get("report");
    if (id) {
      api.get<{ request: { profile: Profile; bill: Bill | null }; report: { system_summary: { dc_kwp: number; inverter_kw: number | null; inverter_type: string; battery_usable_kwh: number } } }>(`/report/${id}`)
        .then(({ request, report }) => {
          const s = report.system_summary;
          setDcKw(s.dc_kwp); if (s.inverter_kw) setInvKw(s.inverter_kw);
          setInvType(s.inverter_type === "on_grid" ? "on_grid" : "hybrid");
          setProfile(request.profile); setBill(request.bill);
          setPrefill(`Filled in from your report: ${s.dc_kwp} kWp, ${s.inverter_kw ?? "?"} kW ${s.inverter_type.replace("_", "-")} inverter${s.battery_usable_kwh ? ` (it already includes a ${s.battery_usable_kwh} kWh battery)` : ""}, your home details${request.bill ? " and your bill" : ""}.`);
        }).catch(() => setPrefill("Could not load that report; enter your details below."));
      return;
    }
    const sb = savedBill.get();
    if (sb) queueMicrotask(() => { setBill(sb); setPrefill("Using the bill you decoded earlier in this tab."); });
  }, [params, setProfile]);

  async function go() {
    setBusy(true); setError(null);
    const units = history.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n));
    const useBill: Bill | null = units.length ? { monthly_units_history: units, current_units: units[units.length - 1] } as Bill : bill;
    try {
      setRes(await api.post<Res>("/battery", { profile, dc_kw: dcKw, inverter_kw: invKw, inverter_type: invType, cost_per_usable_kwh: cost, bill: useBill }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("battery")}</h1>
      <ErrorBox error={error} />
      {prefill && <p className="rounded-xl bg-leaf/10 text-leaf px-3 py-2 text-sm">{prefill}</p>}
      <Card className="space-y-4">
        <h2 className="font-semibold">Your existing system</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Num label="Solar size (kWp)" step={0.5} value={dcKw} onChange={setDcKw} />
          <Num label="Inverter (kW)" step={0.5} value={invKw} onChange={setInvKw} />
          <div><label>Inverter type</label>
            <select value={invType} onChange={(e) => setInvType(e.target.value)}>
              <option value="on_grid">On-grid</option><option value="hybrid">Hybrid (no battery yet)</option>
            </select>
          </div>
          <Num label="Battery cost per usable kWh (Rs)" step={1000} value={cost} onChange={setCost} />
        </div>
        <div><label htmlFor="bt-hist">Monthly units from your bill (optional, oldest first){bill?.monthly_units_history?.length ? ` — leave empty to use the ${bill.monthly_units_history.length} months from your bill` : ""}</label><input id="bt-hist" value={history} onChange={(e) => setHistory(e.target.value)} placeholder="300, 280, 320, 450, 600, 750, 800, 780, 700, 550, 350, 300" /></div>
        {invType === "on_grid" && (
          <p className="text-sm rounded-xl bg-warn/10 text-warn p-3">Most on-grid inverters cannot take a battery directly. Options: AC-coupling, replacing it with a hybrid inverter, or a separate backup system. Each has its own cost — ask an installer to quote it.</p>
        )}
      </Card>
      <Card><ProfileForm key={profileFrom + (prefill ?? "")} value={profile} onChange={setProfile} /></Card>
      <Button onClick={go} disabled={busy || !dcKw || !invKw}>{busy ? t("working") : "Compare battery sizes"}</Button>

      {res && (
        <Card>
          <h2 className="font-semibold text-lg">Results ({res.regime === "NET_BILLING_2026" ? "net billing" : "legacy net metering"})</h2>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead><tr className="text-muted text-start"><th className="text-start py-2">Usable battery</th><th className="text-start">Total saving/mo</th><th className="text-start">Extra vs no battery</th><th className="text-start">Indicative cost</th><th className="text-start">Payback</th><th className="text-start">Backup hours*</th></tr></thead>
              <tbody>
                {res.options.map((o) => (
                  <tr key={o.usable_kwh} className="border-t border-line">
                    <td className="py-2 font-semibold">{o.usable_kwh ? `${o.usable_kwh} kWh` : "None"}</td>
                    <td>{rs(o.savings_monthly.low)}–{rs(o.savings_monthly.high)}</td>
                    <td>{o.usable_kwh ? `+${rs(o.extra_saving_monthly)}` : "–"}</td>
                    <td>{o.usable_kwh ? rs(o.indicative_cost_rs) : "–"}</td>
                    <td>{o.simple_payback_years ? `${o.simple_payback_years} yrs` : "–"}</td>
                    <td>{o.usable_kwh ? `~${o.backup_hours} h` : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">*Backup hours for your chosen backup appliances (~{res.backup_load_kw} kW) from a full battery. {res.note} Battery cost excludes any inverter replacement.</p>
        </Card>
      )}
    </div>
  );
}

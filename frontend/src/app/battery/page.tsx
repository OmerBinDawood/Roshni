"use client";
import { useState } from "react";
import ProfileForm from "@/components/ProfileForm";
import { Button, Card, ErrorBox, Num } from "@/components/ui";
import { api, defaultProfile, rs, type Profile } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Opt = { usable_kwh: number; savings_monthly: { low: number; expected: number; high: number }; extra_saving_monthly: number;
  indicative_cost_rs: number; simple_payback_years: number | null; backup_hours: number; annual: { export_kwh: number; import_kwh: number } };
type Res = { regime: string; options: Opt[]; backup_load_kw: number; cost_per_usable_kwh_assumed: number; note: string };

export default function BatteryPage() {
  const { t } = useLang();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [dcKw, setDcKw] = useState<number | null>(6);
  const [invKw, setInvKw] = useState<number | null>(6);
  const [invType, setInvType] = useState("on_grid");
  const [cost, setCost] = useState<number | null>(55000);
  const [history, setHistory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Res | null>(null);

  async function go() {
    setBusy(true); setError(null);
    const units = history.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n));
    try {
      setRes(await api.post<Res>("/battery", { profile, dc_kw: dcKw, inverter_kw: invKw, inverter_type: invType, cost_per_usable_kwh: cost,
        bill: units.length ? { monthly_units_history: units, current_units: units[units.length - 1] } : null }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("battery")}</h1>
      <ErrorBox error={error} />
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
        <div><label>Monthly units from your bill (optional, oldest first)</label><input value={history} onChange={(e) => setHistory(e.target.value)} placeholder="300, 280, 320, 450, 600, 750, 800, 780, 700, 550, 350, 300" /></div>
        {invType === "on_grid" && (
          <p className="text-sm rounded-xl bg-warn/10 text-warn p-3">Most on-grid inverters cannot take a battery directly. Options: AC-coupling, replacing it with a hybrid inverter, or a separate backup system. Each has its own cost — ask an installer to quote it.</p>
        )}
      </Card>
      <Card><ProfileForm value={profile} onChange={setProfile} /></Card>
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

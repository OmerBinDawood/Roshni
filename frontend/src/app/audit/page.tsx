"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FilePick from "@/components/FilePick";
import ProfileForm from "@/components/ProfileForm";
import { Button, Card, ErrorBox, Num } from "@/components/ui";
import { api, defaultProfile, ITEM_TYPES, rs, type Bill, type LineItem, type Profile, type Quote, type Spec, type SystemConfig } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const STEPS = ["Quote", "Bill", "Home", "Confirm"];

export default function AuditPage() {
  const { t } = useLang();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [quoteText, setQuoteText] = useState("");
  const [billFile, setBillFile] = useState<File[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [system, setSystem] = useState<SystemConfig | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function readQuote() {
    const fd = new FormData();
    quoteFiles.forEach((f) => fd.append("files", f));
    if (quoteText.trim()) fd.append("text", quoteText);
    const r = await run("Reading your quote…", () => api.upload<{ quote: Quote; system: SystemConfig }>("/extract/quote", fd));
    if (r) { setQuote(r.quote); setSystem(r.system); setStep(1); }
  }

  async function readBill() {
    const fd = new FormData();
    fd.append("file", billFile[0]);
    const r = await run("Reading your bill…", () => api.upload<{ bill: Bill }>("/extract/bill", fd));
    if (r) { setBill(r.bill); if (r.bill.phase) setProfile((p) => ({ ...p, phase: r.bill.phase })); }
  }

  async function submit() {
    const r = await run("Simulating a full year, hour by hour…", () =>
      api.post<{ id: string }>("/audit", { quote, system, profile, bill }));
    if (r) router.push(`/report/${r.id}`);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("checkQuote")}</h1>
      <ol className="flex gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex-1 text-center rounded-full py-1 border ${i === step ? "bg-sun/25 border-sun font-semibold" : i < step ? "border-leaf/40 text-leaf" : "border-line text-muted"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <ErrorBox error={error} />

      {step === 0 && (
        <Card className="space-y-4">
          <FilePick files={quoteFiles} onChange={setQuoteFiles} label="Upload your installer's quote" />
          <div>
            <label>…or paste the quote text (e.g. a forwarded WhatsApp message)</label>
            <textarea dir="auto" rows={5} value={quoteText} onChange={(e) => setQuoteText(e.target.value)}
              placeholder={"10 x LONGi 585W A grade @ 23,400\n6kW Deye hybrid inverter 3.3 lakh\n5kWh lithium battery 2.8 lakh\nStructure, wiring, installation 85k"} />
          </div>
          <Button onClick={readQuote} disabled={!!busy || (!quoteFiles.length && !quoteText.trim())}>{busy ?? `${t("next")} →`}</Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <p className="text-muted">Your latest electricity bill already shows 12 months of units. It lets Roshni use your real price per unit.</p>
          {!bill && <FilePick files={billFile} onChange={setBillFile} multiple={false} label="Upload your latest electricity bill" />}
          {!bill && (
            <div className="flex gap-2">
              <Button onClick={readBill} disabled={!!busy || !billFile.length}>{busy ?? "Read bill"}</Button>
              <Button variant="ghost" onClick={() => setStep(2)}>{t("skip")}</Button>
            </div>
          )}
          {bill && <BillEditor bill={bill} onChange={setBill} />}
          {bill && <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(0)}>{t("back")}</Button><Button onClick={() => setStep(2)}>{t("next")} →</Button></div>}
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <ProfileForm value={profile} onChange={setProfile} />
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}>{t("back")}</Button><Button onClick={() => setStep(3)}>{t("next")} →</Button></div>
        </Card>
      )}

      {step === 3 && quote && system && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-semibold text-lg">Is this right?</h2>
            <p className="text-sm text-muted">We read this from your quote. Fix anything wrong — nothing is checked until you confirm. Highlighted rows were hard to read.</p>
            <ItemsEditor items={quote.line_items} onChange={(line_items) => setQuote({ ...quote, line_items })} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Num label="Grand total (Rs)" value={quote.grand_total} onChange={(v) => setQuote({ ...quote, grand_total: v })} />
              <Num label="Savings claimed (Rs/month)" value={quote.claimed_monthly_savings_rs} onChange={(v) => setQuote({ ...quote, claimed_monthly_savings_rs: v })} />
              <div><label>Payment terms</label><input value={quote.payment_terms ?? ""} onChange={(e) => setQuote({ ...quote, payment_terms: e.target.value })} /></div>
            </div>
          </Card>
          <SystemEditor system={system} onChange={setSystem} quote={quote} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>{t("back")}</Button>
            <Button onClick={submit} disabled={!!busy}>{busy ?? "Check my quote"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BillEditor({ bill, onChange }: { bill: Bill; onChange: (b: Bill) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label>Provider</label><input value={bill.provider ?? ""} onChange={(e) => onChange({ ...bill, provider: e.target.value })} /></div>
        <Num label="Units this month" value={bill.current_units} onChange={(v) => onChange({ ...bill, current_units: v })} />
        <Num label="Total payable (Rs)" value={bill.total_amount_rs} onChange={(v) => onChange({ ...bill, total_amount_rs: v })} />
        <Num label="Fixed charges (Rs)" value={bill.fixed_charges_rs} onChange={(v) => onChange({ ...bill, fixed_charges_rs: v })} />
      </div>
      <div>
        <label>Units in the last 12 months (oldest first, comma-separated)</label>
        <input value={bill.monthly_units_history.join(", ")}
          onChange={(e) => onChange({ ...bill, monthly_units_history: e.target.value.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n)) })} />
      </div>
      <label className="!text-ink inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={!!bill.protected} onChange={(e) => onChange({ ...bill, protected: e.target.checked })} /> Protected consumer</label>
    </div>
  );
}

function ItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (i: LineItem[]) => void }) {
  const upd = (i: number, patch: Partial<LineItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className={`grid grid-cols-2 sm:grid-cols-12 gap-2 p-2 rounded-xl ${it.low_confidence ? "bg-warn/10" : "bg-bg"}`}>
          <select className="sm:col-span-2" value={it.item_type} onChange={(e) => upd(i, { item_type: e.target.value as LineItem["item_type"] })}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <input className="sm:col-span-3" placeholder="Description" value={it.description} onChange={(e) => upd(i, { description: e.target.value })} />
          <input className="sm:col-span-2" placeholder="Brand" value={it.brand ?? ""} onChange={(e) => upd(i, { brand: e.target.value || null })} />
          <input className="sm:col-span-2" placeholder="Model" value={it.model ?? ""} onChange={(e) => upd(i, { model: e.target.value || null })} />
          <input className="sm:col-span-1" type="number" placeholder="Qty" value={it.quantity ?? ""} onChange={(e) => upd(i, { quantity: e.target.value ? Number(e.target.value) : null })} />
          <input className="sm:col-span-2" type="number" placeholder="Unit Rs" value={it.unit_price ?? ""} onChange={(e) => upd(i, { unit_price: e.target.value ? Number(e.target.value) : null })} />
          <input className="col-span-2 sm:col-span-11" placeholder="Warranty (as written)" value={it.warranty_text ?? ""} onChange={(e) => upd(i, { warranty_text: e.target.value || null })} />
          <button className="text-bad text-sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...items, { item_type: "other", description: "" }])}>+ Add line</Button>
      <p className="text-sm text-muted">Line total of items: {rs(items.reduce((s, it) => s + (it.line_total ?? (it.quantity ?? 0) * (it.unit_price ?? 0)), 0))}</p>
    </div>
  );
}

const FIELDS: Record<"panel" | "inverter" | "battery", [string, string][]> = {
  panel: [["pmax_w", "Power (W)"], ["voc", "Voc (V)"], ["vmp", "Vmp (V)"], ["isc", "Isc (A)"], ["beta_voc_pct", "Voc temp coeff (%/°C)"], ["gamma_pmax_pct", "Pmax temp coeff (%/°C)"]],
  inverter: [["rated_kw", "Rated (kW)"], ["surge_kva", "Surge (kVA)"], ["max_pv_input_kw", "Max PV input (kW)"], ["max_dc_voltage", "Max DC voltage (V)"], ["mppt_min_v", "MPPT min (V)"], ["mppt_max_v", "MPPT max (V)"], ["mppt_count", "MPPT inputs"], ["max_isc_per_mppt_a", "Max Isc per MPPT (A)"]],
  battery: [["nominal_kwh", "Nominal kWh"], ["usable_kwh", "Usable kWh"], ["max_discharge_kw", "Max discharge (kW)"], ["warranty_cycles", "Warranty cycles"]],
};

function SystemEditor({ system, onChange, quote }: { system: SystemConfig; onChange: (s: SystemConfig) => void; quote: Quote }) {
  const [looking, setLooking] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const setSpec = (kind: "panel" | "inverter" | "battery", patch: Spec) => onChange({ ...system, [kind]: { ...system[kind], ...patch } });

  async function lookup(kind: "panel" | "inverter" | "battery") {
    const li = quote.line_items.find((l) => l.item_type === kind);
    if (!li?.brand || !li?.model) { setErr(`Add the ${kind}'s brand and model above first.`); return; }
    setLooking(kind); setErr(null);
    try {
      const spec = await api.post<Spec>("/specs/lookup", { kind, brand: li.brand, model: li.model });
      const clean = Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== null && v !== undefined));
      setSpec(kind, clean);
    } catch (e) { setErr((e as Error).message); } finally { setLooking(null); }
  }

  const kinds: ("panel" | "inverter" | "battery")[] = ["panel", "inverter", ...(system.battery_count || quote.line_items.some((l) => l.item_type === "battery") ? ["battery" as const] : [])];
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-lg">Technical details</h2>
      <p className="text-sm text-muted">Needed for the safety checks. Use “Find datasheet values” to look them up on the web — always compare with the real datasheet. Leave blank if unknown: Roshni will say “cannot verify”, never “pass”.</p>
      <ErrorBox error={err} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Num label="Number of panels" value={system.panel_count} onChange={(v) => onChange({ ...system, panel_count: v ?? 0 })} />
        <Num label="Panels per string" value={system.panels_per_string} onChange={(v) => onChange({ ...system, panels_per_string: v })} />
        <Num label="Strings per MPPT" value={system.strings_per_mppt} onChange={(v) => onChange({ ...system, strings_per_mppt: v })} />
        <Num label="Number of batteries" value={system.battery_count} onChange={(v) => onChange({ ...system, battery_count: v ?? 0 })} />
      </div>
      {kinds.map((kind) => (
        <div key={kind} className="rounded-xl bg-bg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold capitalize">{kind}</h3>
            <div className="flex items-center gap-2">
              {system[kind].source ? (
                <a className="text-xs text-warn underline" href={String(system[kind].source)} target="_blank" rel="noreferrer">web-sourced · unverified</a>
              ) : null}
              <Button variant="ghost" onClick={() => lookup(kind)} disabled={!!looking}>{looking === kind ? "Searching…" : "🔎 Find datasheet values"}</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kind === "inverter" && (
              <>
                <Sel label="Type" v={system.inverter.type} opts={["", "on_grid", "hybrid", "off_grid"]} on={(v) => setSpec("inverter", { type: v || null })} />
                <Sel label="Battery class" v={system.inverter.battery_voltage_class} opts={["", "LV", "HV"]} on={(v) => setSpec("inverter", { battery_voltage_class: v || null })} />
                <Sel label="Phase" v={system.inverter.phase} opts={["", "single", "three"]} on={(v) => setSpec("inverter", { phase: v || null })} />
              </>
            )}
            {kind === "battery" && (
              <>
                <Sel label="Voltage class" v={system.battery.voltage_class} opts={["", "LV", "HV"]} on={(v) => setSpec("battery", { voltage_class: v || null })} />
                <div><label>BMS protocol</label><input value={String(system.battery.protocol ?? "")} onChange={(e) => setSpec("battery", { protocol: e.target.value || null })} /></div>
              </>
            )}
            {FIELDS[kind].map(([k, label]) => (
              <Num key={k} label={label} step={0.01} min={-10} value={system[kind][k] as number | null}
                onChange={(v) => setSpec(kind, { [k]: v })} />
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

function Sel({ label, v, opts, on }: { label: string; v: unknown; opts: string[]; on: (v: string) => void }) {
  return (
    <div><label>{label}</label>
      <select value={String(v ?? "")} onChange={(e) => on(e.target.value)}>
        {opts.map((o) => <option key={o} value={o}>{o ? o.replace("_", "-") : "unknown"}</option>)}
      </select>
    </div>
  );
}

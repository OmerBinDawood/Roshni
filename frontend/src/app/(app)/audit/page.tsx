"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import BillLookup from "@/components/BillLookup";
import FilePick from "@/components/FilePick";
import ProfileForm from "@/components/ProfileForm";
import { Button, Card, Consent, ErrorBox, Issues, Num } from "@/components/ui";
import { api, ITEM_TYPES, rs, type Bill, type Issue, type LineItem, type Quote, type Spec, type SystemConfig } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ActionBar, ChoiceCard, Processing, StepShell, Stepper } from "@/components/wizard";
import { deviceReports, ownerToken } from "@/lib/supabase";
import { savedBill, usePersistedProfile } from "@/lib/shared";

type Match = { kind: string; brand: string; model: string; match: number; verified: boolean };

export default function AuditPage() {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"full" | "parts">(params.get("mode") === "parts" ? "parts" : "full");
  const steps = mode === "parts" ? ["Parts", "Home", "Confirm"] : ["Quote", "Bill", "Home", "Confirm"];
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [quoteText, setQuoteText] = useState("");
  const [billFile, setBillFile] = useState<File[]>([]);
  const [billWarnings, setBillWarnings] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [system, setSystem] = useState<SystemConfig | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [profile, setProfile, profileFrom] = usePersistedProfile();
  const [decoded, setDecoded] = useState<Bill | null>(null);
  useEffect(() => { queueMicrotask(() => setDecoded(savedBill.get())); }, []);
  const stepName = steps[step];

  // Re-run the deterministic validator whenever the user edits the quote on the confirm step
  useEffect(() => {
    if (stepName !== "Confirm" || !quote) return;
    const id = setTimeout(() => {
      api.post<{ validation: Issue[] }>("/validate/quote", quote).then((r) => setIssues(r.validation)).catch(() => {});
    }, 500);
    return () => clearTimeout(id);
  }, [quote, stepName]);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label); setError(null);
    try { return await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  async function readQuote() {
    const fd = new FormData();
    quoteFiles.forEach((f) => fd.append("files", f));
    if (quoteText.trim()) fd.append("text", quoteText);
    fd.append("consent", String(consent));
    const r = await run("Reading…", () =>
      api.upload<{ quote: Quote; system: SystemConfig; validation: Issue[]; catalogue_matches: Match[] }>("/extract/quote", fd));
    if (r) { setQuote(r.quote); setSystem(r.system); setIssues(r.validation); setMatches(r.catalogue_matches); setStep(1); }
  }

  async function readBill() {
    const fd = new FormData();
    fd.append("file", billFile[0]);
    fd.append("consent", String(consent));
    const r = await run("Reading your bill…", () => api.upload<{ bill: Bill; warnings: string[] }>("/extract/bill", fd));
    if (r) {
      setBill(r.bill); setBillWarnings(r.warnings); savedBill.set(r.bill);
      if (r.bill.phase) setProfile((p) => ({ ...p, phase: r.bill.phase }));
      if (r.bill.net_metered) setProfile((p) => ({ ...p, net_metering_agreement_date: p.net_metering_agreement_date ?? "2025-01-01" }));
    }
  }

  async function submit() {
    const r = await run("Simulating a full year, hour by hour…", () =>
      api.post<{ id: string; owner_token: string; report: { system_summary: { dc_kwp: number } } }>("/audit", { quote, system, profile, bill: mode === "parts" ? null : bill, mode }));
    if (r) {
      ownerToken.set(r.id, r.owner_token);
      deviceReports.add({ id: r.id, created: new Date().toISOString(),
        title: `${quote?.installer_name || (mode === "parts" ? "Parts list" : "Quote")} · ${r.report.system_summary.dc_kwp} kWp` });
      const other = params.get("compare");
      router.push(other ? `/compare?ids=${other},${r.id}` : `/report/${r.id}`);
    }
  }

  const canRead = consent && (quoteFiles.length > 0 || quoteText.trim().length > 0);
  const parts = mode === "parts";
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="eyebrow">{parts ? "Parts check" : "Check a quote"} · about 5 minutes</div>
        <h1 className="text-3xl sm:text-5xl font-black leading-[1.02] uppercase tracking-tight">{parts ? "Will these parts work together?" : "Let Roshni check the quote"}</h1>
        <p className="text-muted max-w-2xl">{parts ? "Upload your parts list or receipts. Roshni checks string voltage, current, battery match and missing protection. No savings maths." : "Upload the quote and your bill. You confirm every line before anything is checked, and Roshni never guesses a model number."}</p>
      </header>
      {params.get("compare") && <p className="border-[1.5px] border-ink bg-info/10 text-info px-3 py-2 text-sm font-medium">After this check you&apos;ll see it side by side with your earlier quote.</p>}

      {step === 0 && (
        <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="What do you have?">
          <ChoiceCard on={!parts} onClick={() => setMode("full")} icon="🧾" title="I have an installer's quote" desc="Full check: safety, price, real savings, backup." />
          <ChoiceCard on={parts} onClick={() => setMode("parts")} icon="🧰" title="I'm buying parts myself" desc="Will these parts work together safely? No savings maths." />
        </div>
      )}

      <Stepper steps={steps} current={step} onJump={(i) => setStep(i)} />
      <ErrorBox error={error} />

      <div className="relative">
        {busy && <Processing label={busy} />}

        {step === 0 && (
          <StepShell n={1} title={parts ? "Your parts list" : "Your installer's quote"}
            desc={parts ? "Photos of the parts, receipts or a typed list are all fine." : "A phone photo, a PDF, a forwarded WhatsApp message or a handwritten slip. English, Urdu or Roman Urdu."}
            tips={["No account needed", "You confirm every line next", "Prices in lakh or k are converted for you"]}>
            <Card className="space-y-4">
              <FilePick files={quoteFiles} onChange={setQuoteFiles}
                label={parts ? "Drop photos of the parts, receipts or your list" : "Drop your installer's quote here"} />
              <div className="flex items-center gap-3 text-xs font-mono tracking-widest text-muted"><span className="h-px flex-1 bg-line" />OR PASTE TEXT<span className="h-px flex-1 bg-line" /></div>
              <div>
                <label htmlFor="quote-text">{parts ? "Type or paste your parts list" : "Paste the quote text (a copied chat message or email)"}</label>
                <textarea id="quote-text" dir="auto" rows={5} value={quoteText} onChange={(e) => setQuoteText(e.target.value)}
                  placeholder={parts
                    ? "12 x Jinko 580W\nGrowatt SPF 6000 ES Plus\n2 x Pylontech US5000"
                    : "10 x LONGi 585W A grade @ 23,400\n6kW Deye hybrid inverter 3.3 lakh\n5kWh lithium battery 2.8 lakh\nStructure, wiring, installation 85k"} />
              </div>
              <Consent checked={consent} onChange={setConsent} />
              <ActionBar><Button onClick={readQuote} disabled={!!busy || !canRead}>Read my {parts ? "list" : "quote"} <span className="arrow">→</span></Button></ActionBar>
            </Card>
          </StepShell>
        )}

        {stepName === "Bill" && (
          <StepShell n={2} title="Your electricity bill" desc="One bill shows 12 months of units. It lets Roshni use your real price per unit instead of a guess."
            tips={["Photo, PDF or the 14-digit reference number", "Your name and address are not copied", "You can skip, with less accurate savings"]}>
            <Card className="space-y-4">
              {!bill && decoded && (
                <div className="border-[1.5px] border-ink bg-leaf/10 p-3 text-sm flex flex-wrap gap-2 items-center justify-between">
                  <span>You already decoded a bill{decoded.current_units ? ` (${decoded.current_units} units this month)` : ""}. Use it here?</span>
                  <Button onClick={() => { setBill(decoded); if (decoded.phase) setProfile((p) => ({ ...p, phase: decoded.phase })); }}>Use my decoded bill</Button>
                </div>
              )}
              {!bill && <FilePick files={billFile} onChange={setBillFile} multiple={false} label="Drop your latest electricity bill" />}
              {!bill && !consent && <Consent checked={consent} onChange={setConsent} />}
              {!bill && (
                <BillLookup<{ bill: Bill; warnings: string[] }> consent={consent} onResult={(r) => {
                  setBill(r.bill); setBillWarnings(r.warnings);
                  if (r.bill.phase) setProfile((p) => ({ ...p, phase: r.bill.phase }));
                }} />
              )}
              {bill && <Issues issues={billWarnings.map((msg) => ({ level: "warn", msg }))} />}
              {bill && <BillEditor bill={bill} onChange={setBill} />}
              <ActionBar>
                <Button variant="ghost" onClick={() => setStep(0)}>← {t("back")}</Button>
                {!bill && <Button onClick={readBill} disabled={!!busy || !billFile.length || !consent}>Read bill</Button>}
                {!bill && <Button variant="ghost" onClick={() => setStep(step + 1)}>{t("skip")}</Button>}
                {bill && <Button variant="ghost" onClick={() => { setBill(null); setBillFile([]); }}>Use a different bill</Button>}
                {bill && <Button onClick={() => setStep(step + 1)}>{t("next")} <span className="arrow">→</span></Button>}
              </ActionBar>
            </Card>
          </StepShell>
        )}

        {stepName === "Home" && (
          <StepShell n={parts ? 2 : 3} title="Your home" desc="What runs, for how long, and what you need during load-shedding. Saved on this device so you only enter it once."
            tips={["Or just describe it in your own words", "Backup needs change which rules apply", "Answers are scaled to your bill when you agree"]}>
            <Card className="space-y-4">
              <ProfileForm key={profileFrom} value={profile} onChange={setProfile} showRegime={mode === "full"} />
              {mode === "full" && bill?.monthly_units_history?.length ? (
                <label className="!text-ink !text-sm flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4" checked={profile.scale_to_bill}
                    onChange={(e) => setProfile({ ...profile, scale_to_bill: e.target.checked })} />
                  Adjust my answers to match the 12 months on my bill (recommended: measured beats estimated)
                </label>
              ) : null}
              <ActionBar><Button variant="ghost" onClick={() => setStep(step - 1)}>← {t("back")}</Button><Button onClick={() => setStep(step + 1)}>{t("next")} <span className="arrow">→</span></Button></ActionBar>
            </Card>
          </StepShell>
        )}

        {stepName === "Confirm" && quote && system && (
          <StepShell n={parts ? 3 : 4} title="Is this right?" desc="This is what the AI read from your document. Fix anything wrong. Nothing is checked until you confirm."
            tips={["Highlighted rows were hard to read", "Missing datasheet values become “cannot verify”", "Look up datasheets, then compare with the real one"]}>
            <div className="space-y-4">
              <Card className="space-y-3">
                <Issues issues={issues} />
                {matches.length > 0 && (
                  <p className="text-sm text-leaf">Found in Roshni&apos;s datasheet catalogue: {matches.map((m) => `${m.brand} ${m.model}${m.verified ? " (verified)" : " (unverified)"}`).join(", ")}.</p>
                )}
                <ItemsEditor items={quote.line_items} onChange={(line_items) => setQuote({ ...quote, line_items })} />
                {mode === "full" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Num label="Grand total (Rs)" value={quote.grand_total} onChange={(v) => setQuote({ ...quote, grand_total: v })} />
                    <Num label="Savings claimed (Rs/month)" value={quote.claimed_monthly_savings_rs} onChange={(v) => setQuote({ ...quote, claimed_monthly_savings_rs: v })} />
                    <div><label>Payment terms</label><input value={quote.payment_terms ?? ""} onChange={(e) => setQuote({ ...quote, payment_terms: e.target.value })} /></div>
                    <label className="!text-ink !text-sm flex items-center gap-2 col-span-2 sm:col-span-3">
                      <input type="checkbox" className="w-4 h-4" checked={!!quote.savings_assumes_net_metering}
                        onChange={(e) => setQuote({ ...quote, savings_assumes_net_metering: e.target.checked })} />
                      The installer&apos;s savings assume 1:1 net metering (exported units offset imported units)
                    </label>
                  </div>
                )}
              </Card>
              <SystemEditor system={system} onChange={setSystem} quote={quote} />
              <ActionBar>
                <Button variant="ghost" onClick={() => setStep(step - 1)}>← {t("back")}</Button>
                <Button onClick={submit} disabled={!!busy || (mode === "full" && !system.panel_count)}>{parts ? "Check my parts" : "Check my quote"} <span className="arrow">→</span></Button>
              </ActionBar>
            </div>
          </StepShell>
        )}
      </div>
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
        <div>
          <label>Bill month</label>
          <select value={bill.bill_month ?? ""} onChange={(e) => onChange({ ...bill, bill_month: e.target.value ? Number(e.target.value) : null })}>
            <option value="">unknown</option>
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <Num label="Energy charges (Rs)" value={bill.energy_charges_rs} onChange={(v) => onChange({ ...bill, energy_charges_rs: v })} />
        <Num label="Export units (net-metered)" value={bill.export_units} onChange={(v) => onChange({ ...bill, export_units: v })} />
        <Num label="Sanctioned load (kW)" step={0.5} value={bill.sanctioned_load_kw} onChange={(v) => onChange({ ...bill, sanctioned_load_kw: v })} />
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
        <div>
          <label htmlFor="facing">Panels will face</label>
          <select id="facing" value={String(system.azimuth)} onChange={(e) => onChange({ ...system, azimuth: Number(e.target.value) })}>
            <option value="180">South (best)</option><option value="135">South-east</option><option value="225">South-west</option>
            <option value="90">East</option><option value="270">West</option><option value="0">North</option>
          </select>
        </div>
        <Num label="Tilt (degrees)" value={system.tilt} onChange={(v) => onChange({ ...system, tilt: v ?? 20 })} />
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
  const id = useId();
  return (
    <div><label htmlFor={id}>{label}</label>
      <select id={id} value={String(v ?? "")} onChange={(e) => on(e.target.value)}>
        {opts.map((o) => <option key={o} value={o}>{o ? o.replace("_", "-") : "unknown"}</option>)}
      </select>
    </div>
  );
}

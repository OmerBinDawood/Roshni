"use client";
import { useEffect, useState } from "react";
import { api, type AC, type Profile } from "@/lib/api";
import { Button, Num } from "./ui";

export default function ProfileForm({ value, onChange, showRegime = true }: {
  value: Profile; onChange: (p: Profile) => void; showRegime?: boolean;
}) {
  const [cities, setCities] = useState<string[]>(["Lahore"]);
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [nm, setNm] = useState<"none" | "legacy" | "new">(value.net_metering_agreement_date ? (value.net_metering_agreement_date < "2026-02-09" ? "legacy" : "new") : "none");
  useEffect(() => { api.get<{ cities: string[] }>("/meta").then((m) => setCities(m.cities)).catch(() => {}); }, []);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...value, [k]: v });

  async function parse() {
    setParsing(true);
    try {
      const p = await api.post<Partial<Profile>>("/profile/parse", { text: freeText });
      const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined)) as Partial<Profile>;
      if (clean.acs) clean.acs = clean.acs.map((a: Partial<AC>) => ({ count: 1, tons: 1.5, inverter: true, day_hours: 6, night_hours: 6, ...a }));
      onChange({ ...value, ...clean });
    } catch (e) { alert((e as Error).message); } finally { setParsing(false); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-bg p-3 space-y-2">
        <label>Describe your home in your own words (optional) — e.g. “Ghar mein 2 AC hain, ek inverter wala 1.5 ton, 1 HP motor, 4 ghantay load-shedding”</label>
        <textarea dir="auto" rows={2} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
        <Button variant="ghost" onClick={parse} disabled={!freeText.trim() || parsing}>{parsing ? "Reading…" : "Fill the form for me"}</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>City</label>
          <select value={value.city} onChange={(e) => set("city", e.target.value)}>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>Main goal</label>
          <select value={value.goal} onChange={(e) => set("goal", e.target.value as Profile["goal"])}>
            <option value="both">Lower bill + backup</option>
            <option value="bill">Lower bill</option>
            <option value="backup">Backup in load-shedding</option>
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-semibold">Air conditioners</legend>
        {value.acs.map((ac, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
            <Num label="How many" value={ac.count} onChange={(v) => set("acs", value.acs.map((a, j) => j === i ? { ...a, count: v ?? 0 } : a))} />
            <div>
              <label>Tons</label>
              <select value={ac.tons} onChange={(e) => set("acs", value.acs.map((a, j) => j === i ? { ...a, tons: Number(e.target.value) } : a))}>
                {[1, 1.5, 2, 2.5, 4].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Type</label>
              <select value={ac.inverter ? "1" : "0"} onChange={(e) => set("acs", value.acs.map((a, j) => j === i ? { ...a, inverter: e.target.value === "1" } : a))}>
                <option value="1">Inverter</option><option value="0">Non-inverter</option>
              </select>
            </div>
            <Num label="Day hours (summer)" value={ac.day_hours} onChange={(v) => set("acs", value.acs.map((a, j) => j === i ? { ...a, day_hours: v ?? 0 } : a))} />
            <Num label="Night hours (summer)" value={ac.night_hours} onChange={(v) => set("acs", value.acs.map((a, j) => j === i ? { ...a, night_hours: v ?? 0 } : a))} />
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => set("acs", [...value.acs, { count: 1, tons: 1.5, inverter: true, day_hours: 6, night_hours: 6 }])}>+ Add AC type</Button>
          {value.acs.length > 0 && <Button variant="ghost" onClick={() => set("acs", value.acs.slice(0, -1))}>Remove last</Button>}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Num label="Water motor (HP)" step={0.5} value={value.motor_hp} onChange={(v) => set("motor_hp", v ?? 0)} />
        <Num label="Fridges/freezers" value={value.fridges} onChange={(v) => set("fridges", v ?? 0)} />
        <Num label="Fans" value={value.fans} onChange={(v) => set("fans", v ?? 0)} />
        <Num label="Lights" value={value.lights} onChange={(v) => set("lights", v ?? 0)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="font-semibold">During load-shedding</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Num label="Outage hours / day" step={0.5} value={value.outage_hours_per_day} onChange={(v) => set("outage_hours_per_day", v ?? 0)} />
          <Num label="Fans to keep on" value={value.backup_fans} onChange={(v) => set("backup_fans", v ?? 0)} />
          <Num label="Lights to keep on" value={value.backup_lights} onChange={(v) => set("backup_lights", v ?? 0)} />
          <Num label="ACs to keep on" value={value.backup_ac} onChange={(v) => set("backup_ac", v ?? 0)} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Check label="I need backup in load-shedding" v={value.wants_backup} on={(b) => set("wants_backup", b)} />
          <Check label="Keep fridge on" v={value.backup_fridge} on={(b) => set("backup_fridge", b)} />
          <Check label="Run water motor on backup" v={value.backup_motor} on={(b) => set("backup_motor", b)} />
        </div>
      </fieldset>

      {showRegime && (
        <fieldset className="space-y-2">
          <legend className="font-semibold">Net metering agreement</legend>
          <p className="text-sm text-muted">This decides which rules apply to your savings.</p>
          <div className="flex flex-col gap-1 text-sm">
            <Radio name="nm" label="No agreement yet / applying now (net billing)" checked={nm === "none"} on={() => { setNm("none"); set("net_metering_agreement_date", null); }} />
            <Radio name="nm" label="Signed before 9 Feb 2026 (legacy net metering)" checked={nm === "legacy"} on={() => { setNm("legacy"); set("net_metering_agreement_date", "2025-01-01"); }} />
            <Radio name="nm" label="Signed on/after 9 Feb 2026 (net billing)" checked={nm === "new"} on={() => { setNm("new"); set("net_metering_agreement_date", "2026-03-01"); }} />
          </div>
          {nm === "legacy" && (
            <div className="max-w-xs">
              <label>Agreement date</label>
              <input type="date" max="2026-02-08" value={value.net_metering_agreement_date ?? ""} onChange={(e) => set("net_metering_agreement_date", e.target.value)} />
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

function Check({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return <span className="inline-flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={v} onChange={(e) => on(e.target.checked)} />{label}</span>;
}
function Radio({ name, label, checked, on }: { name: string; label: string; checked: boolean; on: () => void }) {
  return <span className="inline-flex items-center gap-2"><input type="radio" className="w-4 h-4" name={name} checked={checked} onChange={on} />{label}</span>;
}

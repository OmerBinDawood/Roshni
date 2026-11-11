"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { useLang } from "@/lib/i18n";

const SCENES = ["Day", "Night", "Load-shedding (day)", "Load-shedding (night)"] as const;
type Sys = "On-grid" | "Hybrid" | "Off-grid";
const WORKS: Record<Sys, boolean[]> = {
  "On-grid": [true, true, false, false],
  Hybrid: [true, true, true, true],
  "Off-grid": [true, true, true, true],
};
const NOTE: Record<Sys, string[]> = {
  "On-grid": ["Solar runs the house; extra goes to grid.", "Grid powers the house.", "Inverter shuts off for safety — even in sunshine.", "Total blackout."],
  Hybrid: ["Solar runs the house and charges battery.", "Battery first, then grid.", "Solar + battery keep chosen loads on.", "Battery keeps chosen loads on until empty."],
  "Off-grid": ["Solar runs loads and charges battery.", "Battery only — no grid backup.", "Not affected: never connected.", "Battery only."],
};

const APPLIANCES = [
  { id: "fan", name: "Ceiling fan", icon: "🌀", kw: 0.08, surge: 0.08 },
  { id: "light", name: "LED light", icon: "💡", kw: 0.015, surge: 0.015 },
  { id: "fridge", name: "Fridge", icon: "🧊", kw: 0.15, surge: 0.8 },
  { id: "tv", name: "TV + router", icon: "📺", kw: 0.12, surge: 0.12 },
  { id: "ac", name: "1.5 ton inverter AC", icon: "❄️", kw: 1.1, surge: 1.4 },
  { id: "motor", name: "1 HP water motor", icon: "🚰", kw: 0.75, surge: 2.25 },
  { id: "iron", name: "Iron", icon: "👕", kw: 1.0, surge: 1.0 },
];

const LESSONS = [
  ["Units vs kW", "A 'unit' on your bill is 1 kWh: 1 kW running for 1 hour. kW is how hard something pulls right now; units are how much it used over time."],
  ["What is kWp?", "The size of your panels under lab conditions. 10 panels × 585 W = 5.85 kWp. In Pakistan each kWp makes roughly 4 to 4.5 units a day on average."],
  ["Inverter size", "The inverter must handle everything switched on at once, plus the kick when a motor or fridge starts."],
  ["Battery size", "Size a battery by what must run in load-shedding and for how long — not by your whole monthly bill. Compare batteries by usable kWh."],
  ["Net billing", "Since 9 Feb 2026, new users sell extra units at about Rs 10–11, but buy at your full tariff. Use solar during the day; don't oversize just to export."],
  ["Fixed charges", "Since Feb 2026 a fixed monthly charge applies whatever you use. Solar cannot remove it."],
];

export default function LearnPage() {
  const { t } = useLang();
  const [sys, setSys] = useState<Sys>("On-grid");
  const [on, setOn] = useState<Record<string, number>>({ fan: 3, light: 5, fridge: 1 });
  const [battKwh, setBattKwh] = useState(5);
  const [invKw, setInvKw] = useState(6);
  const load = useMemo(() => APPLIANCES.reduce((s, a) => s + (on[a.id] ?? 0) * a.kw, 0), [on]);
  const worstStart = useMemo(() => Math.max(0, ...APPLIANCES.filter((a) => on[a.id]).map((a) => a.surge - a.kw)), [on]);
  const hours = load ? battKwh / load : 0;
  const tooBig = load > invKw;
  const startTrip = load + worstStart > invKw * 2;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("learn")}</h1>

      <Card>
        <h2 className="font-semibold text-lg">On-grid, hybrid or off-grid?</h2>
        <div className="mt-3 flex gap-2 flex-wrap">
          {(Object.keys(WORKS) as Sys[]).map((s) => (
            <button key={s} onClick={() => setSys(s)} className={`px-4 py-2 rounded-full border ${sys === s ? "bg-sun/25 border-sun font-semibold" : "border-line"}`}>{s}</button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SCENES.map((sc, i) => (
            <div key={sc} className={`rounded-xl p-3 border transition ${WORKS[sys][i] ? "bg-sun/10 border-sun/40" : "bg-ink/5 border-line"}`}>
              <div className="text-2xl">{i % 2 === 0 ? "☀️" : "🌙"}{i >= 2 ? "⚡✖" : ""}</div>
              <div className="font-medium text-sm mt-1">{sc}</div>
              <div className={`text-3xl my-1 ${WORKS[sys][i] ? "" : "grayscale opacity-40"}`}>🏠💡</div>
              <p className="text-xs text-muted">{NOTE[sys][i]}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg">Backup simulator · <span className="urdu font-normal">کیا چلے گا، کتنی دیر؟</span></h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            {APPLIANCES.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <span className={on[a.id] ? "" : "opacity-50"}>{a.icon} {a.name}</span>
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded-full border border-line" onClick={() => setOn({ ...on, [a.id]: Math.max(0, (on[a.id] ?? 0) - 1) })}>−</button>
                  <span className="w-5 text-center">{on[a.id] ?? 0}</span>
                  <button className="w-8 h-8 rounded-full border border-line" onClick={() => setOn({ ...on, [a.id]: (on[a.id] ?? 0) + 1 })}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div><label>Usable battery: {battKwh} kWh</label><input type="range" min={1} max={20} step={0.5} value={battKwh} onChange={(e) => setBattKwh(Number(e.target.value))} className="!p-0 !border-0" /></div>
            <div><label>Inverter: {invKw} kW</label><input type="range" min={1} max={12} step={0.5} value={invKw} onChange={(e) => setInvKw(Number(e.target.value))} className="!p-0 !border-0" /></div>
            <div className="rounded-xl bg-bg p-4 text-center">
              <div className="text-sm text-muted">Running load {load.toFixed(2)} kW</div>
              <div className="text-4xl font-bold">{tooBig ? "✖" : `${hours >= 24 ? "24+" : hours.toFixed(1)} h`}</div>
              <div className="text-sm text-muted">on a full battery, no sun</div>
            </div>
            {tooBig && <p className="text-sm text-bad">Too much at once — the inverter would overload.</p>}
            {!tooBig && startTrip && <p className="text-sm text-warn">Starting the motor/fridge may trip the inverter while everything else runs.</p>}
            <p className="text-xs text-muted">Typical wattages; your appliances may differ. Real batteries also lose some energy (~5–10%).</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg">Solar Seekhein · <span className="urdu font-normal">سولر سیکھیں</span></h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {LESSONS.map(([h, b]) => (
            <details key={h} className="rounded-xl bg-bg p-3">
              <summary className="font-medium cursor-pointer">{h}</summary>
              <p className="mt-2 text-sm text-muted">{b}</p>
            </details>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Have a question? Ask Madadgar (bottom corner) in Urdu, Roman Urdu or English.</p>
      </Card>
    </div>
  );
}

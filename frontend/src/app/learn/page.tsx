"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import { GLOSSARY, LESSONS } from "@/lib/learn";

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

export default function LearnPage() {
  const { t, lang } = useLang();
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

      <Quiz />

      <Card>
        <h2 className="font-semibold text-lg">Solar Seekhein · <span className="urdu font-normal">سولر سیکھیں</span></h2>
        <p className="text-sm text-muted">10 two-minute lessons. Tap 🔊 to listen.</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {LESSONS.map((l, i) => {
            const [h, body] = lang === "ur" ? l.ur : l.en;
            return (
              <details key={l.id} id={l.id} className="rounded-xl bg-bg p-3">
                <summary className={`font-medium cursor-pointer ${lang === "ur" ? "urdu" : ""}`}>{i + 1}. {l.icon} {h}</summary>
                <p className={`mt-2 text-sm ${lang === "ur" ? "urdu" : "text-muted"}`}>{body}</p>
                <button className="mt-1 text-xs text-muted hover:text-ink" onClick={() => speak(body, lang)}>🔊 Listen</button>
              </details>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">Have a question? Ask Madadgar (bottom corner) in Urdu, Roman Urdu or English.</p>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="glossary">Glossary</h2>
        <dl className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {GLOSSARY.map(([term, def]) => (
            <div key={term}><dt className="font-medium">{term}</dt><dd className="text-muted">{def}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ur" ? "ur-PK" : "en-US";
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

// "Which type fits me?" 3-question quiz (PRD 9.8)
const QUESTIONS = [
  { q: "Do you need lights and fans during load-shedding?", opts: [["Yes, that's the main reason", 2], ["Would be nice", 1], ["No, I just want a lower bill", 0]] },
  { q: "How long are outages where you live?", opts: [["More than 4 hours a day", 2], ["1 to 4 hours", 1], ["Rare / almost none", 0]] },
  { q: "Is your grid connection reliable enough to sell extra units?", opts: [["No grid / very weak grid", 3], ["Yes, normal connection", 0]] },
] as const;

function Quiz() {
  const [ans, setAns] = useState<(number | null)[]>([null, null, null]);
  const done = ans.every((a) => a !== null);
  const score = ans.reduce<number>((s, a) => s + (a ?? 0), 0);
  const result = !done ? null : ans[2] === 3
    ? ["Off-grid", "Without a dependable grid, an off-grid system with batteries is the practical choice. Size the battery for your night-time needs."]
    : score >= 3
      ? ["Hybrid with a battery", "Backup matters to you. A hybrid inverter with a battery keeps chosen appliances running in load-shedding and also lowers your bill."]
      : score >= 1
        ? ["Hybrid (battery now or later)", "A hybrid inverter lets you start without a battery and add one later. Check that the inverter supports the battery you may add."]
        : ["On-grid", "If you only want a lower bill and rarely face outages, on-grid is the cheapest. Remember: it gives no backup in load-shedding."];
  return (
    <Card>
      <h2 className="font-semibold text-lg">Which type fits me?</h2>
      <div className="mt-3 space-y-4">
        {QUESTIONS.map((q, i) => (
          <fieldset key={q.q}>
            <legend className="font-medium text-sm">{i + 1}. {q.q}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {q.opts.map(([label, v]) => (
                <button key={label} onClick={() => setAns(ans.map((x, j) => (j === i ? (v as number) : x)))}
                  className={`px-3 py-1.5 rounded-full border text-sm ${ans[i] === v ? "bg-sun/25 border-sun" : "border-line"}`}>{label}</button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {result && (
        <div className="mt-4 rounded-xl bg-sun/15 p-4">
          <div className="text-sm text-muted">Likely fit</div>
          <div className="text-xl font-bold">{result[0]}</div>
          <p className="text-sm mt-1">{result[1]}</p>
          <p className="text-xs text-muted mt-2">A rough guide only. Already have a quote? <a className="underline" href="/audit">Check it</a>.</p>
        </div>
      )}
    </Card>
  );
}

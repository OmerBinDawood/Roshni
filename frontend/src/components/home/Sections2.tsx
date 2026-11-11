"use client";
import { useState } from "react";
import { Reveal } from "./motion";

/* ------------------------------------------------------------------ Simulator */
const GEN = 650, LOAD = 400, USE_RATE = 40, EXPORT_RATE = 11, BATT_PER_MONTH = 135;

export function Simulator() {
  const [day, setDay] = useState(40);
  const [batt, setBatt] = useState(false);
  const dayUse = LOAD * (day / 100);
  const eve = LOAD - dayUse;
  const shifted = batt ? Math.min(BATT_PER_MONTH, eve) : 0;
  const self = Math.min(GEN, dayUse + shifted);
  const exp = GEN - self;
  const value = Math.round(self * USE_RATE + exp * EXPORT_RATE);
  const oldRules = Math.round(GEN * USE_RATE);
  const w = (n: number, max: number, lo = 2, hi = 16) => lo + (n / max) * (hi - lo);

  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
        <Reveal>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-sun-ink">Net billing, made visible</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">When you use your solar matters more than how much you make</h2>
          <p className="mt-4 text-lg text-muted">Under the 2026 rules a unit you use yourself is worth about four times a unit you export. Move the slider and see why Roshni simulates all 8,760 hours of a year instead of using a monthly average.</p>

          <div className="mt-8 card p-5 space-y-5">
            <div>
              <div className="flex justify-between text-sm font-semibold"><label htmlFor="sim-day" className="!text-ink !mb-0">Share of your electricity used in the daytime</label><span className="tabular-nums">{day}%</span></div>
              <input id="sim-day" type="range" min={15} max={85} value={day} onChange={(e) => setDay(Number(e.target.value))} className="mt-2" />
              <div className="flex justify-between text-xs text-muted"><span>Mostly evening and night</span><span>Mostly daytime</span></div>
            </div>
            <button onClick={() => setBatt(!batt)} className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${batt ? "bg-sun/20 border-sun" : "bg-bg border-line hover:border-sun"}`} aria-pressed={batt}>
              <span>🔋 Add a 5 kWh battery</span>
              <span className={`relative w-11 h-6 rounded-full transition ${batt ? "bg-sun-ink/80" : "bg-line"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${batt ? "left-[22px]" : "left-0.5"}`} /></span>
            </button>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-bg p-3"><div className="text-xs text-muted">Used at home</div><div className="font-display text-xl font-extrabold text-leaf tabular-nums">{Math.round((self / GEN) * 100)}%</div></div>
              <div className="rounded-xl bg-bg p-3"><div className="text-xs text-muted">Exported</div><div className="font-display text-xl font-extrabold text-info tabular-nums">{Math.round((exp / GEN) * 100)}%</div></div>
              <div className="rounded-xl bg-sun/20 p-3"><div className="text-xs text-sun-ink">Value / month</div><div className="font-display text-xl font-extrabold tabular-nums">Rs {value.toLocaleString("en-PK")}</div></div>
            </div>
            <p className="text-xs text-muted">Illustration: a 5 kW system making {GEN} units a month for a home using {LOAD}, at about Rs {USE_RATE} per imported unit and Rs {EXPORT_RATE} per exported unit. Under old 1:1 net metering the same system would have shown about Rs {oldRules.toLocaleString("en-PK")}. Your report uses your bill and an hourly simulation.</p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="relative rounded-[2rem] border border-line bg-[linear-gradient(160deg,#fffaf0,#eaf2ff)] p-6 shadow-[0_30px_80px_rgba(15,27,45,0.1)]">
            <svg viewBox="0 0 460 420" className="w-full" role="img" aria-label="Energy flow from sun to home, battery and grid">
              <defs>
                <radialGradient id="sg" cx="35%" cy="30%"><stop offset="0" stopColor="#fffbd0" /><stop offset="0.5" stopColor="#ffc94d" /><stop offset="1" stopColor="#f58a07" /></radialGradient>
              </defs>
              <circle cx="230" cy="70" r="70" fill="url(#sg)" opacity="0.25" /><circle cx="230" cy="70" r="36" fill="url(#sg)" />
              {/* flows */}
              <path d="M215 104 C 160 160, 130 200, 110 250" fill="none" stroke="#10b5a3" strokeWidth={w(self, GEN)} strokeLinecap="round" strokeDasharray="1 14" style={{ animation: "dash-flow 0.9s linear infinite" }} />
              <path d="M245 104 C 300 160, 330 200, 350 250" fill="none" stroke="#2f6bff" strokeWidth={w(exp, GEN)} strokeLinecap="round" strokeDasharray="1 14" style={{ animation: "dash-flow 0.9s linear infinite" }} />
              {batt && <path d="M230 106 L 230 250" fill="none" stroke="#ffb020" strokeWidth={w(shifted, BATT_PER_MONTH, 3, 12)} strokeLinecap="round" strokeDasharray="1 14" style={{ animation: "dash-flow 0.9s linear infinite" }} />}
              {/* house */}
              <g transform="translate(60 250)"><path d="M0 50 L50 6 L100 50 V110 H0 Z" fill="#fff" stroke="#0f1b2d" strokeWidth="2.5" strokeLinejoin="round" /><rect x="38" y="68" width="24" height="42" fill="#ffe3a3" stroke="#0f1b2d" strokeWidth="2" /><rect x="64" y="14" width="22" height="12" fill="#1c3f7c" transform="rotate(-24 75 20)" /></g>
              <text x="110" y="395" textAnchor="middle" className="fill-ink text-[13px] font-bold">Your home</text>
              {/* battery */}
              <g transform="translate(200 250)"><rect x="0" y="0" width="60" height="110" rx="10" fill="#fff" stroke="#0f1b2d" strokeWidth="2.5" /><rect x="20" y="-8" width="20" height="8" rx="2" fill="#0f1b2d" />
                <rect x="6" y={104 - (batt ? 92 * Math.min(1, shifted / BATT_PER_MONTH) : 0)} width="48" height={batt ? 92 * Math.min(1, shifted / BATT_PER_MONTH) : 0} rx="6" fill="#ffb020" style={{ transition: "all 0.5s ease" }} /></g>
              <text x="230" y="395" textAnchor="middle" className="fill-ink text-[13px] font-bold">{batt ? "Battery" : "No battery"}</text>
              {/* grid pylon */}
              <g transform="translate(320 250)" stroke="#0f1b2d" strokeWidth="2.5" fill="none" strokeLinecap="round"><path d="M30 0 L8 110 M30 0 L52 110 M16 60 H44 M10 90 H50 M4 28 H56 M30 0 V-12" /></g>
              <text x="350" y="395" textAnchor="middle" className="fill-ink text-[13px] font-bold">Grid</text>
              <text x="140" y="170" className="fill-teal text-[12px] font-bold">used at home</text>
              <text x="318" y="170" className="fill-info text-[12px] font-bold">exported</text>
            </svg>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Audit console */
const FINDINGS = [
  { id: "R03", sev: "bad", title: "String voltage too high on cold mornings", ev: "10 panels in series reach about 555 V at −2 °C, above the inverter's 500 V maximum. This can permanently damage the inverter.", q: "Can you reduce the string to 9 panels or fewer?" },
  { id: "R19", sev: "bad", title: "Savings claim looks based on old net-metering rules", ev: "The quote promises Rs 60,000 a month. For this home under net billing Roshni estimates about Rs 19,000 to 24,000.", q: "Your savings assume 1:1 net metering; new connections get net billing. Please recalculate." },
  { id: "R12", sev: "warn", title: "DC protection not listed", ev: "The quote does not mention a DC breaker, isolator or surge protector. Missing items are a common cause of fires and hidden extra charges.", q: "Which DC breaker and surge protector are included?" },
  { id: "R27", sev: "warn", title: "Quote is bigger than Roshni's sizing for your home", ev: "Extra panels beyond about 5 kW stop paying for themselves within 6 years or export much of their output at the low buyback rate.", q: "Why this size, and how much will the extra panels save each month?" },
  { id: "R01", sev: "ok", title: "All main items have brand and model", ev: "Every panel, inverter and battery line has an exact model, so compatibility and warranty can be checked.", q: "" },
];
const SEV = { bad: ["bg-bad/10 border-bad/30", "bg-bad", "Critical"], warn: ["bg-warn/10 border-warn/30", "bg-warn", "Ask installer"], ok: ["bg-leaf/10 border-leaf/30", "bg-leaf", "Fine"] } as const;

export function AuditConsole() {
  const [open, setOpen] = useState("R03");
  return (
    <section className="relative bg-[linear-gradient(180deg,#fffaf0,#fff)] py-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
        <Reveal>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-sun-ink">The audit</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">Every finding shows its evidence and the question to ask</h2>
          <p className="mt-4 text-lg text-muted">No mystery score. Each rule is specific and testable, written in plain language, and ends with something you can say to the installer.</p>
          <ul className="mt-6 space-y-3">
            {["Missing datasheet means “cannot verify”, never “pass”", "Rules are public on the About page", "Safety issues are separated from money issues"].map((x) => (
              <li key={x} className="flex gap-3"><span className="mt-1 w-5 h-5 rounded-full bg-sun/30 grid place-items-center text-xs font-bold">✓</span>{x}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={150}>
          <div className="relative card p-3 sm:p-4 space-y-2 shadow-[0_30px_80px_rgba(15,27,45,0.12)]">
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-2 font-bold"><span className="w-2.5 h-2.5 rounded-full bg-leaf animate-pulse" />Roshni audit <span className="text-xs font-normal text-muted">sample</span></div>
              <div className="text-xs text-muted">2 critical · 2 to ask · 1 fine</div>
            </div>
            {FINDINGS.map((f) => {
              const s = SEV[f.sev as keyof typeof SEV];
              const on = open === f.id;
              return (
                <button key={f.id} onClick={() => setOpen(on ? "" : f.id)} aria-expanded={on}
                  className={`w-full text-start rounded-2xl border p-3.5 transition-all duration-300 ${s[0]} ${on ? "shadow-md" : "hover:translate-x-1"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${s[1]}`} />
                    <span className="font-mono text-xs font-bold w-9">{f.id}</span>
                    <span className="flex-1 font-semibold">{f.title}</span>
                    <span className="text-[0.68rem] font-bold uppercase tracking-wide opacity-80 hidden sm:inline">{s[2]}</span>
                    <span className={`transition-transform duration-300 ${on ? "rotate-180" : ""}`}>⌄</span>
                  </div>
                  <div className={`grid transition-all duration-300 ${on ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden text-sm space-y-2">
                      <p>{f.ev}</p>
                      {f.q && <p className="rounded-lg bg-white/80 border border-line px-3 py-2"><b>Ask:</b> {f.q}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

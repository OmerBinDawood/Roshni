"use client";
import Link from "next/link";
import { Reveal } from "./motion";

/* ---------------------------------------------------------------- feature mini visuals (each reacts differently on hover) */
function VQuote() {
  return (
    <div className="relative h-28 rounded-xl bg-bg border border-line p-3 overflow-hidden">
      {[80, 62, 90, 48, 70].map((w, i) => <div key={i} className="h-2 rounded bg-ink/15 mb-2 group-hover:bg-sun/50 transition-colors" style={{ width: `${w}%`, transitionDelay: `${i * 80}ms` }} />)}
      <span className="absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-sun/40 to-transparent opacity-0 group-hover:opacity-100 group-hover:[animation:scan_1.6s_ease-in-out_infinite]" />
    </div>
  );
}
function VSize() {
  return (
    <div className="h-28 rounded-xl bg-bg border border-line p-3 flex items-end gap-2">
      {[28, 52, 76, 60].map((h, i) => <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-sun to-[#ffd77a] origin-bottom transition-transform duration-500 scale-y-[0.45] group-hover:scale-y-100" style={{ height: `${h}%`, transitionDelay: `${i * 90}ms` }} />)}
    </div>
  );
}
function VBill() {
  return (
    <div className="h-28 rounded-xl bg-bg border border-line p-3 space-y-1.5">
      {["Energy charges", "Fixed charges", "FPA", "GST"].map((x, i) => (
        <div key={x} className="flex justify-between text-[0.7rem] rounded px-1.5 py-0.5 transition-colors duration-300 group-hover:bg-sun/25" style={{ transitionDelay: `${i * 120}ms` }}><span>{x}</span><span className="font-mono">Rs ••••</span></div>
      ))}
    </div>
  );
}
function VBattery() {
  return (
    <div className="h-28 rounded-xl bg-bg border border-line grid place-items-center">
      <div className="relative w-12 h-20 rounded-lg border-2 border-ink bg-white overflow-hidden"><span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-ink rounded-sm" />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-sun to-[#ffe08a] transition-all duration-1000 ease-out h-[18%] group-hover:h-[88%]" /></div>
    </div>
  );
}
function VParts() {
  return (
    <div className="relative h-28 rounded-xl bg-bg border border-line flex items-center justify-around px-2 text-lg">
      {["☀️", "⚡", "🔋"].map((x, i) => <span key={i} className="w-10 h-10 rounded-xl bg-white border border-line grid place-items-center shadow-sm transition-transform duration-300 group-hover:-translate-y-1.5" style={{ transitionDelay: `${i * 100}ms` }}>{x}</span>)}
      <span className="absolute text-leaf font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-y-10">✓ compatible</span>
    </div>
  );
}
function VReady() {
  return (
    <div className="h-28 rounded-xl bg-bg border border-line grid place-items-center">
      <div className="flex gap-2">{["bg-bad", "bg-sun", "bg-leaf"].map((c, i) => <span key={i} className={`w-7 h-7 rounded-full ${c} opacity-25 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110`} style={{ transitionDelay: `${i * 180}ms` }} />)}</div>
    </div>
  );
}
function VHealth() {
  return (
    <div className="h-28 rounded-xl bg-bg border border-line p-2">
      <svg viewBox="0 0 160 70" className="w-full h-full"><path d="M0 50 C 30 10, 60 10, 80 30 S 130 60, 160 20" fill="none" stroke="#10b5a3" strokeWidth="2.5" strokeDasharray="200" strokeDashoffset="200" className="group-hover:[stroke-dashoffset:0] transition-all duration-1000" /><path d="M0 40 C 30 20, 60 20, 80 35 S 130 45, 160 30" fill="none" stroke="#ffb020" strokeWidth="2" strokeDasharray="4 4" /></svg>
    </div>
  );
}
function VCompare() {
  return (
    <div className="h-28 rounded-xl bg-bg border border-line p-3 grid grid-cols-2 gap-2 items-end">
      {[[70, 50], [55, 80]].map(([a, b], i) => (
        <div key={i} className="h-full flex flex-col justify-end gap-1.5">
          <div className="h-3 rounded bg-info/60 transition-all duration-500" style={{ width: `${a}%` }} /><div className="h-3 rounded bg-sun transition-all duration-500 group-hover:!w-full" style={{ width: `${b}%` }} />
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  { href: "/audit", t: "Check a quote", d: "Upload the quote and bill. Get a verdict, evidence for every finding, real savings and questions for the installer.", tag: "Most used", V: VQuote, wide: true },
  { href: "/size", t: "Size my solar", d: "No quote yet? Enter your appliances and bill and see system sizes, cost ranges, payback and backup.", tag: "New", V: VSize, wide: true },
  { href: "/bill", t: "Bill decoder", d: "Every line of your electricity bill explained, and how close you are to the 200-unit cliff.", V: VBill },
  { href: "/battery", t: "Battery advisor", d: "Already have solar? See if 5, 10 or 15 kWh pays back, or if you should keep the money.", V: VBattery },
  { href: "/audit?mode=parts", t: "Parts check", d: "Buying panels and an inverter yourself? Check they work together safely.", V: VParts },
  { href: "/readiness", t: "Ready for solar?", d: "A two-minute check that can honestly answer “not now”.", V: VReady },
  { href: "/health", t: "System health check", d: "Does your existing system make the units it should? Upload an inverter-app screenshot.", V: VHealth },
  { href: "/compare", t: "Compare quotes", d: "Two to four checked quotes side by side on one basis.", V: VCompare },
];
const SMALL = [
  { href: "/financing", t: "Loan vs savings", d: "Will the bank instalment beat what solar saves?", i: "🏦" },
  { href: "/brands", t: "Brand guide", d: "37 brands: how to verify, what to check, dated prices.", i: "🏷️" },
  { href: "/learn", t: "Learn", d: "10 short lessons and a glossary, with read-aloud.", i: "📚" },
  { href: "/guides", t: "Guides", d: "Net-billing paperwork, genuine panels, safety.", i: "📋" },
];

export function Features() {
  return (
    <section className="bg-white py-24" id="features">
      <div className="max-w-6xl mx-auto px-5">
        <Reveal className="max-w-3xl">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-sun-ink">Everything in one place</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">Whatever the solar question, there is a door for it</h2>
        </Reveal>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.href} delay={(i % 4) * 90} className={f.wide ? "lg:col-span-2" : ""}>
              <Link href={f.href} className="group relative block h-full card card-lift p-5 overflow-hidden">
                <span className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.35),transparent_65%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative"><f.V /></div>
                <div className="relative mt-4 flex items-center gap-2"><h3 className="font-display text-xl font-extrabold">{f.t}</h3>{f.tag && <span className="text-[0.65rem] font-bold uppercase tracking-wide rounded-full bg-sun/30 text-sun-ink px-2 py-0.5">{f.tag}</span>}</div>
                <p className="relative mt-1.5 text-sm text-muted">{f.d}</p>
                <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-bold">Open <span className="transition-transform group-hover:translate-x-1.5">→</span></span>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SMALL.map((f, i) => (
            <Reveal key={f.href} delay={i * 80}>
              <Link href={f.href} className="group flex items-center gap-4 rounded-2xl border border-line bg-bg p-4 hover:bg-white hover:border-sun hover:shadow-lg transition-all duration-300">
                <span className="w-12 h-12 shrink-0 rounded-2xl bg-white border border-line grid place-items-center text-2xl group-hover:rotate-[-8deg] group-hover:scale-110 transition-transform">{f.i}</span>
                <span><span className="block font-bold">{f.t}</span><span className="block text-sm text-muted">{f.d}</span></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- sizing preview with real price listings */
const OPTIONS = [
  { n: "Cut the bill", s: "2 kW on-grid", c: "Rs 2.3 to 3.6 lakh", p: "2.4 yrs", b: "No backup", tone: "from-[#eaf2ff] to-white" },
  { n: "Bill and backup", s: "5 kW + 5 kWh hybrid", c: "Rs 7.5 to 10.9 lakh", p: "3.7 yrs", b: "About 10.8 h backup", tone: "from-[#fff3d6] to-white", hot: true },
  { n: "Longer backup", s: "5 kW + 10 kWh hybrid", c: "Rs 9.8 to 14.2 lakh", p: "4.3 yrs", b: "About 21.5 h backup", tone: "from-[#e6fbf7] to-white" },
];
const PRICES = [["AIKO panels", "Rs 41 to 42.9 per watt", "listed 8 Oct 2026"], ["GoodWe 6 kW hybrid", "Rs 185,000 to 225,000", "listed 22 Oct 2026"], ["Dyness 5.12 kWh battery", "Rs 255,000 to 260,000", "listed 7 Aug 2026"]];

export function SizingPreview() {
  return (
    <section className="relative py-24 bg-[linear-gradient(180deg,#fff,#eaf2ff_60%,#fffaf0)] overflow-hidden">
      <div className="max-w-6xl mx-auto px-5">
        <Reveal className="max-w-3xl">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-sun-ink">Size my solar</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">No quote yet? Know what to ask for before you call anyone</h2>
          <p className="mt-4 text-lg text-muted">Tell Roshni your appliances, bill and budget. It works out your load and shows sized options with costs, then the brands to look at, with dated public prices.</p>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {OPTIONS.map((o, i) => (
            <Reveal key={o.n} delay={i * 110}>
              <div className={`group relative h-full rounded-3xl border p-6 bg-gradient-to-b ${o.tone} ${o.hot ? "border-sun shadow-[0_20px_60px_rgba(255,176,32,0.3)] md:-translate-y-3" : "border-line shadow-[0_10px_30px_rgba(15,27,45,0.06)]"} transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl`}>
                {o.hot && <span className="absolute -top-3 left-6 rounded-full bg-sun px-3 py-1 text-xs font-extrabold text-[#2a1700] shadow">Most homes start here</span>}
                <div className="text-sm font-bold text-muted">{o.n}</div>
                <div className="mt-1 font-display text-2xl font-extrabold">{o.s}</div>
                <div className="mt-4 text-3xl font-extrabold text-gradient-sun tabular-nums">{o.c}</div>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between border-t border-line pt-2"><dt className="text-muted">Simple payback</dt><dd className="font-bold">{o.p}</dd></div>
                  <div className="flex justify-between border-t border-line pt-2"><dt className="text-muted">In load-shedding</dt><dd className="font-bold">{o.b}</dd></div>
                </dl>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">Example for a Lahore home using about 490 units a month. Costs are indicative component ranges, not quotes.</p>

        <Reveal delay={100} className="mt-10 card p-6 grid lg:grid-cols-[1fr_1.4fr] gap-6 items-center">
          <div>
            <div className="font-display text-2xl font-extrabold">Public prices, with dates and sources</div>
            <p className="mt-2 text-sm text-muted">Roshni never ranks brands. It shows who makes what, how to verify it, and what dealers publicly list, then asks you to re-verify before you pay.</p>
            <Link href="/size" className="btn btn-primary mt-5">Size my solar <span className="arrow">→</span></Link>
          </div>
          <div className="space-y-2.5">
            {PRICES.map(([a, b, c]) => (
              <div key={a} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg border border-line px-4 py-3 hover:border-sun transition-colors">
                <span className="font-semibold">{a}</span><span className="font-bold tabular-nums">{b}</span><span className="text-xs text-muted">{c}</span>
              </div>
            ))}
            <div className="rounded-xl bg-warn/10 text-warn px-4 py-2.5 text-sm font-semibold">Re-verify every price with the seller before you pay.</div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

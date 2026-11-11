"use client";
import { CountUp, Reveal, useInView } from "./motion";

const CHECKS = ["Panel count and watts", "String voltage on cold mornings", "Inverter and battery match", "Backup hours", "DC and AC protection", "Earthing and cables", "Written warranties", "A-grade panels and distributor", "Net billing vs net metering", "Fixed charges and the 200-unit cliff", "Price against dated ranges", "Advance payment", "Roof direction", "Quote size vs your needs"];

export function Marquee() {
  const row = [...CHECKS, ...CHECKS];
  return (
    <section className="relative bg-white py-6 border-y border-line overflow-hidden" aria-label="What Roshni checks">
      <div className="text-center text-xs font-bold uppercase tracking-[0.2em] text-muted mb-4">What Roshni checks in every quote</div>
      <div className="flex w-max gap-3" style={{ animation: "marquee 48s linear infinite" }}>
        {row.map((c, i) => (
          <span key={i} className="shrink-0 rounded-full border border-line bg-bg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sun" />{c}
          </span>
        ))}
      </div>
    </section>
  );
}

function Bar({ label, value, max, color, start, note }: { label: string; value: number; max: number; color: string; start: boolean; note: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">{label}</span><span className="font-bold tabular-nums">Rs <CountUp to={value} start={start} /> / month</span></div>
      <div className="h-5 rounded-full bg-bg overflow-hidden border border-line">
        <div className="h-full rounded-full transition-[width] duration-[1600ms] ease-out" style={{ width: start ? `${(value / max) * 100}%` : "0%", background: color }} />
      </div>
      <div className="text-xs text-muted mt-1">{note}</div>
    </div>
  );
}

export function Problem() {
  const [ref, seen] = useInView<HTMLDivElement>(0.25);
  return (
    <section className="bg-white pt-8 pb-24">
      <div className="max-w-6xl mx-auto px-5">
        <Reveal className="max-w-3xl">
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-sun-ink">Why Roshni exists</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">The rules changed in February 2026. <span className="text-muted">A lot of quotes did not.</span></h2>
          <p className="mt-4 text-lg text-muted">Net billing replaced 1:1 net metering for new users. Many installers still promise savings the old way, and most buyers have no way to tell.</p>
        </Reveal>

        <div ref={ref} className="mt-12 grid lg:grid-cols-[1.1fr_1fr] gap-8 items-stretch">
          <Reveal className="card p-6 sm:p-8 space-y-7 bg-[linear-gradient(180deg,#fff,#fffaf0)]">
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg">A quote&apos;s promise vs the real estimate</div>
              <span className="text-xs rounded-full bg-sun/20 px-2.5 py-1 font-semibold text-sun-ink">Example</span>
            </div>
            <Bar label="Quote says" value={60000} max={60000} color="linear-gradient(90deg,#ffb020,#ff6a3d)" start={seen} note="“Your bill will be almost zero”, based on 1:1 unit offset." />
            <Bar label="Roshni estimates" value={24000} max={60000} color="linear-gradient(90deg,#10b5a3,#2f6bff)" start={seen} note="Same home under net billing: exports earn about Rs 11, not the full tariff." />
            <div className="rounded-xl bg-bad/10 text-bad px-4 py-3 text-sm font-medium">Rule R19 flags it: &quot;Savings claim looks based on old net-metering rules.&quot;</div>
            <p className="text-xs text-muted">Illustrative example from a test quote. Your report uses your own bill and an hourly simulation.</p>
          </Reveal>

          <div className="grid gap-4">
            {[
              { n: 26, pre: "Rs ", suf: " → Rs 11", t: "Export price per unit", d: "Buyback fell from about Rs 26 to Rs 27 to roughly Rs 10 to 11 for new users." },
              { n: 4, pre: "", suf: "×", t: "A used unit beats an exported one", d: "An imported unit costs about Rs 39 to 48; a unit you use yourself is worth that, an exported one about Rs 11." },
              { n: 96, pre: "", suf: "%", t: "Solar homes still without a battery", d: "Millions now ask whether storage pays under the new rules. Sometimes the honest answer is no." },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 120} className="card card-lift p-5 flex gap-5 items-center">
                <div className="font-display text-4xl font-extrabold text-gradient-sun min-w-[8.5rem] tabular-nums"><CountUp to={s.n} start={seen} prefix={s.pre} />{s.suf}</div>
                <div><div className="font-bold">{s.t}</div><p className="text-sm text-muted mt-0.5">{s.d}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

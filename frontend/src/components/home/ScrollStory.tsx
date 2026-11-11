"use client";
import { useSectionProgress } from "./motion";

const STEPS = [
  { k: "Upload", h: "Send the quote exactly as you got it", d: "A phone photo, a PDF, a forwarded WhatsApp message or a handwritten slip. English, Urdu or Roman Urdu. No account needed." },
  { k: "Extract", h: "Roshni turns it into a clean bill of materials", d: "Panels, inverter, battery, protection, warranty and price. You confirm every line, and Roshni never guesses a model number." },
  { k: "Audit", h: "27 engineering and money rules run on it", d: "String voltage, current, battery match, backup, protection, warranties, price, and savings under the rules that apply to you." },
  { k: "Decide", h: "A report you can take to the installer", d: "A verdict, the real savings range, what runs in load-shedding, and the exact questions to ask before you pay." },
];

const ROW = "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm";
const stagger = (on: boolean, i: number) => ({ opacity: on ? 1 : 0, transform: on ? "none" : "translateX(24px)", transition: `all 0.6s cubic-bezier(.2,.7,.2,1) ${on ? i * 110 : 0}ms` });

export function StoryVisual({ step }: { step: number }) {
  return (
    <div className="relative w-full h-full">
      {/* 0 upload */}
      <div className="absolute inset-0 p-6 flex flex-col justify-center gap-4" style={{ opacity: step === 0 ? 1 : 0, transform: step === 0 ? "none" : "scale(0.94) translateY(-12px)", transition: "all 0.6s ease", pointerEvents: "none" }}>
        <div className="mx-auto w-[88%] rounded-2xl bg-[#e7ffd9] border border-[#c8efb2] p-4 shadow-md -rotate-2 text-[0.82rem] leading-relaxed text-[#17301a] font-mono">
          <div className="text-[0.65rem] opacity-60 mb-1">Installer · 11:42</div>
          10 x Jinko 580W @ 24k<br />6kW hybrid inverter 2.3 lakh<br />5kWh lithium battery 2.8 lakh<br />Structure wiring installation 85k<br />Total 8.7 lakh, 70% advance
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          {["📷 Photo", "📄 PDF", "💬 Pasted chat", "✍️ Handwritten"].map((x, i) => (
            <span key={x} className="rounded-full bg-white border border-line px-3 py-1.5 text-sm font-medium shadow-sm" style={stagger(step === 0, i)}>{x}</span>
          ))}
        </div>
      </div>

      {/* 1 extract */}
      <div className="absolute inset-0 p-6 flex flex-col justify-center gap-2.5" style={{ opacity: step === 1 ? 1 : 0, transition: "opacity 0.5s", pointerEvents: "none" }}>
        <div className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Your confirmed bill of materials</div>
        {[
          ["Panels", "10 × 580 W = 5.8 kWp", "ok"], ["Inverter", "6 kW hybrid", "ok"], ["Battery", "5 kWh lithium", "ok"],
          ["Protection", "Not listed", "warn"], ["Warranty", "Not stated", "warn"], ["Price", "Rs 8.7 lakh (about Rs 150/W)", "ok"],
        ].map(([a, b, s], i) => (
          <div key={a} className={`${ROW} ${s === "warn" ? "bg-warn/10 border-warn/30" : "bg-white border-line"}`} style={stagger(step === 1, i)}>
            <span className="font-bold w-24">{a}</span><span className="flex-1 text-muted">{b}</span><span>{s === "warn" ? "⚠" : "✓"}</span>
          </div>
        ))}
      </div>

      {/* 2 audit */}
      <div className="absolute inset-0 p-6 flex flex-col justify-center gap-2.5" style={{ opacity: step === 2 ? 1 : 0, transition: "opacity 0.5s", pointerEvents: "none" }}>
        <div className="text-xs font-bold uppercase tracking-widest text-muted mb-1">Rules running</div>
        {[
          ["R03", "String too high on cold mornings", "bad", "Critical"], ["R19", "Savings assume old net metering", "bad", "Critical"],
          ["R12", "DC protection not listed", "warn", "Ask installer"], ["R17", "Warranty terms missing", "warn", "Ask installer"], ["R01", "All main items have brand and model", "ok", "Fine"],
        ].map(([r, t, s, l], i) => (
          <div key={r} className={`${ROW} ${s === "bad" ? "bg-bad/10 border-bad/30" : s === "warn" ? "bg-warn/10 border-warn/30" : "bg-leaf/10 border-leaf/30"}`} style={stagger(step === 2, i)}>
            <span className="font-mono text-xs font-bold w-9">{r}</span><span className="flex-1 font-medium">{t}</span>
            <span className={`text-[0.7rem] font-bold uppercase ${s === "bad" ? "text-bad" : s === "warn" ? "text-warn" : "text-leaf"}`}>{l}</span>
          </div>
        ))}
      </div>

      {/* 3 decide */}
      <div className="absolute inset-0 p-6 flex flex-col justify-center gap-3" style={{ opacity: step === 3 ? 1 : 0, transform: step === 3 ? "none" : "translateY(18px)", transition: "all 0.6s ease", pointerEvents: "none" }}>
        <div className="rounded-2xl bg-bad/10 border border-bad/30 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-bad">Verdict</div>
          <div className="font-display text-xl font-extrabold">Do not pay yet: critical issues found</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-white border border-line p-3"><div className="text-xs text-muted">Real saving</div><div className="font-bold text-lg">Rs 19k to 24k<span className="text-xs font-normal text-muted"> / mo</span></div></div>
          <div className="rounded-xl bg-white border border-line p-3"><div className="text-xs text-muted">Simple payback</div><div className="font-bold text-lg">about 3.7 years</div></div>
        </div>
        <div className="rounded-xl bg-white border border-line p-3 text-sm space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-widest text-muted">Ask the installer</div>
          <div>→ Can you reduce the string to a safe number of panels?</div>
          <div>→ Please recalculate savings under net billing.</div>
          <div>→ Which DC breaker and surge protector are included?</div>
        </div>
      </div>
    </div>
  );
}

export default function ScrollStory() {
  const [ref, p] = useSectionProgress<HTMLElement>();
  const step = Math.min(3, Math.floor(p * 4));
  return (
    <section className="relative bg-[linear-gradient(180deg,#ffffff,#fff3d6_40%,#fffaf0)]">
      <div className="max-w-6xl mx-auto px-5 pt-20 text-center">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-sun-ink">How it works</div>
        <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold">From messy quote to clear decision</h2>
        <p className="mt-3 text-lg text-muted max-w-2xl mx-auto">Scroll. Watch one real-style quote change as Roshni works on it.</p>
      </div>

      {/* desktop: sticky scroll story */}
      <section ref={ref} className="hidden lg:block relative" style={{ height: "380vh" }}>
        <div className="sticky top-0 h-screen flex items-center">
          <div className="max-w-6xl mx-auto px-5 w-full grid grid-cols-[1fr_1.05fr] gap-14 items-center">
            <ol className="space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.k} className={`relative pl-16 transition-all duration-500 ${i === step ? "opacity-100" : "opacity-35"}`}>
                  <span className={`absolute left-0 top-0 w-11 h-11 rounded-full grid place-items-center font-display font-extrabold transition-all duration-500 ${i === step ? "bg-sun text-[#2a1700] shadow-[0_0_28px_rgba(255,176,32,0.8)] scale-110" : i < step ? "bg-ink text-white" : "bg-white border border-line"}`}>{i < step ? "✓" : i + 1}</span>
                  <div className="text-xs font-bold uppercase tracking-widest text-muted">{s.k}</div>
                  <div className="font-display text-2xl font-extrabold leading-snug">{s.h}</div>
                  <div className={`overflow-hidden transition-all duration-500 ${i === step ? "max-h-32 opacity-100 mt-1" : "max-h-0 opacity-0"}`}><p className="text-muted">{s.d}</p></div>
                </li>
              ))}
              <li className="pl-16"><div className="h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-gradient-to-r from-sun to-[#ff6a3d]" style={{ width: `${p * 100}%` }} /></div></li>
            </ol>
            <div className="relative aspect-[1/1.02] max-h-[600px] rounded-[2rem] bg-white border border-line shadow-[0_30px_80px_rgba(15,27,45,0.14)] overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.4),transparent_65%)]" />
              <div className="absolute top-3 left-4 flex gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-bad/60" /><i className="w-2.5 h-2.5 rounded-full bg-sun" /><i className="w-2.5 h-2.5 rounded-full bg-leaf/70" /></div>
              <div className="absolute top-3 right-4 text-[0.65rem] font-bold uppercase tracking-widest text-muted">Sample quote</div>
              <div className="absolute inset-0 pt-6"><StoryVisual step={step} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* mobile: stacked */}
      <div className="lg:hidden max-w-xl mx-auto px-5 py-10 space-y-8">
        {STEPS.map((s, i) => (
          <div key={s.k} className="space-y-3">
            <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-sun grid place-items-center font-extrabold">{i + 1}</span><div className="font-display text-xl font-extrabold">{s.h}</div></div>
            <p className="text-muted">{s.d}</p>
            <div className="relative h-[380px] rounded-3xl bg-white border border-line shadow-lg overflow-hidden"><StoryVisual step={i} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}

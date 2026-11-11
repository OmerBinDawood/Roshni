"use client";
import { useEffect, useState, type ReactNode } from "react";

/** Numbered, connected stepper. On small screens it collapses to "Step 2 of 4 · Bill" with a progress bar. */
export function Stepper({ steps, current, onJump }: { steps: string[]; current: number; onJump?: (i: number) => void }) {
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 100;
  return (
    <div className="card p-4 sm:p-5">
      <div className="sm:hidden">
        <div className="flex items-center justify-between font-mono text-[0.7rem] tracking-[0.14em] font-bold">
          <span>STEP {current + 1} OF {steps.length}</span><span className="text-muted uppercase">{steps[current]}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-line overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-sun to-[#ff6a3d] transition-all duration-500" style={{ width: `${((current + 1) / steps.length) * 100}%` }} /></div>
      </div>
      <ol className="hidden sm:flex items-center relative" aria-label="Progress">
        <span aria-hidden className="absolute left-5 right-5 top-5 h-[3px] bg-line rounded" />
        <span aria-hidden className="absolute left-5 top-5 h-[3px] rounded bg-gradient-to-r from-sun to-[#ff6a3d] transition-all duration-700" style={{ width: `calc((100% - 2.5rem) * ${pct / 100})` }} />
        {steps.map((s, i) => {
          const done = i < current, on = i === current;
          return (
            <li key={s} className="relative flex-1 flex flex-col items-center gap-2 first:items-start last:items-end">
              <button type="button" disabled={!done || !onJump} onClick={() => onJump?.(i)} aria-current={on ? "step" : undefined}
                className={`relative z-10 w-10 h-10 grid place-items-center font-mono font-bold text-sm border-[1.5px] border-ink transition-all duration-300 ${on ? "bg-sun shadow-[3px_3px_0_0_var(--ink)] -translate-x-0.5 -translate-y-0.5" : done ? "bg-ink text-sun hover:bg-[#1c2f4b]" : "bg-white text-muted border-line"}`}>
                {done ? "✓" : String(i + 1).padStart(2, "0")}
              </button>
              <span className={`font-mono text-[0.68rem] tracking-[0.14em] uppercase ${on ? "font-bold text-ink" : "text-muted"}`}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Two-column step layout: a "what happens here" aside and the form. */
export function StepShell({ n, title, desc, tips, children }: { n: number; title: string; desc: string; tips?: string[]; children: ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-5 items-start">
      <aside className="lg:sticky lg:top-24 space-y-3">
        <div className="eyebrow">Step {String(n).padStart(2, "0")}</div>
        <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">{title}</h2>
        <p className="text-muted">{desc}</p>
        {tips && tips.length > 0 && (
          <ul className="hidden sm:block rounded-2xl bg-white/70 border border-line p-4 space-y-2 text-sm">
            {tips.map((t) => <li key={t} className="flex gap-2"><span className="mt-0.5 w-4 h-4 shrink-0 bg-sun border border-ink grid place-items-center text-[0.55rem] font-bold">✓</span><span>{t}</span></li>)}
          </ul>
        )}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Selectable big card (used for "I have a quote" / "I'm buying parts"). */
export function ChoiceCard({ on, onClick, icon, title, desc }: { on: boolean; onClick: () => void; icon: string; title: string; desc: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`group relative text-start p-4 sm:p-5 border-[1.5px] transition-all duration-200 ${on ? "bg-sun/25 border-ink shadow-[5px_5px_0_0_var(--ink)] -translate-x-0.5 -translate-y-0.5" : "bg-white border-line hover:border-ink hover:-translate-y-0.5"}`}>
      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 shrink-0 grid place-items-center text-xl border-[1.5px] border-ink transition-transform group-hover:-rotate-6 ${on ? "bg-sun" : "bg-bg"}`}>{icon}</span>
        <span><span className="block font-extrabold text-lg font-display">{title}</span><span className="block text-sm text-muted mt-0.5">{desc}</span></span>
      </div>
      <span aria-hidden className={`absolute top-3 right-3 w-5 h-5 border-[1.5px] border-ink grid place-items-center text-xs font-bold ${on ? "bg-ink text-sun" : "bg-white"}`}>{on ? "✓" : ""}</span>
    </button>
  );
}

const HINTS = ["Reading every line of your document…", "Matching brands and models…", "Checking quantities against prices…", "Simulating a full year, hour by hour…", "Running the audit rules…", "Writing questions for your installer…"];

/** Full-card progress screen while the AI reads or the engine simulates. */
export function Processing({ label }: { label: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % HINTS.length), 2200); return () => clearInterval(id); }, []);
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 z-20 grid place-items-center bg-white/90 backdrop-blur-sm">
      <div className="text-center px-6">
        <div className="relative mx-auto w-28 h-36 bg-white border-[1.5px] border-ink shadow-[6px_6px_0_0_var(--ink)] overflow-hidden">
          {[70, 90, 55, 80, 62, 88].map((w, k) => <div key={k} className="h-1.5 bg-ink/20 mx-3 mt-3 rounded" style={{ width: `${w - 25}%` }} />)}
          <span className="absolute left-0 right-0 h-10 bg-gradient-to-b from-transparent via-sun/70 to-transparent" style={{ animation: "scan 1.8s ease-in-out infinite" }} />
        </div>
        <div className="mt-6 font-display font-extrabold text-xl">{label.replace(/…$/, "")}</div>
        <div className="mt-1 text-sm text-muted min-h-[1.25rem] transition-opacity">{HINTS[i]}</div>
        <div className="mt-4 mx-auto h-1.5 w-48 rounded-full bg-line overflow-hidden"><div className="h-full w-1/3 rounded-full bg-gradient-to-r from-sun to-[#ff6a3d]" style={{ animation: "shimmer-bar 1.4s ease-in-out infinite" }} /></div>
        <style>{`@keyframes shimmer-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
      </div>
    </div>
  );
}

/** Sticky action bar: stays visible on phones so Back/Next never scroll away. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 sm:static -mx-4 sm:mx-0 z-30 mt-5 px-4 sm:px-0 py-3 sm:py-0 bg-gradient-to-t from-[#fffaf0] via-[#fffaf0]/95 to-transparent sm:bg-none flex flex-wrap gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

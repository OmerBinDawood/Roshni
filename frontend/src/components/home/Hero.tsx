"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import ParticleField from "./ParticleField";
import { CountUp, useInView } from "./motion";

const ROWS = [
  { id: "R03", t: "String voltage too high on cold mornings", s: "bad", l: "CRITICAL" },
  { id: "R19", t: "Savings assume old net metering", s: "bad", l: "CRITICAL" },
  { id: "R12", t: "DC protection not listed", s: "warn", l: "ASK" },
  { id: "R27", t: "Quote bigger than your sizing", s: "warn", l: "ASK" },
  { id: "R01", t: "Brand and model on every main item", s: "ok", l: "FINE" },
] as const;
const DOT = { bad: "bg-bad", warn: "bg-warn", ok: "bg-leaf" } as const;

function Receipt() {
  return (
    <div className="relative w-full max-w-[400px] mx-auto lg:mx-0 lg:ml-auto rotate-[-1.5deg] hover:rotate-0 transition-transform duration-500">
      <div className="absolute -inset-3 bg-[radial-gradient(circle,rgba(255,176,32,0.35),transparent_70%)] blur-xl" aria-hidden />
      <div className="relative bg-white border-[1.5px] border-ink shadow-[8px_8px_0_0_var(--ink)] font-mono text-[0.72rem] sm:text-xs">
        <div className="flex items-center justify-between px-4 py-2.5 border-b-[1.5px] border-ink bg-sun">
          <span className="font-bold tracking-[0.14em]">ROSHNI AUDIT</span><span className="tracking-widest opacity-70">SAMPLE</span>
        </div>
        <ul className="divide-y divide-ink/10">
          {ROWS.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 opacity-0 animate-[rise_0.6s_ease_forwards]" style={{ animationDelay: `${0.6 + i * 0.28}s` }}>
              <span className={`w-2.5 h-2.5 shrink-0 ${DOT[r.s]}`} />
              <span className="font-bold w-8 shrink-0">{r.id}</span>
              <span className="flex-1 leading-snug font-sans text-[0.82rem] font-medium">{r.t}</span>
              <span className={`font-bold tracking-wider text-[0.62rem] ${r.s === "bad" ? "text-bad" : r.s === "warn" ? "text-warn" : "text-leaf"}`}>{r.l}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 border-t-[1.5px] border-ink">
          <div className="px-4 py-3 border-r-[1.5px] border-ink"><div className="text-[0.6rem] tracking-[0.16em] opacity-60">REAL SAVING / MO</div><div className="text-lg font-bold font-sans">Rs 19–24K</div></div>
          <div className="px-4 py-3"><div className="text-[0.6rem] tracking-[0.16em] opacity-60">PAYBACK</div><div className="text-lg font-bold font-sans">3.7 YRS</div></div>
        </div>
        <div className="px-4 py-2.5 border-t-[1.5px] border-ink flex items-center justify-between">
          <span className="font-bold tracking-wider text-bad text-[0.68rem]">▲ ASK BEFORE YOU PAY</span>
          <span aria-hidden className="h-4 w-24 bg-[repeating-linear-gradient(90deg,var(--ink)_0_2px,transparent_2px_5px,var(--ink)_5px_6px,transparent_6px_9px)]" />
        </div>
      </div>
    </div>
  );
}

export function Stat({ n, suf = "", pre = "", l, start }: { n: number; suf?: string; pre?: string; l: string; start: boolean }) {
  return (
    <div className="px-4 sm:px-6 py-4 border-l-[1.5px] border-ink first:border-l-0">
      <div className="font-display font-black text-2xl sm:text-4xl tabular-nums"><CountUp to={n} start={start} prefix={pre} suffix={suf} /></div>
      <div className="font-mono text-[0.62rem] sm:text-[0.7rem] tracking-[0.14em] text-muted mt-0.5">{l}</div>
    </div>
  );
}

export default function Hero() {
  const { t, lang } = useLang();
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const ur = lang === "ur";

  return (
    <section className="relative overflow-hidden bg-[#fffaf0] pt-28 sm:pt-32">
      {/* paper grid */}
      <div aria-hidden className="absolute inset-0 opacity-70 bg-[linear-gradient(rgba(15,27,45,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,27,45,0.055)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(180deg,#000_55%,transparent)]" />

      {/* the sun: a disc, hairline rings and rays, bleeding off the corner */}
      <div aria-hidden className="absolute right-[-18%] top-[-8%] w-[min(88vw,820px)] aspect-square lg:right-[-8%] lg:top-[0%]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.5),rgba(255,176,32,0.12)_48%,transparent_70%)] halo" />
        {[100, 82, 64, 46].map((p, i) => (
          <span key={p} className="absolute rounded-full border border-[#f58a07]/35" style={{ inset: `${(100 - p) / 2}%`, animation: `halo ${6 + i}s ease-in-out ${i * 0.5}s infinite` }} />
        ))}
        <div className="absolute inset-0 spin-slow opacity-60 [mask-image:radial-gradient(circle,transparent_30%,#000_32%,#000_62%,transparent_64%)] bg-[repeating-conic-gradient(from_0deg,rgba(245,138,7,0.55)_0deg_0.6deg,transparent_0.6deg_6deg)]" />
        <div className="absolute inset-[34%] rounded-full sun-pulse bg-[radial-gradient(circle_at_38%_32%,#fff7c2_0%,#ffd04f_32%,#ffb020_62%,#f58a07_100%)] shadow-[0_0_140px_50px_rgba(255,176,32,0.55)]" />
      </div>

      <ParticleField sun={{ x: 0.78, y: 0.3 }} />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[1.45fr_0.55fr] gap-10 lg:gap-6 items-center pb-12 lg:min-h-[min(calc(100svh-8rem),760px)]">
        <div>
          <div className="flex flex-wrap gap-2 font-mono text-[0.68rem] sm:text-[0.72rem] tracking-[0.12em] animate-[rise_0.7s_ease_both]">
            <span className="bg-sun border-[1.5px] border-ink px-2.5 py-1 font-bold">■ INDEPENDENT SECOND OPINION</span>
            <span className="border-[1.5px] border-ink/70 bg-white/70 px-2.5 py-1">PAKISTAN</span>
            <span className="border-[1.5px] border-ink/70 bg-white/70 px-2.5 py-1">NET BILLING <span className="text-[#f58a07] font-bold">2026</span></span>
          </div>

          {ur ? (
            <h1 className="mt-6 text-5xl sm:text-6xl font-bold leading-[1.5] animate-[rise_0.8s_0.1s_ease_both]">{t("tagline")}</h1>
          ) : (
            <h1 className="mt-5 font-display font-black uppercase leading-[0.92] tracking-[-0.035em] text-[clamp(1.95rem,5.2vw,4.4rem)]">
              <span className="block animate-[rise_0.8s_0.05s_ease_both]">Check the quote.</span>
              <span className="block text-ink/40 animate-[rise_0.8s_0.18s_ease_both]">Know the savings.</span>
              <span className="block text-gradient-sun animate-[rise_0.8s_0.31s_ease_both]">Then pay.</span>
            </h1>
          )}

          <p className="mt-6 text-base sm:text-xl text-ink/75 max-w-xl leading-relaxed animate-[rise_0.8s_0.4s_ease_both]">
            {ur ? t("sub") : "Upload your installer's quote and your electricity bill. Roshni runs 27 open engineering and money rules, simulates a full year hour by hour, and tells you what is right, what is risky, and what to ask before you pay."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3 animate-[rise_0.8s_0.5s_ease_both]">
            <Link href="/audit" className="blk blk-primary"><span>{ur ? t("checkQuote") : "Check my quote"}</span><span className="blk-ico">↗</span></Link>
            <Link href="/size" className="blk blk-ghost"><span>Size my solar</span><span className="blk-ico">↗</span></Link>
          </div>
          <p className="mt-4 font-mono text-[0.68rem] tracking-[0.1em] text-muted animate-[rise_0.8s_0.6s_ease_both]">PHOTO · PDF · PASTED CHAT · ENGLISH, URDU, ROMAN URDU · NO ACCOUNT</p>
        </div>

        <div className="animate-[rise_0.9s_0.35s_ease_both]"><Receipt /></div>
      </div>

      {/* numbers strip */}
      <div ref={ref} className="relative border-y-[1.5px] border-ink bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4">
          <Stat n={27} l="OPEN AUDIT RULES" start={seen} />
          <Stat n={35} l="CITIES, HOURLY WEATHER" start={seen} />
          <Stat n={37} l="BRANDS, VERIFY LINKS" start={seen} />
          <Stat n={0} pre="Rs " l="COMMISSION, EVER" start={seen} />
        </div>
      </div>
    </section>
  );
}

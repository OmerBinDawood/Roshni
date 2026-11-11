"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

/** Rays of the sun: thin tapered beams that breathe. */
function Rays() {
  return (
    <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full spin-slow" aria-hidden>
      {Array.from({ length: 36 }).map((_, i) => (
        <path key={i} d="M0 -150 L5 -290 L-5 -290 Z" fill="url(#ray)" transform={`rotate(${i * 10})`}
          style={{ animation: `ray-breathe ${4 + (i % 5)}s ease-in-out ${(i % 7) * 0.3}s infinite` }} />
      ))}
      <defs>
        <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb020" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Panel3D() {
  // A tilted array of photovoltaic cells with a light sweep.
  return (
    <div className="relative" style={{ transformStyle: "preserve-3d" }}>
      <div className="relative rounded-2xl p-2 bg-gradient-to-br from-[#16325c] to-[#0b1d3a] shadow-[0_40px_80px_rgba(15,27,45,0.35),0_0_0_1px_rgba(255,255,255,0.15)_inset]"
        style={{ width: "min(72vw, 380px)", aspectRatio: "1.45", transform: "rotateX(52deg) rotateZ(-28deg)", transformStyle: "preserve-3d" }}>
        <div className="grid grid-cols-6 grid-rows-4 gap-[3px] w-full h-full">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="rounded-[3px] bg-gradient-to-br from-[#2d5ca8] via-[#1c3f7c] to-[#142c5a] relative overflow-hidden">
              <span className="absolute inset-0 opacity-40 bg-[linear-gradient(90deg,transparent_48%,rgba(255,255,255,0.35)_50%,transparent_52%)]" />
            </div>
          ))}
        </div>
        <span className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12" style={{ animation: "shimmer-move 5s ease-in-out infinite" }} />
        </span>
      </div>
      <style>{`@keyframes shimmer-move { 0% { left: -40%; } 60%, 100% { left: 120%; } }`}</style>
    </div>
  );
}

function Chip({ className, style, children }: { className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={`absolute card px-3.5 py-2.5 text-sm backdrop-blur ${className}`} style={style}>{children}</div>
  );
}

export default function Hero() {
  const { t, lang } = useLang();
  const wrap = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const on = (e: PointerEvent) => {
      const el = wrap.current; if (!el) return;
      const r = el.getBoundingClientRect();
      setM({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 });
    };
    window.addEventListener("pointermove", on);
    return () => window.removeEventListener("pointermove", on);
  }, []);

  return (
    <section className="relative overflow-hidden pt-32 pb-28 sm:pt-40 bg-[linear-gradient(180deg,#fff6df_0%,#fffaf0_55%,#fffaf0_100%)]">
      {/* sky glow */}
      <div className="absolute -top-40 right-[-10%] w-[900px] h-[900px] rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.35),rgba(255,176,32,0.08)_45%,transparent_70%)] halo" aria-hidden />
      <div className="absolute top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(47,107,255,0.12),transparent_65%)]" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-5 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
        {/* copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-line px-3.5 py-1.5 text-sm font-medium shadow-sm animate-[rise_0.7s_ease_both]">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-leaf opacity-60 animate-ping" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-leaf" /></span>
            Independent. No commission. Built for Pakistan&apos;s 2026 net-billing rules.
          </div>
          <h1 className="mt-5 text-[2.6rem] sm:text-6xl lg:text-[4.1rem] font-extrabold leading-[1.03] animate-[rise_0.8s_0.1s_ease_both]">
            {lang === "ur" ? t("tagline") : <>Before you pay for solar, <span className="text-gradient-sun">let Roshni check it.</span></>}
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-muted max-w-xl animate-[rise_0.8s_0.2s_ease_both]">
            {lang === "ur" ? t("sub") : "Upload your installer's quote and your electricity bill. In minutes you get a plain-language report: what is right, what is risky, what it will really save, and exactly what to ask before you pay."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-[rise_0.8s_0.3s_ease_both]">
            <Link href="/audit" className="btn btn-primary !px-7 !py-3.5 text-base">{t("checkQuote")} <span className="arrow">→</span></Link>
            <Link href="/size" className="btn btn-ghost !px-6 !py-3.5 text-base">Size my solar</Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted animate-[rise_0.8s_0.4s_ease_both]">
            {["Photo, PDF or chat text", "English, Urdu and Roman Urdu", "27 open audit rules", "No account needed"].map((x) => (
              <li key={x} className="flex items-center gap-1.5"><span className="text-leaf font-bold">✓</span>{x}</li>
            ))}
          </ul>
        </div>

        {/* sun + 3D panel */}
        <div ref={wrap} className="relative h-[420px] sm:h-[540px]" style={{ perspective: "1200px" }} aria-hidden>
          {/* sun */}
          <div className="absolute -top-[2%] right-[0%] w-[300px] h-[300px] sm:w-[420px] sm:h-[420px]"
            style={{ transform: `translate3d(${m.x * -14}px, ${m.y * -10}px, 0)`, transition: "transform 0.2s ease-out" }}>
            <Rays />
            <div className="absolute inset-[-25%] rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.55),transparent_62%)] halo" />
            <div className="absolute inset-[22%] rounded-full sun-pulse bg-[radial-gradient(circle_at_35%_30%,#fffbd0_0%,#ffd45c_30%,#ffb020_60%,#f58a07_100%)] shadow-[0_0_120px_40px_rgba(255,176,32,0.55)]" />
          </div>
          {/* orbit */}
          <svg viewBox="0 0 400 400" className="absolute -top-[2%] right-[0%] w-[300px] h-[300px] sm:w-[420px] sm:h-[420px] spin-rev opacity-70">
            <circle cx="200" cy="200" r="190" fill="none" stroke="#2f6bff" strokeOpacity="0.25" strokeDasharray="2 8" strokeWidth="2" />
            <circle cx="200" cy="10" r="6" fill="#2f6bff" /><circle cx="390" cy="200" r="5" fill="#10b5a3" /><circle cx="60" cy="335" r="5" fill="#ffb020" />
          </svg>
          {/* panel */}
          <div className="absolute left-[42%] top-[64%] -translate-x-1/2 -translate-y-1/2 float-y-slow" style={{ transform: `translate3d(calc(-50% + ${m.x * 18}px), calc(-50% + ${m.y * 12}px), 60px)`, transition: "transform 0.2s ease-out" }}>
            <div style={{ transform: `rotateY(${m.x * 8}deg) rotateX(${m.y * -6}deg)`, transition: "transform 0.2s ease-out", transformStyle: "preserve-3d" }}><Panel3D /></div>
          </div>
          {/* floating product chips at different depths */}
          <Chip className="left-[-2%] top-[10%] float-y" style={{ transform: `translate3d(${m.x * 26}px, ${m.y * 18}px, 0)` }}>
            <div className="text-[0.7rem] uppercase tracking-wider text-muted font-bold">Rule R03</div>
            <div className="font-semibold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-bad" />String too high on cold mornings</div>
          </Chip>
          <Chip className="right-[0%] top-[58%] float-y" style={{ animationDelay: "-2s", transform: `translate3d(${m.x * 34}px, ${m.y * 22}px, 0)` }}>
            <div className="text-[0.7rem] uppercase tracking-wider text-muted font-bold">Example household</div>
            <div className="font-semibold">Saves about <span className="text-leaf">Rs 24,000</span> / month</div>
          </Chip>
          <Chip className="left-[6%] bottom-[2%] float-y" style={{ animationDelay: "-4s", transform: `translate3d(${m.x * 20}px, ${m.y * 28}px, 0)` }}>
            <div className="text-[0.7rem] uppercase tracking-wider text-muted font-bold">Backup</div>
            <div className="font-semibold">10.8 h on a 5 kWh battery</div>
          </Chip>
        </div>
      </div>

      {/* flowing waves into the next section */}
      <div className="absolute bottom-0 left-0 w-[200%] h-24 text-white" style={{ animation: "wave-drift 26s linear infinite" }} aria-hidden>
        <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="w-full h-full fill-current">
          <path d="M0 60 C 200 0 400 120 600 60 S 1000 0 1200 60 S 1600 120 1800 60 S 2200 0 2400 60 V120 H0 Z" opacity="0.5" />
          <path d="M0 80 C 250 30 450 130 700 80 S 1100 30 1300 80 S 1700 130 1900 80 S 2250 30 2400 80 V120 H0 Z" />
        </svg>
      </div>
    </section>
  );
}

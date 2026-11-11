"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Reveal, useInView } from "./motion";

/* ---------------------------------------------------------------- trust */
const PRINCIPLES = [
  { i: "🧮", t: "The AI never makes a number", d: "Gemini reads documents and explains. A deterministic engine, with open rules, calculates every figure you see.", c: "from-[#eaf2ff] to-white" },
  { i: "🔎", t: "Missing data is never a pass", d: "If a datasheet value is missing the finding says “cannot verify”, and tells you what to ask for.", c: "from-[#fff3d6] to-white" },
  { i: "⚖️", t: "Rules over scores", d: "No brand rankings and no secret scores. Every finding is specific, testable and linked to a public rule.", c: "from-[#e6fbf7] to-white" },
  { i: "🤝", t: "No commission, ever", d: "Roshni sells nothing and takes nothing from installers, brands or banks. Independence is the product.", c: "from-[#fff0ee] to-white" },
  { i: "🔒", t: "Your documents stay yours", d: "Consent before any upload, images are not stored, and the bill reference number is never saved or logged.", c: "from-[#f1efff] to-white" },
];

export function Trust() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-5">
        <Reveal className="max-w-3xl">
          <div className="eyebrow">08 / Why you can trust it</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">Built to tell you the truth, even when that means <span className="text-gradient-sun">don&apos;t buy this</span></h2>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-6 gap-5">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.t} delay={i * 90} className={i < 2 ? "md:col-span-3" : "md:col-span-2"}>
              <div className={`group h-full rounded-3xl border border-line bg-gradient-to-br ${p.c} p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-sun/70`}>
                <div className="w-12 h-12 rounded-2xl bg-white border border-line shadow-sm grid place-items-center text-2xl transition-transform duration-300 group-hover:rotate-[-10deg] group-hover:scale-110">{p.i}</div>
                <h3 className="mt-4 font-display text-xl font-extrabold">{p.t}</h3>
                <p className="mt-1.5 text-muted">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8"><Link href="/about" className="btn btn-ghost">Read the independence policy <span className="arrow">→</span></Link></Reveal>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- team */
const TEAM = [
  { n: "Omer Bin Dawood", g: "from-[#ffb020] to-[#ff6a3d]" },
  { n: "Hira Baig", g: "from-[#2f6bff] to-[#10b5a3]" },
  { n: "Alwaz Islam", g: "from-[#10b5a3] to-[#ffb020]" },
];

function TeamCard({ n, g }: { n: string; g: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  const initials = n.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div ref={ref} style={{ perspective: "900px" }}
      onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); setT({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 }); }}
      onPointerLeave={() => setT({ x: 0, y: 0 })}>
      <div className="card p-7 text-center transition-transform duration-200 will-change-transform hover:shadow-2xl" style={{ transform: `rotateY(${t.x * 7}deg) rotateX(${t.y * -7}deg)` }}>
        <div className={`mx-auto w-28 h-28 rounded-full bg-gradient-to-br ${g} grid place-items-center text-4xl font-display font-extrabold text-white shadow-[0_14px_40px_rgba(15,27,45,0.2)] ring-4 ring-white`}>{initials}</div>
        <div className="mt-5 font-display text-xl font-extrabold">{n}</div>
        <div className="text-sm text-muted">Engineer</div>
        <div className="mt-3 inline-block rounded-full bg-bg border border-line px-3 py-1 text-xs font-semibold">COMSATS University Islamabad</div>
      </div>
    </div>
  );
}

export function Team() {
  return (
    <section className="relative py-24 bg-[linear-gradient(180deg,#fff,#fff3d6)] overflow-hidden">
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.3),transparent_65%)]" aria-hidden />
      <div className="relative max-w-5xl mx-auto px-5 text-center">
        <Reveal>
          <div className="eyebrow">09 / The team</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-tight">Three engineers from COMSATS University Islamabad</h2>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">We built Roshni because we saw families make a very large purchase on a quote they could not judge. Our goal is simple: an honest second opinion for every Pakistani household.</p>
        </Reveal>
        <div className="mt-12 grid sm:grid-cols-3 gap-6 text-start">
          {TEAM.map((m, i) => <Reveal key={m.n} delay={i * 120}><TeamCard {...m} /></Reveal>)}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- faq */
const FAQ = [
  ["Is Roshni free? Who pays for it?", "Free to use. Roshni takes no commission, referral or fee from installers, brands or banks. The independence policy is public on the About page."],
  ["Why is my saving lower than the installer said?", "Since 9 February 2026 new connections get net billing: exported units earn about Rs 10 to 11, not the full tariff. Fixed charges also stay. Rule R19 flags savings claims that assume the old 1:1 rules."],
  ["Does it work with a phone photo or a WhatsApp message?", "Yes. Upload a photo, a PDF or paste the text, in English, Urdu or Roman Urdu. You confirm every line before any calculation, and Roshni never guesses a model number."],
  ["Can Roshni recommend a brand or an installer?", "No. It shows facts, official verification links and dated public prices for 37 brands, and asks you to verify and compare written quotes. It does not rank brands or list installers."],
  ["How accurate is the solar estimate?", "It uses PVGIS typical-year weather for 35 cities, validated pvlib models and about 15% system losses, simulated hour by hour. It is decision support, not a design certificate; real inverter logs will refine it."],
  ["What happens to my documents?", "You consent before upload. The document is read by Google Gemini, images are not stored, and the bill reference number is never saved or logged. You can delete any report or sizing you created."],
];

export function Faq() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-3xl mx-auto px-5">
        <Reveal className="text-center">
          <div className="eyebrow">10 / Questions</div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold">Things people ask first</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a], i) => (
            <Reveal key={q} delay={i * 60}>
              <details className="group card px-5 py-4 open:shadow-lg open:border-sun/60 transition-all">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-lg">
                  {q}<span className="w-8 h-8 shrink-0 rounded-full bg-bg border border-line grid place-items-center transition-transform duration-300 group-open:rotate-45 group-open:bg-sun">+</span>
                </summary>
                <p className="mt-3 text-muted">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- final CTA: the sun rises */
export function FinalCta() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  return (
    <section ref={ref} className="relative overflow-hidden py-28 bg-[linear-gradient(180deg,#fff3d6,#ffd98a_70%,#ffb020)]">
      <div className="absolute left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] rounded-full transition-all duration-[1800ms] ease-out"
        style={{ bottom: seen ? "-780px" : "-1100px", background: "radial-gradient(circle at 50% 38%, #fffbd0 0%, #ffd45c 28%, #ffb020 52%, rgba(245,138,7,0.0) 70%)", boxShadow: "0 0 160px 60px rgba(255,176,32,0.5)" }} aria-hidden />
      <div className="relative max-w-3xl mx-auto px-5 text-center">
        <h2 className="text-4xl sm:text-6xl font-extrabold leading-[1.05]">Before you pay, <span className="text-ink">let Roshni check it.</span></h2>
        <p className="mt-5 text-lg text-ink/75">It takes about five minutes, costs nothing, and needs no account.</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link href="/audit" className="blk blk-primary !bg-ink !text-white"><span>Check my quote</span><span className="blk-ico">↗</span></Link>
          <Link href="/size" className="blk blk-ghost"><span>Size my solar</span><span className="blk-ico">↗</span></Link>
        </div>
      </div>
    </section>
  );
}

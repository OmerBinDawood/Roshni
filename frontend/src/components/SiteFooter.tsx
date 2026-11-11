import Link from "next/link";
import { SunMark } from "./Header";

const COLS = [
  { h: "Check", l: [["/audit", "Check a quote"], ["/audit?mode=parts", "Parts check"], ["/compare", "Compare quotes"], ["/health", "System health check"]] },
  { h: "Plan", l: [["/size", "Size my solar"], ["/battery", "Battery advisor"], ["/readiness", "Is solar right for me?"], ["/financing", "Loan vs savings"]] },
  { h: "Learn", l: [["/bill", "Bill decoder"], ["/learn", "Lessons and glossary"], ["/brands", "Brand guide"], ["/guides", "Guides"]] },
  { h: "Trust", l: [["/about", "Independence policy"], ["/about#rules", "The audit rules"], ["/about#privacy", "Privacy"], ["/account", "My reports"]] },
];

export default function SiteFooter() {
  return (
    <footer className="no-print relative mt-10 border-t border-line bg-white/60">
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 font-display font-extrabold text-xl"><SunMark />Roshni</div>
          <p className="text-sm text-muted max-w-xs">The independent second opinion on solar and battery quotes for Pakistani homes. No commission. No rankings. Rules in public.</p>
          <p className="text-xs text-muted">Built by Omer Bin Dawood, Hira Baig and Alwaz Islam at COMSATS University Islamabad.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.h}>
            <div className="text-xs font-bold uppercase tracking-widest text-muted mb-3">{c.h}</div>
            <ul className="space-y-2 text-sm">
              {c.l.map(([href, label]) => (
                <li key={href}><Link href={href} className="text-ink/80 hover:text-ink hover:underline decoration-sun decoration-2 underline-offset-4">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="max-w-6xl mx-auto px-5 py-4 text-xs text-muted pb-24 sm:pb-4">
          Roshni provides decision support, not a design certificate. Figures are indicative and dated; verify against official NEPRA and DISCO notices and re-verify prices with the seller.
        </p>
      </div>
    </footer>
  );
}

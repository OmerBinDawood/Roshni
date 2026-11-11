"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/supabase";

export function SunMark({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden className="relative inline-block" style={{ width: size, height: size }}>
      <span className="absolute inset-[-35%] rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.55),transparent_65%)] halo" />
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff3b0,#ffb020_55%,#f58a07)] shadow-[0_0_18px_rgba(255,176,32,0.8)]" />
    </span>
  );
}

const LINKS = [
  { href: "/size", label: "Size my solar" },
  { href: "/audit", label: "Check a quote" },
  { href: "/bill", label: "Bill decoder" },
  { href: "/learn", label: "Learn" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const { lang, setLang } = useLang();
  const { session } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="no-print fixed top-3 inset-x-0 z-50 px-3">
      <div className={`mx-auto max-w-6xl rounded-full border transition-all duration-300 ${scrolled || open ? "bg-white/85 backdrop-blur-xl border-line shadow-[0_8px_30px_rgba(15,27,45,0.08)]" : "bg-white/40 backdrop-blur-md border-white/60"}`}>
        <div className="h-14 pl-4 pr-2 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 font-display font-extrabold text-xl tracking-tight" onClick={() => setOpen(false)}>
            <SunMark />
            Roshni{lang === "ur" && <span className="urdu font-normal text-muted text-base"> روشنی</span>}
          </Link>
          <nav className="hidden xl:flex items-center gap-1 text-[0.92rem] font-medium whitespace-nowrap" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="group relative px-3 py-2 rounded-full text-muted hover:text-ink transition">
                {l.label}
                <span className="absolute left-3 right-3 bottom-1 h-0.5 rounded bg-sun scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link className="hidden sm:inline px-3 py-2 text-sm font-medium text-muted hover:text-ink" href="/account">{session ? "My reports" : "Sign in"}</Link>
            <button onClick={() => setLang(lang === "en" ? "ur" : "en")} aria-label="Switch language"
              className="px-3 py-1.5 rounded-full border border-line text-sm font-medium bg-white/70 hover:bg-white transition">{lang === "en" ? "Urdu" : "English"}</button>
            <Link href="/audit" className="btn btn-primary !py-2 !px-4 hidden sm:inline-flex text-sm">Check my quote <span className="arrow">→</span></Link>
            <button className="xl:hidden w-10 h-10 rounded-full border border-line bg-white/70 grid place-items-center" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
              <span className="relative block w-4 h-3">
                <span className={`absolute left-0 right-0 h-0.5 bg-ink rounded transition-all ${open ? "top-1/2 rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 right-0 top-1/2 h-0.5 bg-ink rounded transition-opacity ${open ? "opacity-0" : ""}`} />
                <span className={`absolute left-0 right-0 h-0.5 bg-ink rounded transition-all ${open ? "top-1/2 -rotate-45" : "bottom-0"}`} />
              </span>
            </button>
          </div>
        </div>
        {open && (
          <nav className="xl:hidden px-3 pb-3 pt-1 grid gap-1" aria-label="Mobile">
            {[...LINKS, { href: "/account", label: session ? "My reports" : "Sign in" }, { href: "/audit", label: "Check my quote" }].map((l) => (
              <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl hover:bg-bg font-medium">{l.label}</Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

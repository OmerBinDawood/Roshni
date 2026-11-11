"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { useSession } from "@/lib/supabase";

export default function Header() {
  const { lang, setLang } = useLang();
  const { session } = useSession();
  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span aria-hidden className="inline-block w-6 h-6 rounded-full bg-sun shadow-[0_0_14px_var(--sun)]" />
          Roshni <span className="urdu font-normal text-muted text-base">روشنی</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link className="hidden sm:inline px-2 py-1 rounded hover:bg-bg" href="/audit">Audit</Link>
          <Link className="hidden sm:inline px-2 py-1 rounded hover:bg-bg" href="/bill">Bill</Link>
          <Link className="hidden sm:inline px-2 py-1 rounded hover:bg-bg" href="/battery">Battery</Link>
          <Link className="hidden sm:inline px-2 py-1 rounded hover:bg-bg" href="/brands">Brands</Link>
          <Link className="hidden sm:inline px-2 py-1 rounded hover:bg-bg" href="/learn">Learn</Link>
          <Link className="px-2 py-1 rounded hover:bg-bg whitespace-nowrap" href="/account">{session ? "My reports" : "Sign in"}</Link>
          <button
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
            className="ms-2 px-3 py-1 rounded-full border border-line hover:bg-bg"
            aria-label="Switch language"
          >
            {lang === "en" ? <span className="urdu">اردو</span> : "English"}
          </button>
        </nav>
      </div>
    </header>
  );
}

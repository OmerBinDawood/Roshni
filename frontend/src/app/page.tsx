"use client";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export default function Home() {
  const { t } = useLang();
  const cards = [
    { href: "/audit", icon: "🧾", title: t("checkQuote"), desc: t("checkQuoteD"), primary: true },
    { href: "/bill", icon: "💡", title: t("decodeBill"), desc: t("decodeBillD") },
    { href: "/battery", icon: "🔋", title: t("battery"), desc: t("batteryD") },
    { href: "/learn", icon: "⚡", title: t("learn"), desc: t("learnD") },
  ];
  return (
    <div className="space-y-8">
      <section className="pt-4 sm:pt-10">
        <h1 className="text-3xl sm:text-5xl font-bold leading-tight max-w-2xl">{t("tagline")}</h1>
        <p className="mt-4 text-muted text-lg max-w-2xl">{t("sub")}</p>
      </section>
      <section className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}
            className={`block rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${c.primary ? "bg-sun/15 border-sun/50" : "bg-surface border-line"}`}>
            <div className="text-3xl" aria-hidden>{c.icon}</div>
            <div className="mt-2 text-xl font-semibold">{c.title}</div>
            <p className="mt-1 text-muted">{c.desc}</p>
          </Link>
        ))}
      </section>
      <section className="text-sm text-muted border-t border-line pt-4 space-y-1">
        <p>Rules modelled: legacy net metering (agreements before 9 Feb 2026) and net billing (new users), fixed charges and the 200-unit protected limit. Figures are indicative and dated; verify against official NEPRA/DISCO notices.</p>
        <p>{t("disclaimer")}</p>
      </section>
    </div>
  );
}

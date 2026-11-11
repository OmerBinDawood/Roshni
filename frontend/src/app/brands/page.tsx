"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, ErrorBox } from "@/components/ui";
import { api } from "@/lib/api";

type Brand = {
  id: string; name: string; aliases: string[]; categories: string[]; kind: string; origin: string; about: string;
  technology: string; pakistan: string; verify: { label: string; url: string | null } | null; sources: string[];
};
type Guide = { as_of: string; policy: string; category_labels: Record<string, string>; category_checks: Record<string, string[]>; brands: Brand[] };
const KIND: Record<string, string> = { international: "International manufacturer", "pakistan-market": "Pakistan-market brand" };

export default function Brands() {
  const [g, setG] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState("panel");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<Guide>("/brands").then((x) => {
      setG(x);
      const h = window.location.hash.slice(1);
      const b = x.brands.find((y) => y.id === h);
      if (b) { setCat(b.categories[0]); setOpen(b.id); setTimeout(() => document.getElementById(b.id)?.scrollIntoView(), 50); }
    }).catch((e) => setError(e.message));
  }, []);

  const list = useMemo(() => {
    if (!g) return [];
    const s = q.trim().toLowerCase();
    return g.brands
      .filter((b) => (s ? [b.name, ...b.aliases].some((a) => a.toLowerCase().includes(s)) : b.categories.includes(cat)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [g, cat, q]);

  if (error) return <ErrorBox error={error} />;
  if (!g) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Brand guide</h1>
      <p className="text-muted">Who makes each panel, inverter and battery sold in Pakistan, what it is, how to verify it, and what to check before you pay. Listed alphabetically.</p>
      <div className="rounded-xl bg-info/10 text-info px-3 py-2 text-sm">{g.policy}</div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product type">
        {Object.entries(g.category_labels).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={!q && cat === k} onClick={() => { setCat(k); setQ(""); }}
            className={`px-3 py-1.5 rounded-full border text-sm ${!q && cat === k ? "bg-sun/25 border-sun font-semibold" : "border-line"}`}>
            {label} ({g.brands.filter((b) => b.categories.includes(k)).length})
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="brand-search">Search a brand or model (e.g. Jinko, Nitrox, US5000)</label>
        <input id="brand-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a brand or model" />
      </div>

      {!q && (
        <Card>
          <h2 className="font-semibold">Before you buy {g.category_labels[cat].toLowerCase()}, whatever the brand</h2>
          <ul className="mt-2 space-y-1 text-sm">{g.category_checks[cat].map((c) => <li key={c}>☐ {c}</li>)}</ul>
        </Card>
      )}

      <div className="space-y-2">
        {list.length === 0 && <p className="text-muted">No brand found. Unknown brand? Ask the seller for the manufacturer, datasheet and written warranty, then check your quote with Roshni.</p>}
        {list.map((b) => (
          <div key={b.id} id={b.id} className="rounded-2xl border border-line bg-surface">
            <button className="w-full text-start p-4 flex items-start justify-between gap-3" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
              <div>
                <div className="font-semibold text-lg">{b.name}</div>
                <div className="text-sm text-muted">{KIND[b.kind] ?? b.kind} · {b.origin} · {b.categories.map((c) => g.category_labels[c]).join(", ")}</div>
              </div>
              <span className="text-muted" aria-hidden>{open === b.id ? "−" : "+"}</span>
            </button>
            {open === b.id && (
              <div className="px-4 pb-4 space-y-2 text-sm">
                <p>{b.about}</p>
                <p><b>Technology:</b> {b.technology}</p>
                <p><b>In Pakistan:</b> {b.pakistan}</p>
                {b.verify && (
                  <p className="rounded-xl bg-leaf/10 p-3"><b>Verify:</b>{" "}
                    {b.verify.url ? <a className="underline" href={b.verify.url} target="_blank" rel="noreferrer">{b.verify.label}</a> : b.verify.label}
                  </p>
                )}
                {!b.verify && <p className="rounded-xl bg-bg p-3"><b>Verify:</b> no public online check found. Ask the authorised distributor to confirm serial numbers and warranty in writing.</p>}
                <details>
                  <summary className="cursor-pointer text-muted">What to check for this brand&apos;s products</summary>
                  {b.categories.map((c) => (
                    <div key={c} className="mt-2">
                      <div className="font-medium">{g.category_labels[c]}</div>
                      <ul className="mt-1 space-y-1">{g.category_checks[c].map((x) => <li key={x}>☐ {x}</li>)}</ul>
                    </div>
                  ))}
                </details>
                {b.sources.length > 0 && (
                  <p className="text-xs text-muted">Sources: {b.sources.map((s, i) => <span key={s}>{i > 0 && " · "}<a className="underline break-all" href={s} target="_blank" rel="noreferrer">{new URL(s).hostname}</a></span>)}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Profiles as of {g.as_of}. Information about local brands is limited; where Roshni could not confirm a fact, the profile says so. Looking for an installer? Check that they appear on the official AEDB/PPIB certified installer list and ask for references; Roshni does not list or recommend installers.</p>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox } from "@/components/ui";
import { api, rs } from "@/lib/api";
import { supabase, useSession } from "@/lib/supabase";

type Row = {
  id: string; created_at: string | null; mode: string; title: string | null; verdict: "red" | "amber" | "green";
  counts: { critical: number; clarify: number }; capex: number | null; savings_monthly: { low: number; high: number } | null;
};
const VERDICT = { red: ["CRITICAL", "Critical issues"], amber: ["CLARIFY", "Ask installer"], green: ["OK", "Looks reasonable"] } as const;

export default function Account() {
  const { session, ready } = useSession();
  const sb = supabase();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sizings, setSizings] = useState<{ id: string; created_at: string | null; title: string | null; options: { name: string; dc_kw: number; battery_kwh: number; cost_low: number; cost_high: number }[] }[]>([]);

  const load = useCallback(async () => {
    try { setRows((await api.get<{ reports: Row[] }>("/me/reports")).reports); } catch (e) { setError((e as Error).message); }
    try { setSizings((await api.get<{ sizings: typeof sizings }>("/me/sizings")).sizings); } catch {}
  }, []);
  useEffect(() => { if (session) queueMicrotask(load); }, [session, load]);

  async function signIn() {
    if (!sb) return;
    setBusy(true); setError(null);
    try {
      const t = await api.post<{ access_token: string; refresh_token: string }>("/auth/email-signin", { email: email.trim() });
      const { error } = await sb.auth.setSession(t);
      if (error) setError(error.message);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function deleteAll() {
    if (!confirm("Delete ALL your saved reports and sizings permanently? Their share links will stop working. This cannot be undone.")) return;
    try { await api.del("/me/reports"); setRows([]); setSizings([]); } catch (e) { setError((e as Error).message); }
  }

  if (!ready) return <p className="text-muted">Loading…</p>;
  if (!sb) return <ErrorBox error="Sign-in is not configured (missing Supabase settings)." />;

  if (!session) {
    return (
      <div className="space-y-5 max-w-md">
        <h1 className="text-2xl font-bold">Sign in to save your reports</h1>
        <p className="text-muted">Just enter your email. You don&apos;t need an account to check a quote — signing in only keeps your history so you can compare quotes later.</p>
        <ErrorBox error={error} />
        <Card className="space-y-3">
          <div><label htmlFor="email">Your email</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && /^\S+@\S+\.\S+$/.test(email)) signIn(); }} placeholder="you@example.com" /></div>
          <Button onClick={signIn} disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}>{busy ? "Signing in…" : "Continue"}</Button>
          <p className="text-xs text-muted">No code needed. Use the same email each time to see your saved reports on any device.</p>
        </Card>
        <p className="text-xs text-muted">Sign-in is provided by Supabase. We only store your email and your reports. <Link className="underline" href="/about#privacy">Privacy</Link></p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My reports and sizings</h1>
          <p className="text-muted text-sm">Signed in as {session.user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/audit" className="rounded-xl px-4 py-2.5 font-medium bg-sun text-[#2a1d00]">+ Check a quote</Link>
          <Button variant="ghost" onClick={() => sb.auth.signOut()}>Sign out</Button>
        </div>
      </div>
      <ErrorBox error={error} />
      {rows === null && <p className="text-muted">Loading…</p>}
      {rows?.length === 0 && <Card><p>No saved reports yet. Reports you check while signed in appear here. You can also open an older report on this device and press “Save to my account”.</p></Card>}
      {rows && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/report/${r.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.title || (r.mode === "parts" ? "Parts check" : "Quote check")}</div>
                  <div className="text-sm text-muted">{r.created_at ? new Date(r.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    {r.capex ? ` · ${rs(r.capex)}` : ""}{r.savings_monthly ? ` · saves ${rs(r.savings_monthly.low)}–${rs(r.savings_monthly.high)}/mo` : ""}</div>
                </div>
                {r.verdict && <Badge severity={VERDICT[r.verdict][0]} />}
              </div>
              {r.counts && <div className="text-sm mt-1">{r.counts.critical} critical · {r.counts.clarify} to clarify</div>}
            </Link>
          ))}
        </div>
      )}
      {sizings.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">My saved sizings</h2>
          {sizings.map((z) => (
            <Link key={z.id} href={`/size?id=${z.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:shadow-md transition">
              <div className="font-semibold">{z.title || "Solar sizing"}</div>
              <div className="text-sm text-muted">{z.created_at ? new Date(z.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : ""}
                {z.options.length ? ` · ${z.options.map((o) => `${o.dc_kw} kW${o.battery_kwh ? ` + ${o.battery_kwh} kWh` : ""}: ${rs(o.cost_low)}–${rs(o.cost_high)}`).join(" | ")}` : ""}</div>
            </Link>
          ))}
        </div>
      )}
      {((rows && rows.length > 0) || sizings.length > 0) && (
        <p className="text-sm"><button className="text-bad underline" onClick={deleteAll}>Delete all my reports</button></p>
      )}
    </div>
  );
}

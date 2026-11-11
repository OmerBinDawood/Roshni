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
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    try { setRows((await api.get<{ reports: Row[] }>("/me/reports")).reports); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (session) queueMicrotask(load); }, [session, load]);

  async function sendCode() {
    if (!sb) return;
    setBusy(true); setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/account` },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }
  async function verify() {
    if (!sb) return;
    setBusy(true); setError(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError(error.message);
  }
  async function deleteAll() {
    if (!confirm("Delete ALL your saved reports permanently? Their share links will stop working. This cannot be undone.")) return;
    try { await api.del("/me/reports"); setRows([]); } catch (e) { setError((e as Error).message); }
  }

  if (!ready) return <p className="text-muted">Loading…</p>;
  if (!sb) return <ErrorBox error="Sign-in is not configured (missing Supabase settings)." />;

  if (!session) {
    return (
      <div className="space-y-5 max-w-md">
        <h1 className="text-2xl font-bold">Sign in to save your reports</h1>
        <p className="text-muted">No password needed. We email you a sign-in code. You don&apos;t need an account to check a quote — signing in only keeps your history so you can compare quotes later.</p>
        <ErrorBox error={error} />
        <Card className="space-y-3">
          {!sent ? (
            <>
              <div><label htmlFor="email">Email</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
              <Button onClick={sendCode} disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}>{busy ? "Sending…" : "Email me a sign-in code"}</Button>
            </>
          ) : (
            <>
              <p className="text-sm">We sent an email to <b>{email}</b>. Click the link in it, or type the code here.</p>
              <div><label htmlFor="code">Code from the email</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" /></div>
              <div className="flex gap-2">
                <Button onClick={verify} disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</Button>
                <Button variant="ghost" onClick={() => { setSent(false); setCode(""); }}>Use a different email</Button>
              </div>
            </>
          )}
        </Card>
        <p className="text-xs text-muted">Sign-in is provided by Supabase. We only store your email and your reports. <Link className="underline" href="/about#privacy">Privacy</Link></p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My reports</h1>
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
      {rows && rows.length > 0 && (
        <p className="text-sm"><button className="text-bad underline" onClick={deleteAll}>Delete all my reports</button></p>
      )}
    </div>
  );
}

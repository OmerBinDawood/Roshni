"use client";
import { useState } from "react";
import { Button, Card, ErrorBox } from "@/components/ui";

type DS = { id: string; kind: string; brand: string; model: string; specs: Record<string, unknown>; source: string | null; verified: boolean; verified_by: string | null; seen_count: number };
type Stats = { reports: number; responses: number; by_outcome: Record<string, number>; decisions_improved: number };

export default function Admin() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<DS[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [onlyUnverified, setOnlyUnverified] = useState(true);
  const [who, setWho] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const h = { "x-admin-token": token, "content-type": "application/json" };
  async function load() {
    setError(null);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/admin/datasheets?only_unverified=${onlyUnverified}`, { headers: h }),
        fetch(`/api/admin/stats`, { headers: h }),
      ]);
      if (!a.ok) throw new Error((await a.json()).detail);
      setRows(await a.json()); setStats(await b.json());
    } catch (e) { setError((e as Error).message); }
  }
  async function verify(d: DS) {
    if (!who.trim()) { setError("Enter your name as reviewer first."); return; }
    let specs = d.specs;
    try { if (edits[d.id]) specs = JSON.parse(edits[d.id]); } catch { setError("Specs must be valid JSON."); return; }
    const r = await fetch(`/api/admin/datasheets/${d.id}/verify`, { method: "POST", headers: h, body: JSON.stringify({ specs, verified_by: who }) });
    if (!r.ok) { setError((await r.json()).detail); return; }
    load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Admin · datasheet review queue</h1>
      <ErrorBox error={error} />
      <Card className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label>Admin token</label><input type="password" value={token} onChange={(e) => setToken(e.target.value)} /></div>
          <div><label>Reviewer name</label><input value={who} onChange={(e) => setWho(e.target.value)} /></div>
          <label className="!text-ink !text-sm flex items-center gap-2 self-end"><input type="checkbox" className="w-4 h-4" checked={onlyUnverified} onChange={(e) => setOnlyUnverified(e.target.checked)} />Only unverified</label>
        </div>
        <Button onClick={load} disabled={!token}>Load</Button>
      </Card>
      {stats && (
        <Card>
          <h2 className="font-semibold">North-star: decisions improved</h2>
          <p className="mt-1">{stats.decisions_improved} of {stats.responses} responses ({stats.reports} reports total)</p>
          <p className="text-sm text-muted">{Object.entries(stats.by_outcome).map(([k, n]) => `${k}: ${n}`).join(" · ") || "No responses yet"}</p>
        </Card>
      )}
      {rows && rows.length === 0 && <p className="text-muted">Nothing to review.</p>}
      {rows?.map((d) => (
        <Card key={d.id} className="space-y-2">
          <div className="flex justify-between gap-2 flex-wrap">
            <div className="font-semibold">{d.kind}: {d.brand} {d.model} <span className="text-muted text-sm">· seen {d.seen_count}×</span></div>
            <span className={d.verified ? "text-leaf text-sm" : "text-warn text-sm"}>{d.verified ? `verified by ${d.verified_by}` : "unverified"}</span>
          </div>
          {d.source && <a className="text-sm underline break-all" href={d.source} target="_blank" rel="noreferrer">{d.source}</a>}
          <textarea rows={4} className="font-mono text-xs" defaultValue={JSON.stringify(d.specs, null, 1)}
            onChange={(e) => setEdits({ ...edits, [d.id]: e.target.value })} />
          {!d.verified && <Button onClick={() => verify(d)}>Mark verified against datasheet</Button>}
        </Card>
      ))}
    </div>
  );
}

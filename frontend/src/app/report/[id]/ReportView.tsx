"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox } from "@/components/ui";
import { api, rs, type Finding } from "@/lib/api";
import { useLang } from "@/lib/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Report = any;

const VERDICT = {
  red: { cls: "bg-bad/10 border-bad/40 text-bad", en: "Do not pay yet — critical issues found", ur: "ابھی ادائیگی نہ کریں — اہم مسائل ملے ہیں" },
  amber: { cls: "bg-warn/10 border-warn/40 text-warn", en: "Ask the installer before paying", ur: "ادائیگی سے پہلے انسٹالر سے وضاحت لیں" },
  green: { cls: "bg-leaf/10 border-leaf/40 text-leaf", en: "Looks reasonable on what we could check", ur: "جو ہم چیک کر سکے وہ مناسب لگتا ہے" },
} as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const { lang, t } = useLang();
  const [rep, setRep] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trError, setTrError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => { api.get<{ report: Report }>(`/report/${id}`).then((r) => setRep(r.report)).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => {
    if (lang === "ur" && rep && !trError && !findingsTranslated(rep.findings)) {
      api.post<{ report: Report }>(`/report/${id}/urdu`, {}).then((r) => setRep(r.report)).catch((e) => setTrError(e.message));
    }
  }, [lang, rep, id, trError]);

  if (error) return <ErrorBox error={error} />;
  if (!rep) return <p className="text-muted">Loading report…</p>;

  const ur = lang === "ur";
  const translating = ur && !trError && !findingsTranslated(rep.findings);
  const f = rep.finance;
  const v = VERDICT[rep.verdict as keyof typeof VERDICT];
  const findings: Finding[] = rep.findings;
  const T = (x: Finding, k: "title" | "detail" | "question") => (ur && x[`${k}_ur`]) || x[k];
  const questions = findings.filter((x) => x.question && (x.severity === "CRITICAL" || x.severity === "CLARIFY"));
  const copy = (text: string, what: string) => { navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500); };
  const maxE = Math.max(...f.energy_monthly.map((m: any) => Math.max(m.pv, m.load)), 1);

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 ${v.cls}`}>
        <div className="text-sm opacity-80">Roshni second opinion · {rep.versions.generated}</div>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">{ur ? v.ur : v.en}</h1>
        <p className="mt-1 text-ink">{rep.counts.critical} critical · {rep.counts.clarify} to clarify · System {rep.system_summary.dc_kwp} kWp, {rep.system_summary.inverter_kw ?? "?"} kW {rep.system_summary.inverter_type.replace("_", "-")}{rep.system_summary.battery_usable_kwh ? `, ${rep.system_summary.battery_usable_kwh} kWh battery` : ""}</p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => copy(window.location.href, "link")}>{copied === "link" ? "Copied ✓" : "🔗 Share link"}</Button>
        <Button variant="ghost" onClick={() => window.print()}>🖨️ Save as PDF</Button>
        <Button variant="ghost" onClick={() => window.dispatchEvent(new Event("roshni:open-assistant"))}>💬 Ask about this report</Button>
        {translating && <span className="text-muted self-center">Translating to Urdu…</span>}
        {trError && <span className="text-bad self-center text-sm">Urdu translation failed: {trError}</span>}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <div className="text-sm text-muted">Estimated saving / month</div>
          <div className="text-2xl font-bold">{rs(f.savings_monthly.low)} – {rs(f.savings_monthly.high)}</div>
          <div className="text-sm text-muted">expected {rs(f.savings_monthly.expected)} · {f.regime_label}</div>
        </Card>
        <Card>
          <div className="text-sm text-muted">Simple payback</div>
          <div className="text-2xl font-bold">{rep.cashflow?.payback_years ? `${rep.cashflow.payback_years} years` : "–"}</div>
          <div className="text-sm text-muted">on {rs(rep.capex)} · 10-yr net {rs(rep.cashflow?.cum_10y)}</div>
        </Card>
        <Card>
          <div className="text-sm text-muted">In load-shedding</div>
          <div className="text-2xl font-bold">{rep.backup.works_in_outage ? (rep.backup.hours_on_battery ? `~${rep.backup.hours_on_battery} h` : "Solar only") : "Nothing runs"}</div>
          <div className="text-sm text-muted">backup load ~{rep.backup.running_kw} kW · {rep.backup.outage_hours_per_day} h/day outages</div>
        </Card>
      </div>

      {f.regime === "NET_BILLING_2026" && f.export_share > 0 && (
        <Card>
          <h2 className="font-semibold">Why your rules matter</h2>
          <p className="text-sm text-muted mt-1">Same system, same home — expected monthly saving under each rule set:</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-bg p-3"><div className="text-sm text-muted">Old 1:1 net metering</div><div className="text-xl font-bold line-through decoration-bad/60">{rs(f.net_metering_vs_net_billing_monthly.LEGACY_NET_METERING)}</div></div>
            <div className="rounded-xl bg-sun/15 p-3"><div className="text-sm text-muted">Net billing (applies to you)</div><div className="text-xl font-bold">{rs(f.net_metering_vs_net_billing_monthly.NET_BILLING_2026)}</div></div>
          </div>
          <p className="text-sm text-muted mt-2">If rules change again (buyback falls to Rs 7, protected category ends): ~{rs(f.stress_test_monthly)}/month. {Math.round(f.export_share * 100)}% of your solar would be exported.</p>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Findings</h2>
        {findings.filter((x) => x.severity !== "OK").map((x) => (
          <Card key={x.rule_id + x.title}>
            <div className="flex items-start justify-between gap-3">
              <h3 className={`font-semibold ${ur ? "urdu" : ""}`}>{T(x, "title")}</h3>
              <Badge severity={x.severity} />
            </div>
            {x.detail && <p className={`mt-1 ${ur ? "urdu" : ""}`}>{T(x, "detail")}</p>}
            {x.evidence && <p className="mt-1 text-sm text-muted font-mono" dir="ltr">{x.evidence}</p>}
            {x.question && <p className={`mt-2 text-sm ${ur ? "urdu" : ""}`}>❓ {T(x, "question")}</p>}
            <p className="mt-1 text-xs text-muted">Rule {x.rule_id}</p>
          </Card>
        ))}
        {findings.some((x) => x.severity === "OK") && (
          <Card>
            <h3 className="font-semibold text-leaf">Checks that passed</h3>
            <ul className="mt-1 text-sm space-y-1">
              {findings.filter((x) => x.severity === "OK").map((x) => <li key={x.rule_id}>✓ {T(x, "title")} <span className="text-muted" dir="ltr">{x.detail}</span></li>)}
            </ul>
          </Card>
        )}
      </section>

      {questions.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-lg">Questions for your installer</h2>
            <Button variant="ghost" className="no-print" onClick={() => copy(questions.map((q, i) => `${i + 1}. ${T(q, "question")}`).join("\n"), "q")}>{copied === "q" ? "Copied ✓" : "Copy"}</Button>
          </div>
          <ol className={`mt-2 list-decimal ps-5 space-y-1 ${ur ? "urdu" : ""}`}>{questions.map((q) => <li key={q.rule_id}>{T(q, "question")}</li>)}</ol>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Your year, month by month (units)</h2>
        <div className="mt-3 flex items-end gap-1 h-40" dir="ltr">
          {f.energy_monthly.map((m: any) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`Solar ${m.pv} · Use ${m.load} · Export ${m.export} · Import ${m.import}`}>
              <div className="w-full flex items-end gap-px h-32">
                <div className="flex-1 bg-sun rounded-t" style={{ height: `${(m.pv / maxE) * 100}%` }} />
                <div className="flex-1 bg-info/60 rounded-t" style={{ height: `${(m.load / maxE) * 100}%` }} />
              </div>
              <span className="text-[10px] text-muted">{MONTHS[m.month - 1]}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted flex gap-4"><span><span className="inline-block w-3 h-3 bg-sun rounded-sm align-middle" /> Solar</span><span><span className="inline-block w-3 h-3 bg-info/60 rounded-sm align-middle" /> Your use</span></div>
        <p className="mt-2 text-sm text-muted">Year: {f.annual.pv_kwh.toLocaleString()} units generated, {f.annual.self_consumed_kwh.toLocaleString()} used at home, {f.annual.export_kwh.toLocaleString()} exported, {f.annual.import_kwh.toLocaleString()} still bought from grid.</p>
        {rep.reconciliation?.length > 0 && <p className="mt-1 text-sm text-muted">Your answers were scaled to match the 12 months on your bill (measured beats estimated).</p>}
      </Card>

      <Card>
        <h2 className="font-semibold">Assumptions</h2>
        <ul className="mt-1 text-sm list-disc ps-5 space-y-1">{rep.assumptions.map((a: string) => <li key={a}>{a}</li>)}</ul>
        {rep.unverified_specs?.length > 0 && <p className="mt-2 text-sm text-warn">Specs for {rep.unverified_specs.join(", ")} came from a web search and are not verified against the datasheet.</p>}
        <p className="mt-2 text-xs text-muted">Site extremes: {rep.site.t_min_air}°C coldest air, {rep.site.t_cell_max}°C hottest panel. Engine {rep.versions.engine} · rules {rep.versions.regulatory}.</p>
        <p className="mt-2 text-xs text-muted">{t("disclaimer")}</p>
      </Card>
    </div>
  );
}

function findingsTranslated(findings: Finding[]) {
  return findings.every((f) => f.title_ur);
}

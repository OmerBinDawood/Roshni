"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox, Issues } from "@/components/ui";
import { api, rs, type Finding } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ownerToken, useSession } from "@/lib/supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Report = any;

const VERDICT_PARTS = {
  red: { en: "Don't connect these parts as listed — critical issues", ur: "یہ پرزے اس طرح نہ جوڑیں — اہم مسائل ملے ہیں" },
  amber: { en: "Check a few things before buying", ur: "خریدنے سے پہلے چند چیزیں چیک کریں" },
  green: { en: "These parts look compatible on what we could check", ur: "جو ہم چیک کر سکے، یہ پرزے آپس میں مطابقت رکھتے ہیں" },
} as const;
const VERDICT = {
  red: { cls: "bg-bad/10 border-bad/40 text-bad", en: "Do not pay yet — critical issues found", ur: "ابھی ادائیگی نہ کریں — اہم مسائل ملے ہیں" },
  amber: { cls: "bg-warn/10 border-warn/40 text-warn", en: "Ask the installer before paying", ur: "ادائیگی سے پہلے انسٹالر سے وضاحت لیں" },
  green: { cls: "bg-leaf/10 border-leaf/40 text-leaf", en: "Looks reasonable on what we could check", ur: "جو ہم چیک کر سکے وہ مناسب لگتا ہے" },
} as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Installer conversation kit (PRD 9.8): general checklist + red flags, alongside the personalised questions
const CHECKLIST = [
  ["Exact brand and model of panels, inverter and battery, with datasheets", "پینل، انورٹر اور بیٹری کا درست برانڈ اور ماڈل، ڈیٹا شیٹ کے ساتھ"],
  ["Written warranty for each item, and who honours it in Pakistan", "ہر چیز کی تحریری وارنٹی، اور پاکستان میں کون ذمہ دار ہے"],
  ["DC and AC breakers, surge protectors and cable sizes listed", "ڈی سی اور اے سی بریکر، سرج پروٹیکٹر اور تاروں کا سائز درج ہو"],
  ["Earthing: number of pits, separate DC earthing", "ارتھنگ: کتنے گڑھے، ڈی سی ارتھنگ الگ"],
  ["Structure gauge, coating and how it is anchored", "اسٹرکچر کی موٹائی، کوٹنگ اور اسے کیسے لگایا جائے گا"],
  ["Net-billing paperwork, meter and DISCO fees: included or not", "نیٹ بلنگ کے کاغذات، میٹر اور ڈسکو فیس: شامل ہیں یا نہیں"],
  ["Payment split by delivery and commissioning", "ادائیگی سامان آنے اور سسٹم چلنے پر قسطوں میں"],
];
const RED_FLAGS = [
  ["Pressure to sign or pay today", "آج ہی دستخط یا ادائیگی کا دباؤ"],
  ["A one-line quote with no model numbers", "ماڈل نمبر کے بغیر ایک لائن کی کوٹیشن"],
  ["\"Your bill will be zero\" for a new connection under net billing", "نیٹ بلنگ والے نئے کنکشن کے لیے \"بل زیرو ہو جائے گا\""],
  ["Warranty only promised verbally", "وارنٹی صرف زبانی"],
  ["Very large advance (more than half)", "آدھی سے زیادہ رقم پیشگی"],
  ["Refusal to show datasheets or let you verify panel serial numbers", "ڈیٹا شیٹ دکھانے یا سیریل نمبر چیک کرنے سے انکار"],
];
const OUTCOMES: [string, string][] = [
  ["renegotiated", "I renegotiated the price"], ["changed_config", "I changed the system/configuration"],
  ["added_protection", "Missing protection was added"], ["walked_away", "I didn't buy / chose another installer"],
  ["proceeded", "I went ahead as quoted"], ["undecided", "Still deciding"],
];

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang, t } = useLang();
  const [rep, setRep] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trError, setTrError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [outcome, setOutcome] = useState("");
  const [wouldPay, setWouldPay] = useState("");
  const [sent, setSent] = useState(false);
  const { session } = useSession();
  const [access, setAccess] = useState<{ can_manage: boolean; owned_by_you: boolean; in_an_account: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const tok = () => { const t = ownerToken.get(id); return t ? { "x-owner-token": t } : undefined; };

  useEffect(() => { api.get<{ report: Report }>(`/report/${id}`).then((r) => setRep(r.report)).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => {
    const t = ownerToken.get(id);
    api.get<typeof access>(`/report/${id}/access`, t ? { "x-owner-token": t } : undefined).then(setAccess).catch(() => setAccess(null));
  }, [id, session, saved]);
  useEffect(() => {
    if (lang === "ur" && rep && !trError && !findingsTranslated(rep.findings)) {
      api.post<{ report: Report }>(`/report/${id}/urdu`, {}).then((r) => setRep(r.report)).catch((e) => setTrError(e.message));
    }
  }, [lang, rep, id, trError]);

  if (error) return <ErrorBox error={error} />;
  if (!rep) return <p className="text-muted">Loading report…</p>;

  const ur = lang === "ur";
  const parts = rep.mode === "parts";
  const translating = ur && !trError && !findingsTranslated(rep.findings);
  const f = rep.finance;
  const v = VERDICT[rep.verdict as keyof typeof VERDICT];
  const findings: Finding[] = rep.findings;
  const T = (x: Finding, k: "title" | "detail" | "question") => (ur && x[`${k}_ur`]) || x[k];
  const questions = findings.filter((x) => x.question && (x.severity === "CRITICAL" || x.severity === "CLARIFY"));
  const copy = (text: string, what: string) => { navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500); };
  const maxE = f ? Math.max(...f.energy_monthly.map((m: any) => Math.max(m.pv, m.load)), 1) : 1;
  const L = (pair: string[]) => (ur ? pair[1] : pair[0]);

  async function sendOutcome() {
    try { await api.post(`/report/${id}/outcome`, { outcome, would_pay: wouldPay || null }, tok()); setSent(true); }
    catch (e) { setError((e as Error).message); }
  }
  async function del() {
    if (!confirm("Delete this report permanently? The share link will stop working. This cannot be undone.")) return;
    try { await api.del(`/report/${id}`, tok()); ownerToken.remove(id); router.push(session ? "/account" : "/"); } catch (e) { setError((e as Error).message); }
  }
  async function saveToAccount() {
    try { await api.post(`/report/${id}/claim`, {}, tok()); setSaved(true); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-5 ${v.cls}`}>
        <div className="text-sm opacity-80">{parts ? "Roshni parts-list safety check" : "Roshni second opinion"} · {rep.versions.generated}</div>
        <h1 className={`text-2xl sm:text-3xl font-bold mt-1 ${ur ? "urdu" : ""}`}>{(() => { const w = parts ? VERDICT_PARTS[rep.verdict as keyof typeof VERDICT_PARTS] : v; return ur ? w.ur : w.en; })()}</h1>
        <p className="mt-1 text-ink">{rep.counts.critical} critical · {rep.counts.clarify} to clarify · System {rep.system_summary.dc_kwp} kWp, {rep.system_summary.inverter_kw ?? "?"} kW {rep.system_summary.inverter_type.replace("_", "-")}{rep.system_summary.battery_usable_kwh ? `, ${rep.system_summary.battery_usable_kwh} kWh battery` : ""}</p>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => copy(window.location.href, "link")}>{copied === "link" ? "Copied ✓" : "🔗 Share link"}</Button>
        <Button variant="ghost" onClick={() => window.print()}>🖨️ Save as PDF</Button>
        <Button variant="ghost" onClick={() => window.dispatchEvent(new Event("roshni:open-assistant"))}>💬 Ask about this report</Button>
        {access?.can_manage && !access.owned_by_you && (session
          ? <Button variant="ghost" onClick={saveToAccount}>💾 Save to my account</Button>
          : <a href="/account" className="rounded-xl px-4 py-2.5 border border-line hover:bg-bg">💾 Sign in to save</a>)}
        {access?.owned_by_you && <span className="text-leaf self-center text-sm">✓ Saved to your account</span>}
        {translating && <span className="text-muted self-center">Translating to Urdu…</span>}
        {trError && <span className="text-bad self-center text-sm">Urdu translation failed: {trError}</span>}
      </div>

      {rep.validation?.some((i: any) => i.level !== "info") && (
        <Card>
          <h2 className="font-semibold">Notes on the quote itself</h2>
          <div className="mt-2"><Issues issues={rep.validation} /></div>
        </Card>
      )}

      {!parts && f && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Card>
            <div className="text-sm text-muted">Estimated saving / month</div>
            <div className="text-2xl font-bold">{rs(f.savings_monthly.low)} – {rs(f.savings_monthly.high)}</div>
            <div className="text-sm text-muted">expected {rs(f.savings_monthly.expected)} · {f.regime_label}</div>
          </Card>
          <Card>
            <div className="text-sm text-muted">Simple payback</div>
            <div className="text-2xl font-bold">{rep.cashflow?.payback_years ? `${rep.cashflow.payback_years} years` : "–"}</div>
            <div className="text-sm text-muted">on {rs(rep.capex)} · 10-yr net {rs(rep.cashflow?.cum_10y)} · 25-yr {rs(rep.cashflow?.cum_25y)}</div>
          </Card>
          <Card>
            <div className="text-sm text-muted">Bill today (modelled)</div>
            <div className="text-2xl font-bold">{rs(f.bill_before_monthly)}/mo</div>
            <div className="text-sm text-muted">fixed charge {rs(f.fixed_charge)} stays after solar</div>
          </Card>
        </div>
      )}

      {rep.reconciliation_prompts?.length > 0 && (
        <Card className="border-warn/50">
          <h2 className="font-semibold">Your answers and your bill don&apos;t quite match</h2>
          <ul className="mt-1 text-sm list-disc ps-5 space-y-1">{rep.reconciliation_prompts.map((p: string) => <li key={p}>{p}</li>)}</ul>
          <p className="text-sm text-muted mt-1">Bills are measured; your answers are an estimate. Both are shown — you can go back and adjust your answers.</p>
        </Card>
      )}

      {!parts && f && f.regime === "NET_BILLING_2026" && f.export_share > 0 && (
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
      {!parts && f && f.regime === "LEGACY_NET_METERING" && (
        <Card>
          <h2 className="font-semibold">Your legacy net-metering agreement</h2>
          <p className="text-sm mt-1">Your agreement keeps 1:1 netting until about {f.legacy_expiry_year}. After that Roshni assumes net billing; the payback above already includes that switch.</p>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">In load-shedding</h2>
        <p className="text-sm text-muted">{rep.backup.outage_hours_per_day} h/day outages · backup load ~{rep.backup.running_kw} kW{rep.backup.battery_usable_kwh ? ` · ${rep.backup.battery_usable_kwh} kWh usable battery` : ""}</p>
        <ul className="mt-2 divide-y divide-line">
          {rep.backup.items?.map((it: any) => (
            <li key={it.name} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span>{it.runs === true ? "✅" : it.runs === "day_only" ? "🌤️" : "❌"} {it.count > 1 ? `${it.count} × ` : ""}{it.name} <span className="text-muted">({it.kw} kW)</span></span>
              <span className="text-muted text-end">{it.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Findings</h2>
        {findings.filter((x) => x.severity !== "OK").map((x, i) => (
          <Card key={x.rule_id + i}>
            <div className="flex items-start justify-between gap-3">
              <h3 className={`font-semibold ${ur ? "urdu" : ""}`}>{T(x, "title")}</h3>
              <Badge severity={x.severity} />
            </div>
            {x.detail && <p className={`mt-1 ${ur ? "urdu" : ""}`}>{T(x, "detail")}</p>}
            {x.evidence && <p className="mt-1 text-sm text-muted font-mono" dir="ltr">{x.evidence}</p>}
            {x.question && <p className={`mt-2 text-sm ${ur ? "urdu" : ""}`}>❓ {T(x, "question")}</p>}
            <p className="mt-1 text-xs text-muted">Rule {x.rule_id} · <a className="underline" href="/about#rules">how rules work</a></p>
          </Card>
        ))}
        {findings.some((x) => x.severity === "OK") && (
          <Card>
            <h3 className="font-semibold text-leaf">Checks that passed</h3>
            <ul className="mt-1 text-sm space-y-1">
              {findings.filter((x) => x.severity === "OK").map((x, i) => <li key={x.rule_id + i}>✓ {T(x, "title")} <span className="text-muted" dir="ltr">{x.detail}</span></li>)}
            </ul>
          </Card>
        )}
      </section>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-lg">Installer conversation kit</h2>
          <Button variant="ghost" className="no-print" onClick={() => copy(
            [...questions.map((q, i) => `${i + 1}. ${T(q, "question")}`), "", ...CHECKLIST.map((c) => `☐ ${L(c)}`)].join("\n"), "q")}>
            {copied === "q" ? "Copied ✓" : "Copy all"}
          </Button>
        </div>
        {questions.length > 0 && (
          <>
            <h3 className="mt-3 font-medium">Your questions (from this check)</h3>
            <ol className={`mt-1 list-decimal ps-5 space-y-1 ${ur ? "urdu" : ""}`}>{questions.map((q, i) => <li key={q.rule_id + i}>{T(q, "question")}</li>)}</ol>
          </>
        )}
        <h3 className="mt-3 font-medium">Before signing, get in writing</h3>
        <ul className={`mt-1 space-y-1 text-sm ${ur ? "urdu" : ""}`}>{CHECKLIST.map((c) => <li key={c[0]}>☐ {L(c)}</li>)}</ul>
        <h3 className="mt-3 font-medium text-bad">Red flags</h3>
        <ul className={`mt-1 space-y-1 text-sm ${ur ? "urdu" : ""}`}>{RED_FLAGS.map((c) => <li key={c[0]}>🚩 {L(c)}</li>)}</ul>
      </Card>

      {!parts && f && (
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
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Assumptions and technical appendix</h2>
        <ul className="mt-1 text-sm list-disc ps-5 space-y-1">{rep.assumptions.map((a: string) => <li key={a}>{a}</li>)}</ul>
        {rep.unverified_specs?.length > 0 && <p className="mt-2 text-sm text-warn">Specs for {rep.unverified_specs.join(", ")} came from a web search and are not verified against the datasheet.</p>}
        <p className="mt-2 text-xs text-muted">Site extremes: {rep.site.t_min_air}°C coldest air, {rep.site.t_cell_max}°C hottest panel{rep.clipped_kwh ? ` · inverter clipping ~${rep.clipped_kwh} units/yr` : ""}. Engine {rep.versions.engine} · rules {rep.versions.regulatory} · appliances {rep.versions.appliances}.</p>
        <p className="mt-2 text-xs text-muted">{t("disclaimer")}</p>
      </Card>

      {access?.can_manage && <Card className="no-print">
        <h2 className="font-semibold">What did you decide? (helps us improve)</h2>
        {sent ? <p className="text-leaf mt-2">Thank you! ✓</p> : (
          <div className="mt-2 space-y-3">
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {OUTCOMES.map(([k, label]) => (
                <label key={k} className="!text-ink !text-sm flex items-center gap-2"><input type="radio" name="outcome" className="w-4 h-4" checked={outcome === k} onChange={() => setOutcome(k)} />{label}</label>
              ))}
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span>Would you pay Rs 1,000–3,000 for a check like this?</span>
              {["yes", "maybe", "no"].map((w) => (
                <label key={w} className="!text-ink !text-sm inline-flex items-center gap-1"><input type="radio" name="pay" className="w-4 h-4" checked={wouldPay === w} onChange={() => setWouldPay(w)} />{w}</label>
              ))}
            </div>
            <Button onClick={sendOutcome} disabled={!outcome}>Send</Button>
          </div>
        )}
      </Card>}

      {access?.can_manage && (
        <div className="no-print text-sm">
          <button onClick={del} className="text-bad underline">Delete this report</button>
          <span className="text-muted"> — removes it and its share link permanently.</span>
        </div>
      )}
    </div>
  );
}

function findingsTranslated(findings: Finding[]) {
  return findings.every((f) => f.title_ur);
}

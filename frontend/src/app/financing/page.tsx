"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, ErrorBox, Num } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import { api, rs } from "@/lib/api";

type Out = { principal: number; instalment: number; total_paid: number; total_markup: number; gap_expected?: number; gap_conservative?: number;
  verdict?: "covered" | "mostly_covered" | "not_covered"; message?: string };
const V = { covered: "bg-leaf/10 border-leaf/40 text-leaf", mostly_covered: "bg-warn/10 border-warn/40 text-warn", not_covered: "bg-bad/10 border-bad/40 text-bad" };

export default function Page() {
  return <Suspense fallback={<p className="text-muted">Loading…</p>}><Financing /></Suspense>;
}

function Financing() {
  const { lang } = useLang();
  const params = useSearchParams();
  const [amount, setAmount] = useState<number | null>(900000);
  const [down, setDown] = useState<number | null>(0);
  const [markup, setMarkup] = useState<number | null>(16);
  const [months, setMonths] = useState<number | null>(36);
  const [savLow, setSavLow] = useState<number | null>(null);
  const [savExp, setSavExp] = useState<number | null>(null);
  const [fromReport, setFromReport] = useState(false);
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = params.get("report");
    if (!id) return;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    api.get<{ report: any }>(`/report/${id}`).then(({ report }) => {
      if (report.capex) setAmount(Math.round(report.capex));
      if (report.finance) { setSavLow(report.finance.savings_monthly.low); setSavExp(report.finance.savings_monthly.expected); }
      setFromReport(true);
    }).catch((e) => setError(e.message));
  }, [params]);

  async function go() {
    setError(null);
    try {
      setOut(await api.post<Out>("/financing", { amount_rs: amount, down_payment_rs: down || 0, markup_pct: markup, months,
        savings_low: savLow, savings_expected: savExp }));
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Loan instalment vs your savings {lang === "ur" && <span className="urdu font-normal text-muted">· قسط بمقابلہ بچت</span>}</h1>
      <p className="text-muted">Will a solar loan&apos;s monthly instalment be more than what solar saves you? Enter the bank&apos;s offer.
        {fromReport && " Price and savings were filled in from your report."}</p>
      <ErrorBox error={error} />
      <Card className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Num label="System price (Rs)" step={10000} value={amount} onChange={setAmount} />
          <Num label="Down payment (Rs)" step={10000} value={down} onChange={setDown} />
          <Num label="Markup / profit rate (% per year)" step={0.5} value={markup} onChange={setMarkup} />
          <Num label="Tenure (months)" step={6} value={months} onChange={setMonths} />
          <Num label="Your saving per month, low (Rs)" step={500} value={savLow} onChange={setSavLow} />
          <Num label="Your saving per month, expected (Rs)" step={500} value={savExp} onChange={setSavExp} />
        </div>
        <p className="text-xs text-muted">Bank solar-financing rates vary widely (roughly 15–18.5% per year in 2026, with a limited subsidised tier); Islamic and conventional options exist. Use the exact rate and fees from the bank&apos;s written offer. Don&apos;t know your savings? <a className="underline" href="/audit">Check your quote</a> first.</p>
        <Button onClick={go} disabled={!amount || markup === null || !months}>Calculate</Button>
      </Card>
      {out && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card><div className="text-sm text-muted">Monthly instalment</div><div className="text-2xl font-bold">{rs(out.instalment)}</div></Card>
            <Card><div className="text-sm text-muted">Total you pay</div><div className="text-2xl font-bold">{rs(out.total_paid)}</div></Card>
            <Card><div className="text-sm text-muted">Total markup / profit</div><div className="text-2xl font-bold">{rs(out.total_markup)}</div></Card>
          </div>
          {out.verdict && (
            <div className={`rounded-2xl border p-5 ${V[out.verdict]}`}>
              <p className="text-lg font-semibold">{out.message}</p>
              <p className="text-ink text-sm mt-1">Expected saving minus instalment: {rs(out.gap_expected)} / month · conservative case: {rs(out.gap_conservative)} / month.</p>
            </div>
          )}
          <Card>
            <h2 className="font-semibold">Before you sign a loan</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {["Ask for the total cost including processing fee, insurance and any early-repayment charge, in writing.",
                "Check whether the bank pays the installer directly and only after installation is complete.",
                "Make sure the quote the bank finances is the same one you checked (same model numbers).",
                "Keep copies of CNIC, the latest electricity bill and the installer's quotation; banks usually ask for these.",
                "Roshni earns nothing from any bank or loan."].map((x) => <li key={x}>☐ {x}</li>)}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

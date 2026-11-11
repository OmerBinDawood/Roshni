"use client";
import { useId, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Button({ children, onClick, disabled, variant = "primary", type = "button", className = "" }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost"; type?: "button" | "submit"; className?: string;
}) {
  const v = variant === "primary" ? "btn-primary" : "btn-ghost";
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn ${v} ${className}`}>{children}</button>;
}

export function Num({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number | null | undefined; onChange: (v: number | null) => void; step?: number; min?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" step={step} min={min} value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div role="alert" className="rounded-xl border border-bad/40 bg-bad/10 text-bad px-3 py-2 text-sm">{error}</div>;
}

const SEV: Record<string, string> = {
  CRITICAL: "bg-bad/10 text-bad border-bad/30",
  CLARIFY: "bg-warn/10 text-warn border-warn/30",
  INFO: "bg-info/10 text-info border-info/30",
  OK: "bg-leaf/10 text-leaf border-leaf/30",
};
const SEV_LABEL: Record<string, string> = { CRITICAL: "Critical", CLARIFY: "Ask installer", INFO: "Advice", OK: "Looks fine" };

export function Badge({ severity }: { severity: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SEV[severity]}`}>{SEV_LABEL[severity] ?? severity}</span>;
}

export function Consent({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className={`!text-ink !text-sm flex items-start gap-3 border-[1.5px] p-3 cursor-pointer transition-colors ${checked ? "border-ink bg-leaf/10" : "border-line bg-bg hover:border-ink"}`}>
      <input type="checkbox" className="w-4 h-4 mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        I agree that this document is sent to an AI service (Google Gemini) to read it. Roshni asks the AI not to copy names,
        addresses or reference numbers. <a className="underline" href="/about#privacy" target="_blank">Privacy</a>
      </span>
    </label>
  );
}

export function Issues({ issues }: { issues: { level: string; msg: string }[] }) {
  if (!issues?.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {issues.map((i, k) => (
        <li key={k} className={`rounded-lg px-3 py-1.5 ${i.level === "error" ? "bg-bad/10 text-bad" : i.level === "warn" ? "bg-warn/10 text-warn" : "bg-info/10 text-info"}`}>
          {i.level === "info" ? "ℹ️" : "⚠️"} {i.msg}
        </li>
      ))}
    </ul>
  );
}

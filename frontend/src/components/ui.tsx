"use client";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-2xl p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function Button({ children, onClick, disabled, variant = "primary", type = "button", className = "" }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost"; type?: "button" | "submit"; className?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition disabled:opacity-50";
  const v = variant === "primary" ? "bg-sun text-[#2a1d00] hover:brightness-105" : "border border-line hover:bg-bg";
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>{children}</button>;
}

export function Num({ label, value, onChange, step = 1, min = 0 }: {
  label: string; value: number | null | undefined; onChange: (v: number | null) => void; step?: number; min?: number;
}) {
  return (
    <div>
      <label>{label}</label>
      <input type="number" inputMode="decimal" step={step} min={min} value={value ?? ""}
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

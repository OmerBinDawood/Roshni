export type ItemType =
  | "panel" | "inverter" | "battery" | "structure" | "dc_cable" | "ac_cable" | "dc_breaker" | "dc_spd"
  | "ac_breaker" | "ac_spd" | "earthing" | "changeover" | "net_metering_fee" | "installation" | "other";

export const ITEM_TYPES: ItemType[] = [
  "panel", "inverter", "battery", "structure", "dc_cable", "ac_cable", "dc_breaker", "dc_spd",
  "ac_breaker", "ac_spd", "earthing", "changeover", "net_metering_fee", "installation", "other",
];

export interface LineItem {
  item_type: ItemType; description: string; brand?: string | null; model?: string | null;
  quantity?: number | null; unit_price?: number | null; line_total?: number | null;
  warranty_text?: string | null; low_confidence?: boolean;
}
export interface Quote {
  installer_name?: string | null; line_items: LineItem[]; grand_total?: number | null;
  payment_terms?: string | null; claimed_monthly_savings_rs?: number | null;
  claimed_payback_years?: number | null; savings_assumes_net_metering?: boolean | null; notes?: string | null;
}
export interface Bill {
  provider?: string | null; tariff_category?: string | null; sanctioned_load_kw?: number | null;
  phase?: "single" | "three" | null; current_units?: number | null; monthly_units_history: number[];
  total_amount_rs?: number | null; energy_charges_rs?: number | null; fixed_charges_rs?: number | null;
  fpa_rs?: number | null; taxes_rs?: number | null; protected?: boolean | null; net_metered?: boolean | null;
  export_units?: number | null; bill_month?: number | null;
}
export type Spec = Record<string, string | number | boolean | null | undefined>;
export interface SystemConfig {
  panel_count: number; panel: Spec; panels_per_string?: number | null; strings_per_mppt?: number | null;
  inverter: Spec; battery_count: number; battery: Spec; tilt: number; azimuth: number;
}
export interface AC { count: number; tons: number; inverter: boolean; day_hours: number; night_hours: number }
export interface Profile {
  city: string; acs: AC[]; motor_hp: number; fridges: number; fans: number; lights: number;
  backup_fans: number; backup_lights: number; backup_fridge: boolean; backup_ac: number; backup_motor: boolean;
  outage_hours_per_day: number; goal: "bill" | "backup" | "both"; wants_backup: boolean;
  net_metering_agreement_date?: string | null; phase?: "single" | "three" | null; scale_to_bill: boolean;
}
export interface Finding {
  rule_id: string; severity: "CRITICAL" | "CLARIFY" | "INFO" | "OK"; title: string; detail: string;
  evidence: string; question: string; title_ur?: string; detail_ur?: string; question_ur?: string;
}

export interface Issue { line: number | null; level: "error" | "warn" | "info"; msg: string }

export const defaultProfile: Profile = {
  city: "Lahore", acs: [{ count: 1, tons: 1.5, inverter: true, day_hours: 6, night_hours: 6 }],
  motor_hp: 1, fridges: 1, fans: 6, lights: 10, backup_fans: 3, backup_lights: 5, backup_fridge: true,
  backup_ac: 0, backup_motor: false, outage_hours_per_day: 4, goal: "both", wants_backup: true,
  net_metering_agreement_date: null, phase: null, scale_to_bill: true,
};

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); msg = j.detail ? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)) : msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  get: <T,>(path: string) => fetch(`/api${path}`).then(handle<T>),
  post: <T,>(path: string, body: unknown) =>
    fetch(`/api${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(handle<T>),
  upload: <T,>(path: string, form: FormData) => fetch(`/api${path}`, { method: "POST", body: form }).then(handle<T>),
};

export const rs = (n?: number | null) => (n == null ? "–" : `Rs ${Math.round(n).toLocaleString("en-PK")}`);

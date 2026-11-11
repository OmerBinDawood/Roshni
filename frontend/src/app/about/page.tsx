import { Card } from "@/components/ui";

export const metadata = { title: "Independence, evidence and privacy — Roshni" };

const RULES: [string, string, string][] = [
  ["R01", "Every major item has an exact brand and model number", "Ask installer"],
  ["R02", "Total panel power within the inverter's maximum PV input", "Critical"],
  ["R03", "String voltage on the coldest morning below the inverter's maximum", "Critical"],
  ["R04", "String voltage on the hottest day within the MPPT range", "Ask installer"],
  ["R05", "String current within the MPPT input limit", "Critical"],
  ["R06", "Battery voltage class matches the inverter (LV 48 V vs HV)", "Critical"],
  ["R07", "Battery–inverter communication (BMS protocol) documented", "Ask installer"],
  ["R08", "Battery power covers the backup load", "Critical"],
  ["R09", "Battery energy covers the backup hours", "Ask installer"],
  ["R10", "Inverter rating and surge cover running loads and motor starts", "Critical / Ask"],
  ["R11", "Inverter phase matches the connection", "Critical"],
  ["R12–R16", "DC/AC protection, earthing, cables and structure specified", "Ask installer"],
  ["R17", "Written warranties and who honours them in Pakistan", "Ask installer"],
  ["R18", "Panel grade and authorised distributor stated", "Ask installer"],
  ["R19", "Savings claim matches the rules that apply to you", "Critical / Ask"],
  ["R20", "System not oversized just to export under net billing", "Advice"],
  ["R21", "Prices compared with dated public ranges", "Advice / Ask"],
  ["R22", "Net-billing approval, meter and DISCO fees clear", "Ask installer"],
  ["R23", "Payment terms (advance, milestones)", "Advice"],
  ["R24", "Installer certification (AEDB) where net billing applies", "Advice"],
  ["R25", "On-grid quote when you asked for backup", "Critical"],
];

export default function About() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Independence, evidence and privacy</h1>

      <Card>
        <h2 className="font-semibold text-lg" id="independence">Our independence policy</h2>
        <ul className="mt-2 list-disc ps-5 space-y-1">
          <li>Roshni does not sell, install or earn commission on equipment or installations.</li>
          <li>If referral or business revenue is ever introduced, it will be disclosed on every affected page and will never change audit rules or findings.</li>
          <li>Audit rules are public (below). Every finding shows which rule triggered it.</li>
          <li>Roshni never tells you where to buy. It tells you what to check and what to ask.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="evidence">Evidence standards</h2>
        <ul className="mt-2 list-disc ps-5 space-y-1">
          <li>All numbers in a report come from a deterministic, versioned calculation engine. The AI only reads documents and explains results; it never produces a number in your report.</li>
          <li>Every price and rule shows its source and an “as of” date. We never call a price “verified”; we show ranges.</li>
          <li>If a datasheet value is missing, the result is “cannot verify”, never “pass”. Specs found by web search are labelled unverified until our reviewers check them.</li>
          <li>Savings are always shown as a range (conservative, expected, optimistic), never a guarantee.</li>
          <li>Findings describe evidence and questions. We never call an installer, brand or price fraudulent, fake or a scam.</li>
          <li>Tariff and regulatory figures come from public sources dated November 2026 and are being confirmed against official NEPRA, DISCO and FBR notifications.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="rules">The audit rules</h2>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead><tr className="text-muted"><th className="text-start py-1">Rule</th><th className="text-start">What we check</th><th className="text-start">Severity</th></tr></thead>
            <tbody>{RULES.map(([id, what, sev]) => <tr key={id} className="border-t border-line"><td className="py-1.5 font-mono">{id}</td><td>{what}</td><td>{sev}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="privacy">Privacy</h2>
        <ul className="mt-2 list-disc ps-5 space-y-1">
          <li>No account is needed. We ask your consent before any document is sent to our AI provider (Google Gemini) to be read.</li>
          <li>The AI is instructed not to copy names, addresses or reference numbers. Uploaded images are not stored; only the extracted figures you confirm are saved with your report.</li>
          <li>Anyone with your report link can view it. Only you (on the device you used, or signed in) can delete it, save it, or answer the follow-up survey. Deleting removes it permanently.</li>
          <li>Accounts are optional and use a one-time email code (via Supabase). We store your email and the reports you choose to save; you can delete all of them from “My reports”.</li>
          <li>Bill lookup by reference number: on your request, Roshni fetches your duplicate bill once from the official PITC portal (bill.pitc.com.pk). Your reference number is not stored. If the portal asks for a CAPTCHA we stop and ask for a photo instead. K-Electric bills must be uploaded as a photo.</li>
          <li>Text inside documents is treated as data, never as instructions to our system.</li>
          <li>Assistant conversations are not stored.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="terms">Terms in short</h2>
        <p className="mt-2">Roshni provides decision support, not a design certificate. Final design and installation must be done and checked by a qualified installer. Safety problems (burning smell, sparking, water ingress, structural cracks) need a qualified electrician or PEC-registered engineer on site.</p>
      </Card>
    </div>
  );
}

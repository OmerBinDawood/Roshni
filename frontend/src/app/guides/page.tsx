import { Card } from "@/components/ui";

export const metadata = { title: "Guides: net billing paperwork, genuine panels, safety — Roshni" };

export default function Guides() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Practical guides</h1>
      <p className="text-muted text-sm">Last reviewed 11 November 2026. Rules and fees change: always confirm with your DISCO / K-Electric before paying.</p>

      <Card>
        <h2 className="font-semibold text-lg" id="net-billing">Getting a net-billing connection</h2>
        <ol className="mt-2 list-decimal ps-5 space-y-1">
          <li>Choose an installer who can file the application (ask if they are on the AEDB/PPIB certified installer list).</li>
          <li>Make sure the system size is within your sanctioned load. If not, apply for a load extension first.</li>
          <li>Apply to your DISCO (or K-Electric). Since the August 2026 amendment, systems of 25 kW or less are approved by the DISCO without separate NEPRA concurrence (verify the current procedure with your DISCO).</li>
          <li>The DISCO inspects the installation and installs a bidirectional (green) meter.</li>
          <li>You sign the net-billing agreement (5 years for new users under the 2026 regulations). Exported units are credited at about Rs 10–11.</li>
        </ol>
        <h3 className="mt-3 font-medium">Documents usually asked for</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {["CNIC copy matching the name on the electricity bill (or proof of ownership / authority)", "Latest paid electricity bill",
            "Installer / vendor certificate", "Inverter and panel datasheets, and the inverter settings / compliance letter",
            "Single-line diagram of the system (your installer prepares this)", "Application form and fee (K-Electric guidelines list a fee per kW)"].map((x) => <li key={x}>☐ {x}</li>)}
        </ul>
        <p className="text-xs text-muted mt-2">Sources: NEPRA Prosumer Regulations 2026 and amendments; K-Electric Net Billing Guidelines (13 Apr 2026); PPIB net-metering reference guide.</p>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="genuine">Checking panels are genuine</h2>
        <ul className="mt-2 list-disc ps-5 space-y-1">
          <li>Ask for <b>A-grade</b> panels from an <b>authorised distributor</b>, in writing, with the exact model number.</li>
          <li>Check the serial number on the <b>manufacturer&apos;s own website or app</b>, never on a link the seller gives you. For example, LONGi runs a &quot;One Module One Code&quot; check.</li>
          <li>The label on the back should match the datasheet (model, watts, Voc, Isc) and the serial number should match the box.</li>
          <li>Look for cracked cells, bubbles, scratches or a bent frame before installation; refuse damaged panels.</li>
          <li>Ask who honours the warranty in Pakistan and keep the invoice that shows the serial numbers.</li>
        </ul>
        <p className="mt-2 text-sm">Brand-by-brand verification links and checks: <a className="underline" href="/brands">Brand guide</a>.</p>
        <p className="text-xs text-muted mt-2">Roshni guides you on what to check. It does not certify that any product is genuine.</p>
      </Card>

      <Card>
        <h2 className="font-semibold text-lg" id="safety">Safety basics</h2>
        <ul className="mt-2 list-disc ps-5 space-y-1">
          <li>Solar panels make dangerous DC voltage whenever there is light. Never open the DC wiring, connectors or the inverter yourself.</li>
          <li>A safe system has DC and AC breakers, surge protectors, proper copper solar cable and earthing. Ask for them in the quote.</li>
          <li>The structure must be anchored for storms and must not crack your roof. Ask about gauge, coating and anchoring.</li>
          <li>Clean panels early morning or evening with plain water and a soft brush; don&apos;t walk on panels or use pressure washers.</li>
        </ul>
        <div className="mt-3 rounded-xl bg-bad/10 text-bad p-3 text-sm">
          <b>Switch off and call a qualified electrician</b> if you notice a burning smell, sparking, buzzing, melted connectors, water inside the inverter or battery, or cracks in the roof under the structure.
        </div>
      </Card>
    </div>
  );
}

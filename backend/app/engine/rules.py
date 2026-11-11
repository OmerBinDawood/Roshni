"""Quote audit rule catalogue v0 (PRD Appendix B). Rules over scores: every finding has evidence.

Missing datasheet values give "cannot verify", never "pass" (Appendix A rule 23).
"""
import math
import re

from ..schemas import AuditRequest, Finding
from .data import appliances, regulatory


def _f(rule_id, severity, title, detail, evidence="", question=""):
    return Finding(rule_id=rule_id, severity=severity, title=title, detail=detail, evidence=evidence, question=question)


def _cannot_verify(rule_id, what, missing, question):
    return _f(rule_id, "CLARIFY", f"Cannot verify: {what}",
              f"We could not check this because the following datasheet values are missing: {', '.join(missing)}.",
              "Datasheet values missing", question)


def backup_loads(req: AuditRequest) -> dict:
    a, p = appliances(), req.profile
    run = p.backup_fans * a["fan_kw"] + p.backup_lights * a["light_kw"] + (0.15 if p.backup_fridge else 0)
    surges = [a["fridge_surge_kw"] if p.backup_fridge else 0]
    ac_kw = 0.0
    if p.backup_ac and p.acs:
        ac = p.acs[0]
        kind = "inverter" if ac.inverter else "non_inverter"
        ac_kw = ac.tons * a["ac_kw_per_ton"][kind]
        run += p.backup_ac * ac_kw
        surges.append(ac_kw * a["ac_surge_multiplier"][kind])
    if p.backup_motor:
        m = p.motor_hp * a["motor_kw_per_hp"]
        run += m
        surges.append(m * a["motor_surge_multiplier"])
    return {"running_kw": round(run, 2), "worst_start_kw": round(max(surges), 2)}


def run_rules(req: AuditRequest, ctx: dict) -> list[Finding]:
    """ctx carries engine outputs: site temps, regime, modelled savings, export share, etc."""
    s, q, p = req.system, req.quote, req.profile
    pan, inv, bat = s.panel, s.inverter, s.battery
    items = q.line_items
    types = {li.item_type for li in items}
    out: list[Finding] = []
    dc_kw = s.panel_count * (pan.pmax_w or 0) / 1000
    has_batt = s.battery_count > 0 or "battery" in types

    # R01 exact models
    majors = [li for li in items if li.item_type in ("panel", "inverter", "battery")]
    vague = [li.description or li.item_type for li in majors if not (li.brand and li.model)]
    if not majors:
        out.append(_f("R01", "CLARIFY", "Main equipment not itemised",
                      "The quote does not list panels, inverter and battery as separate line items.",
                      question="Please list each main item with its exact brand, model number and datasheet."))
    elif vague:
        out.append(_f("R01", "CLARIFY", "Exact model numbers missing",
                      "Without an exact model number, nobody can check compatibility, warranty or authenticity.",
                      "Missing for: " + "; ".join(vague),
                      "Please write the exact model numbers and attach datasheets."))
    else:
        out.append(_f("R01", "OK", "All main items have brand and model", ""))

    # R02 DC/AC ratio vs inverter max PV input
    if dc_kw and inv.max_pv_input_kw:
        if dc_kw > inv.max_pv_input_kw:
            out.append(_f("R02", "CRITICAL", "More panels than the inverter accepts",
                          f"The array is {dc_kw:.2f} kWp but the inverter allows at most {inv.max_pv_input_kw} kW of PV.",
                          f"{s.panel_count} x {pan.pmax_w:.0f} W = {dc_kw:.2f} kWp > {inv.max_pv_input_kw} kW",
                          f"The inverter allows {inv.max_pv_input_kw} kW of panels; why does the quote include {dc_kw:.2f} kW?"))
        else:
            out.append(_f("R02", "OK", "Array size within inverter PV limit",
                          f"{dc_kw:.2f} kWp <= {inv.max_pv_input_kw} kW"))
    elif s.panel_count <= 0:
        out.append(_f("R02", "CLARIFY", "Number of panels not stated",
                      "The quote does not say how many panels are included, so the array size cannot be checked.",
                      question="How many panels, of which exact model, are included?"))
    else:
        out.append(_cannot_verify("R02", "array size vs inverter limit",
                                  [n for n, v in (("panel Pmax", pan.pmax_w), ("inverter max PV input", inv.max_pv_input_kw)) if not v],
                                  "What is the inverter's maximum PV input power?"))

    # R03 cold Voc
    t_min, t_cell_max = ctx["site"]["t_min_air"], ctx["site"]["t_cell_max"]
    if pan.voc and pan.beta_voc_pct is not None and inv.max_dc_voltage:
        voc_cold = pan.voc * (1 + pan.beta_voc_pct / 100 * (t_min - 25))
        max_series = math.floor(inv.max_dc_voltage / voc_cold)
        if s.panels_per_string:
            v = s.panels_per_string * voc_cold
            if v >= inv.max_dc_voltage:
                out.append(_f("R03", "CRITICAL", "String voltage too high on cold mornings",
                              f"{s.panels_per_string} panels in series reach {v:.0f} V at {t_min:.0f} C, above the inverter's {inv.max_dc_voltage:.0f} V maximum. This can permanently damage the inverter.",
                              f"Voc_cold = {pan.voc} x (1 + {pan.beta_voc_pct}% x ({t_min:.0f} - 25)) = {voc_cold:.1f} V per panel",
                              f"Can you reduce the string to {max_series} panels or fewer?"))
            else:
                out.append(_f("R03", "OK", "Cold-morning string voltage within limit",
                              f"{s.panels_per_string} x {voc_cold:.1f} V = {v:.0f} V < {inv.max_dc_voltage:.0f} V"))
        else:
            out.append(_f("R03", "CLARIFY", "Stringing not stated",
                          f"At your site's coldest hour ({t_min:.0f} C) each panel reaches {voc_cold:.1f} V, so no more than {max_series} panels should be in one string.",
                          f"Voc_cold = {voc_cold:.1f} V; inverter max {inv.max_dc_voltage:.0f} V",
                          "How many panels per string, and what is the cold-morning voltage?"))
    else:
        out.append(_cannot_verify("R03", "cold-morning string voltage",
                                  [n for n, v in (("panel Voc", pan.voc), ("Voc temperature coefficient", pan.beta_voc_pct),
                                                  ("inverter max DC voltage", inv.max_dc_voltage)) if v is None],
                                  "How many panels per string, and what is the cold-morning voltage?"))

    # R04 hot Vmp vs MPPT min
    if pan.vmp and inv.mppt_min_v and s.panels_per_string:
        beta_vmp = (pan.gamma_pmax_pct if pan.gamma_pmax_pct is not None else -0.35)
        v_hot = s.panels_per_string * pan.vmp * (1 + beta_vmp / 100 * (t_cell_max - 25))
        if v_hot < inv.mppt_min_v:
            out.append(_f("R04", "CLARIFY", "String may drop below MPPT range in summer",
                          f"At {t_cell_max:.0f} C cell temperature the string falls to about {v_hot:.0f} V, below the {inv.mppt_min_v:.0f} V MPPT minimum.",
                          f"{s.panels_per_string} x Vmp {pan.vmp} V derated", "Will the string stay within the MPPT range in June?"))
        else:
            out.append(_f("R04", "OK", "Hot-day string voltage within MPPT range", f"~{v_hot:.0f} V >= {inv.mppt_min_v:.0f} V"))

    # R05 current per MPPT
    if pan.isc and inv.max_isc_per_mppt_a and s.strings_per_mppt:
        i = s.strings_per_mppt * pan.isc * 1.25
        if i > inv.max_isc_per_mppt_a:
            out.append(_f("R05", "CRITICAL", "Too much current on one MPPT input",
                          f"{s.strings_per_mppt} parallel strings give {i:.1f} A (with 1.25 safety factor), above the {inv.max_isc_per_mppt_a} A limit.",
                          f"{s.strings_per_mppt} x {pan.isc} A x 1.25", "How are strings split across the MPPT inputs?"))
        else:
            out.append(_f("R05", "OK", "MPPT current within limit", f"{i:.1f} A <= {inv.max_isc_per_mppt_a} A"))

    # R26 panel orientation (Roshni addition): roof direction and tilt change yearly output
    if ctx.get("orientation_loss", 0) >= 0.08:
        loss = ctx["orientation_loss"] * 100
        out.append(_f("R26", "CLARIFY" if loss >= 20 else "INFO", f"Panel direction costs about {loss:.0f}% of output",
                      f"Panels facing {ctx['azimuth']:.0f} degrees (180 = south) at {ctx['tilt']:.0f} degrees tilt make about {loss:.0f}% "
                      "fewer units a year than south-facing panels at about 20 degrees. A raised structure can often fix this.",
                      question="Can the structure face the panels south at about 20 degrees?"))

    # R27 quote vs Roshni's own sizing for this household (Roshni addition)
    sz = ctx.get("sizing")
    if sz and dc_kw:
        rec = sz["dc_kw"]
        if dc_kw > rec * 1.3 and dc_kw - rec >= 1.0:
            out.append(_f("R27", "CLARIFY", f"Quote is bigger than Roshni's sizing for your home ({dc_kw:.1f} kW vs about {rec:g} kW)",
                          f"For your use, tariff and rules, extra panels beyond about {rec:g} kW stop paying for themselves within 6 years "
                          "or export much of their output at the low buyback rate.",
                          f"Quote {dc_kw:.1f} kW; Roshni sizing {rec:g} kW ({sz['name']})",
                          f"Why {dc_kw:.1f} kW instead of about {rec:g} kW, and how much extra will the additional panels save each month?"))
        elif dc_kw < rec * 0.6 and rec - dc_kw >= 1.0:
            out.append(_f("R27", "INFO", f"Quote is smaller than Roshni's sizing ({dc_kw:.1f} kW vs about {rec:g} kW)",
                          f"A system of about {rec:g} kW would cut your bill further; a smaller one costs less but saves less.",
                          f"Quote {dc_kw:.1f} kW; Roshni sizing {rec:g} kW", "Is the roof or budget limiting the size? Could the system be expanded later?"))
        else:
            out.append(_f("R27", "OK", "System size is in line with Roshni's sizing for your home",
                          f"{dc_kw:.1f} kW vs about {rec:g} kW suggested."))
        total, qc = q.grand_total, sz.get("quote_cost")
        if total and qc:
            if total > qc["high"] * 1.15:
                out.append(_f("R27", "CLARIFY", "Total is above Roshni's cost range for a system of this size",
                              f"Rs {total:,.0f} vs an indicative Rs {qc['low']:,.0f} to {qc['high']:,.0f} for {dc_kw:.1f} kW "
                              "(panels, inverter, battery, structure and installation; approval fees extra).",
                              f"Quote Rs {total:,.0f}", "What explains the difference from typical component prices? Please itemise."))
            elif total < qc["low"] * 0.7:
                out.append(_f("R27", "INFO", "Total is well below the usual cost range: check what is missing",
                              f"Rs {total:,.0f} vs an indicative Rs {qc['low']:,.0f} to {qc['high']:,.0f}. Very low quotes often leave out "
                              "protection, earthing, structure quality or genuine A-grade panels.",
                              f"Quote Rs {total:,.0f}", "Which items and grades are included at this price?"))

    # R25 on-grid quote but user wants backup
    if inv.type == "on_grid" and p.wants_backup:
        out.append(_f("R25", "CRITICAL", "This system will not work during load-shedding",
                      "An on-grid inverter switches off when the grid goes down (a safety rule). You said you need backup during outages.",
                      "Inverter type: on-grid; backup requested",
                      "This inverter switches off during load-shedding; how will backup work?"))

    # Battery rules
    bl = backup_loads(req)
    if has_batt:
        if bat.voltage_class and inv.battery_voltage_class:
            if bat.voltage_class != inv.battery_voltage_class:
                out.append(_f("R06", "CRITICAL", "Battery and inverter voltage do not match",
                              f"The battery is {bat.voltage_class} but the inverter supports {inv.battery_voltage_class} batteries.",
                              question="Is this battery on the inverter maker's approved list?"))
            else:
                out.append(_f("R06", "OK", "Battery voltage class matches inverter", bat.voltage_class))
        else:
            out.append(_cannot_verify("R06", "battery/inverter voltage match", ["battery or inverter voltage class"],
                                      "Is this battery on the inverter maker's approved list?"))
        if not bat.protocol:
            out.append(_f("R07", "CLARIFY", "Battery communication not documented",
                          "Without BMS communication the inverter cannot read the battery's charge level, which shortens battery life.",
                          question="Will the inverter read the battery state of charge over CAN/RS485?"))
        if bat.max_discharge_kw:
            total = bat.max_discharge_kw * max(1, s.battery_count)
            if total < bl["running_kw"]:
                out.append(_f("R08", "CRITICAL", "Battery cannot power your backup load",
                              f"Your backup appliances need about {bl['running_kw']} kW together; the battery can deliver {total:.1f} kW.",
                              question=f"Can this battery supply {bl['running_kw']} kW continuously?"))
        usable = (bat.usable_kwh or (bat.nominal_kwh or 0) * 0.9) * max(1, s.battery_count)
        if not usable:
            out.append(_cannot_verify("R09", "battery backup hours", ["battery capacity (kWh)"],
                                      "What is the usable capacity (kWh) of the battery, and how many hours will it run my backup loads?"))
        if usable:
            need = bl["running_kw"] * p.outage_hours_per_day
            hours = usable / bl["running_kw"] if bl["running_kw"] else 0
            sev = "OK" if usable >= need else "CLARIFY"
            out.append(_f("R09", sev, f"Battery runs your backup load for about {hours:.1f} hours",
                          f"Backup appliances use ~{bl['running_kw']} kW; usable battery energy ~{usable:.1f} kWh; you reported {p.outage_hours_per_day:g} hours of outages a day.",
                          question="How many hours will fans, lights and fridge run?"))
    if inv.rated_kw:
        if inv.rated_kw < bl["running_kw"]:
            out.append(_f("R10", "CRITICAL", "Inverter too small for your backup load",
                          f"Backup load ~{bl['running_kw']} kW exceeds inverter rating {inv.rated_kw} kW."))
        elif inv.surge_kva and inv.surge_kva < bl["running_kw"] + bl["worst_start_kw"]:
            out.append(_f("R10", "CLARIFY", "Motor/AC start may trip the inverter",
                          f"Starting your largest motor needs ~{bl['worst_start_kw']} kW on top of running loads; inverter surge is {inv.surge_kva} kVA.",
                          question="Will the water motor start while the AC runs on battery?"))

    # R11 phase
    user_phase = p.phase or (req.bill.phase if req.bill else None)
    if inv.phase and user_phase and inv.phase != user_phase:
        out.append(_f("R11", "CRITICAL", "Inverter phase does not match your connection",
                      f"Inverter is {inv.phase}-phase; your connection is {user_phase}-phase.",
                      question="Is the inverter single- or three-phase? Do I need a load extension?"))

    # R12-R16 balance of system presence. Quotes often bundle these into one line ("structure, wiring, earthing,
    # SPD"), so an item counts as listed if its type matches OR any line's text mentions it.
    doc = "parts list" if ctx.get("mode") == "parts" else "quote"
    corpus = " ".join(f"{li.description or ''} {li.model or ''}" for li in items).lower()
    bos = [("R12", {"dc_breaker", "dc_spd"},
            r"\bdc\b[^,;]{0,25}(breaker|isolator|mcb|fuse|spd|surge)|(breaker|isolator|spd|surge)[^,;]{0,15}\bdc\b|dc\s*/\s*ac\s*(spd|breaker)",
            "DC protection (breaker/isolator, surge protector)", "Which DC breaker and surge protector are included?"),
           ("R13", {"ac_breaker", "ac_spd"},
            r"\bac\b[^,;]{0,25}(breaker|mcb|spd|surge)|(breaker|spd|surge)[^,;]{0,15}\bac\b|dc\s*/\s*ac\s*(spd|breaker)|\bac\s*/\s*dc\b",
            "AC protection (breaker, surge protector)", "Which AC breaker and surge protector are included?"),
           ("R14", {"earthing"}, r"earth|\bground(ing)?\b", "Earthing", "How many earthing pits, and is DC earthing separate?"),
           ("R15", {"dc_cable", "ac_cable"}, r"cabl|\bwir(e|es|ing)\b", "Cable type and size", "What size and brand of DC and AC cable?"),
           ("R16", {"structure"}, r"structur|\bstand\b|mount|\bframe|\brack", "Mounting structure",
            "What gauge and coating is the structure, and how is it anchored?")]
    protect_types = {"dc_breaker", "dc_spd", "ac_breaker", "ac_spd"}
    protect_corpus = " ".join(f"{li.description or ''} {li.model or ''}" for li in items if li.item_type in protect_types).lower()
    for rid, need, pattern, label, qn in bos:
        if need <= protect_types and re.search(pattern, protect_corpus):
            continue  # listed on its own protection line, e.g. "DC breaker + SPD, AC breaker"
        if not (types & need) and not re.search(pattern, corpus):
            out.append(_f(rid, "CLARIFY", f"{label} not listed",
                          f"The {doc} does not mention: {label}. Missing items are a common cause of fires, damage and hidden extra charges.",
                          question=qn))
        elif not (types & need):
            out.append(_f(rid, "CLARIFY", f"{label}: mentioned but not itemised",
                          f"{label} is bundled into another line without brand, rating or size, so it cannot be checked.",
                          question=qn))

    # R17 warranties
    no_w = [li.item_type for li in majors if not li.warranty_text]
    if no_w:
        out.append(_f("R17", "CLARIFY", "Warranty terms missing",
                      "Warranties must be in writing, with who honours them in Pakistan.", "No warranty for: " + ", ".join(sorted(set(no_w))),
                      "Who honours the warranty in Pakistan, and is it in writing?"))

    # R18 panel grade / distributor
    panel_txt = " ".join((li.description or "") + " " + (li.model or "") for li in items if li.item_type == "panel").lower()
    if "panel" in types and not re.search(r"\ba[\s-]?grade\b", panel_txt):
        out.append(_f("R18", "CLARIFY", "Panel grade and distributor not stated",
                      "Counterfeit and B-grade panels are sold under famous brand names. Ask for A-grade from an authorised distributor and verify serial numbers on the maker's own website.",
                      question="Are these A-grade panels from an authorised distributor? Can I verify the serial numbers?"))

    # R19 savings claim vs regime
    regime = ctx["regime"]
    exp = ctx["savings_monthly"]
    if regime == "NET_BILLING_2026" and (q.savings_assumes_net_metering or
                                         (q.claimed_monthly_savings_rs and q.claimed_monthly_savings_rs > exp["high"] * 1.2)):
        claim = f"Rs {q.claimed_monthly_savings_rs:,.0f}/month claimed" if q.claimed_monthly_savings_rs else "Savings assume 1:1 net metering"
        out.append(_f("R19", "CRITICAL", "Savings claim looks based on old net-metering rules",
                      f"New connections get net billing: exported units earn ~Rs {regulatory()['regimes']['NET_BILLING_2026']['buyback_rate_rs']:.0f}, not your full tariff. Our estimate for your home is Rs {exp['low']:,.0f} to {exp['high']:,.0f} per month on average.",
                      claim, "Your savings assume 1:1 net metering; new connections get net billing. Please recalculate."))
    elif exp and q.claimed_monthly_savings_rs and q.claimed_monthly_savings_rs > exp["high"] * 1.2:
        out.append(_f("R19", "CLARIFY", "Savings claim is higher than our estimate",
                      f"The quote claims Rs {q.claimed_monthly_savings_rs:,.0f}/month; for your home and rules we estimate "
                      f"Rs {exp['low']:,.0f} to {exp['high']:,.0f}.",
                      f"Rs {q.claimed_monthly_savings_rs:,.0f}/month claimed",
                      "How did you calculate the monthly savings? Which units and tariff did you assume?"))

    # R20 oversizing for export
    if regime == "NET_BILLING_2026" and ctx["export_share"] > 0.4:
        out.append(_f("R20", "INFO", "Much of the solar would be exported cheaply",
                      f"About {ctx['export_share']*100:.0f}% of generation would be exported at the low buyback rate. A smaller system or a battery may give better value.",
                      question="Would a smaller system or a battery give better value?"))

    # R21 price check (panels)
    bm = regulatory()["price_benchmarks"]
    for li in items:
        if li.item_type == "panel" and li.unit_price and pan.pmax_w:
            rpw = li.unit_price / pan.pmax_w
            lo, hi = bm["panel_rs_per_w"]["low"], bm["panel_rs_per_w"]["high"]
            if rpw > hi * 1.1:
                out.append(_f("R21", "CLARIFY", "Panel price above the observed range",
                              f"Rs {rpw:.1f}/W vs observed Rs {lo} to {hi}/W for tier-1 panels (as of {bm['as_of']}, {bm['panel_rs_per_w']['source_ref']}).",
                              question="This item is above the observed range; what explains the difference?"))
            else:
                out.append(_f("R21", "INFO", "Panel price within or near observed range",
                              f"Rs {rpw:.1f}/W vs Rs {lo} to {hi}/W (as of {bm['as_of']})."))
        if li.item_type == "inverter" and li.unit_price and inv.rated_kw and 4.5 <= inv.rated_kw <= 6.5:
            ib = bm["inverter_5_6kw_rs"]
            if li.unit_price > ib["high"] * 1.1:
                out.append(_f("R21", "CLARIFY", "Inverter price above the observed range",
                              f"Rs {li.unit_price:,.0f} vs Rs {ib['low']:,} to {ib['high']:,} for 5 to 6 kW inverters ({ib['source_ref']}).",
                              question="This item is above the observed range; what explains the difference?"))
            else:
                out.append(_f("R21", "INFO", "Inverter price within the observed range",
                              f"Rs {li.unit_price:,.0f} vs Rs {ib['low']:,} to {ib['high']:,} for 5 to 6 kW ({ib['source_ref']})."))
    total = q.grand_total
    if total and dc_kw and not has_batt and inv.type == "on_grid" and 4.5 <= dc_kw <= 6.5:
        sb = bm["system_5kw_ongrid_rs"]
        if total > sb["high"] * 1.1:
            out.append(_f("R21", "CLARIFY", "Total price above the observed range for a ~5 kW on-grid system",
                          f"Rs {total:,.0f} vs Rs {sb['low']:,} to {sb['high']:,} ({sb['source_ref']}).",
                          question="What explains the higher total compared to typical 5 kW on-grid systems?"))

    # R22 net billing fees
    if regime == "NET_BILLING_2026" and inv.type != "off_grid" and "net_metering_fee" not in types:
        out.append(_f("R22", "CLARIFY", "Net-billing application and meter costs not mentioned",
                      "Approval, meter and DISCO fees can add a noticeable amount.",
                      question="Are approval, meter and DISCO charges included?"))

    # R23 payment terms
    if q.payment_terms:
        m = re.search(r"(\d{2,3})\s*%", q.payment_terms)
        if m and int(m.group(1)) > 50:
            out.append(_f("R23", "INFO", "Large advance payment",
                          f"The quote asks for {m.group(1)}% up front.", q.payment_terms,
                          "Can payment be split by delivery and commissioning?"))
    else:
        out.append(_f("R23", "INFO", "Payment terms not stated", "",
                      question="Can payment be split by delivery and commissioning?"))

    # R24 AEDB
    if regime == "NET_BILLING_2026" and inv.type != "off_grid":
        out.append(_f("R24", "INFO", "Check installer certification",
                      "Net-billing applications have historically required an AEDB/PPIB-certified installer.",
                      question="Are you an AEDB-certified installer?"))
    return out

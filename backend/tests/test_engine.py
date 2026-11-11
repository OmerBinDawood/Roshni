from app.engine.audit import run_audit, battery_options
from app.schemas import AuditRequest, Quote, LineItem, SystemConfig, PanelSpec, InverterSpec, BatterySpec, Profile, AC, Bill


def sample_request(**over):
    q = Quote(line_items=[
        LineItem(item_type="panel", description="LONGi 585W A grade", brand="LONGi", model="LR5-72HTH-585M", quantity=10, unit_price=23400, warranty_text="12y product"),
        LineItem(item_type="inverter", description="Hybrid 6kW", brand="Deye", model="SUN-6K-SG05LP1", quantity=1, unit_price=330000),
        LineItem(item_type="battery", description="5kWh LiFePO4", brand="Pylontech", model="X", quantity=1, unit_price=280000),
    ], grand_total=900000, claimed_monthly_savings_rs=40000, savings_assumes_net_metering=True, payment_terms="70% advance")
    sysc = SystemConfig(panel_count=10, panels_per_string=10,
                        panel=PanelSpec(pmax_w=585, voc=52.0, vmp=44.0, isc=14.0, beta_voc_pct=-0.25, gamma_pmax_pct=-0.29),
                        inverter=InverterSpec(type="hybrid", rated_kw=6, surge_kva=12, max_pv_input_kw=7.8, max_dc_voltage=500,
                                              mppt_min_v=150, mppt_count=2, max_isc_per_mppt_a=26, battery_voltage_class="LV", phase="single"),
                        battery_count=1, battery=BatterySpec(voltage_class="LV", nominal_kwh=5.12, usable_kwh=4.6, max_discharge_kw=2.5))
    prof = Profile(city="Lahore", acs=[AC(count=2, tons=1.5, inverter=True)], outage_hours_per_day=4, backup_ac=0)
    bill = Bill(current_units=650, total_amount_rs=32000, fixed_charges_rs=500, monthly_units_history=[300,280,320,450,600,750,800,780,700,550,350,300])
    return AuditRequest(quote=q, system=sysc, profile=prof, bill=bill)


def test_audit_runs_and_flags():
    r = run_audit(sample_request())
    ids = {f["rule_id"]: f["severity"] for f in r["findings"]}
    assert ids["R03"] == "CRITICAL"   # 10 x ~54V cold > 500V
    assert ids["R19"] == "CRITICAL"   # net-metering assumption for new user
    assert r["finance"]["regime"] == "NET_BILLING_2026"
    print(r["finance"]["annual"], r["finance"]["savings_monthly"], r["cashflow"]["payback_years"], r["site"])
    yield_ = r["finance"]["annual"]["pv_kwh"] / 5.85
    assert 1300 < yield_ < 1750, yield_


def test_battery_options():
    req = sample_request()
    r = battery_options(req.profile, req.bill, dc_kw=6, inverter_kw=6)
    assert r["options"][0]["usable_kwh"] == 0
    print(r["options"])

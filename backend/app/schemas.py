"""Shared data contracts. Gemini extraction returns these shapes; the engine consumes them."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ItemType = Literal[
    "panel", "inverter", "battery", "structure", "dc_cable", "ac_cable", "dc_breaker",
    "dc_spd", "ac_breaker", "ac_spd", "earthing", "changeover", "net_metering_fee",
    "installation", "other",
]


class LineItem(BaseModel):
    item_type: ItemType = "other"
    description: str = ""
    brand: Optional[str] = None
    model: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    line_total: Optional[float] = None
    warranty_text: Optional[str] = None
    low_confidence: bool = False


class Quote(BaseModel):
    installer_name: Optional[str] = None
    line_items: list[LineItem] = Field(default_factory=list)
    grand_total: Optional[float] = None
    payment_terms: Optional[str] = None
    claimed_monthly_savings_rs: Optional[float] = None
    claimed_payback_years: Optional[float] = None
    savings_assumes_net_metering: Optional[bool] = None
    panels_per_string: Optional[int] = Field(None, description="Only if the document states how many panels are wired in series per string")
    strings_per_mppt: Optional[int] = Field(None, description="Only if the document states parallel strings per MPPT input")
    notes: Optional[str] = None


class Bill(BaseModel):
    provider: Optional[str] = None
    tariff_category: Optional[str] = None
    sanctioned_load_kw: Optional[float] = None
    phase: Optional[Literal["single", "three"]] = None
    current_units: Optional[float] = None
    monthly_units_history: list[float] = Field(default_factory=list, description="Oldest first, up to 12")
    total_amount_rs: Optional[float] = None
    energy_charges_rs: Optional[float] = None
    fixed_charges_rs: Optional[float] = None
    fpa_rs: Optional[float] = None
    taxes_rs: Optional[float] = None
    protected: Optional[bool] = None
    net_metered: Optional[bool] = None
    export_units: Optional[float] = None
    bill_month: Optional[int] = Field(None, description="Calendar month (1-12) of the billing month this bill is for")


class PanelSpec(BaseModel):
    pmax_w: Optional[float] = None
    voc: Optional[float] = None
    vmp: Optional[float] = None
    isc: Optional[float] = None
    beta_voc_pct: Optional[float] = Field(None, description="Temperature coefficient of Voc, %/C (negative)")
    gamma_pmax_pct: Optional[float] = None
    source: Optional[str] = None
    verified: bool = False


class InverterSpec(BaseModel):
    type: Optional[Literal["on_grid", "hybrid", "off_grid"]] = None
    rated_kw: Optional[float] = None
    surge_kva: Optional[float] = None
    max_pv_input_kw: Optional[float] = None
    max_dc_voltage: Optional[float] = None
    mppt_min_v: Optional[float] = None
    mppt_max_v: Optional[float] = None
    mppt_count: Optional[int] = None
    max_isc_per_mppt_a: Optional[float] = None
    battery_voltage_class: Optional[Literal["LV", "HV"]] = None
    phase: Optional[Literal["single", "three"]] = None
    source: Optional[str] = None
    verified: bool = False


class BatterySpec(BaseModel):
    voltage_class: Optional[Literal["LV", "HV"]] = None
    nominal_kwh: Optional[float] = None
    usable_kwh: Optional[float] = None
    max_discharge_kw: Optional[float] = None
    chemistry: Optional[str] = None
    protocol: Optional[str] = None
    warranty_cycles: Optional[int] = None
    source: Optional[str] = None
    verified: bool = False


class SystemConfig(BaseModel):
    """Confirmed technical configuration derived from the quote + specs."""
    panel_count: int = 0
    panel: PanelSpec = Field(default_factory=PanelSpec)
    panels_per_string: Optional[int] = None
    strings_per_mppt: Optional[int] = None
    inverter: InverterSpec = Field(default_factory=InverterSpec)
    battery_count: int = 0
    battery: BatterySpec = Field(default_factory=BatterySpec)
    tilt: float = 20.0
    azimuth: float = 180.0


class AC(BaseModel):
    count: int = 1
    tons: float = 1.5
    inverter: bool = True
    day_hours: float = 6
    night_hours: float = 6


class Profile(BaseModel):
    city: str = "Lahore"
    acs: list[AC] = Field(default_factory=list)
    motor_hp: float = 1.0
    fridges: int = 1
    fans: int = 6
    lights: int = 10
    backup_fans: int = 3
    backup_lights: int = 5
    backup_fridge: bool = True
    backup_ac: int = 0
    backup_motor: bool = False
    outage_hours_per_day: float = 4
    goal: Literal["bill", "backup", "both"] = "both"
    wants_backup: bool = True
    net_metering_agreement_date: Optional[str] = None  # ISO date, None = no agreement
    phase: Optional[Literal["single", "three"]] = None
    scale_to_bill: bool = True  # user agrees to scale the modelled profile to bill history (PRD 10.2)


class AuditRequest(BaseModel):
    quote: Quote
    system: SystemConfig
    profile: Profile
    bill: Optional[Bill] = None
    language: Literal["en", "ur"] = "en"
    mode: Literal["full", "parts"] = "full"  # "parts" = Journey 3 parts-list safety check, no savings modelling


class Finding(BaseModel):
    rule_id: str
    severity: Literal["CRITICAL", "CLARIFY", "INFO", "OK"]
    title: str
    detail: str
    evidence: str = ""
    question: str = ""

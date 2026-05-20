"""
schemas.py — Input/output contracts for BioRoute multi-agent pipeline.

Each subagent has:
  - *Input model  — what the orchestrator passes via task()
  - *Output model — structured response_format (Pydantic)

Aligns with PROJECT_SCOPE.md Steps 1–4 and mock CRM fields in active_shipments.json.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Agent 1 — Hazard Extractor
# ─────────────────────────────────────────────────────────────────────────────

class HazardExtractorInput(BaseModel):
    """INPUT to hazard-extractor: raw unstructured alert only."""

    raw_alert_text: str = Field(
        description="Full text from news, weather, traffic, or social post."
    )


class HazardExtraction(BaseModel):
    """OUTPUT from hazard-extractor (Step 1 — Insight Extraction)."""

    hazard_detected: bool = Field(
        description="True if any logistics-relevant hazard is present."
    )
    location: str = Field(
        description="Primary location: district, junction, or corridor name."
    )
    affected_districts: List[str] = Field(
        default_factory=list,
        description="All district names mentioned or implied, e.g. ['District 1', 'District 4'].",
    )
    hazard_type: str = Field(
        description=(
            "Primary category: Heatwave | Traffic Blockage | Flooding | Storm | "
            "Road Closure | Fuel Price Spike | Combined | Unknown."
        )
    )
    severity_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(
        description="Operational severity for cold-chain routing."
    )
    severity_details: str = Field(
        description=(
            "Measurable facts only, e.g. 'Highway 9 blocked; 42°C until 5pm; +45 min delay'."
        )
    )
    affected_routes: List[str] = Field(
        default_factory=list,
        description="Highways or routes directly blocked or degraded.",
    )
    temperature_celsius: Optional[float] = Field(
        default=None,
        description="Ambient temperature in °C if stated.",
    )
    estimated_duration_minutes: Optional[int] = Field(
        default=None,
        description="How long the hazard is expected to last.",
    )
    estimated_delay_minutes: Optional[int] = Field(
        default=None,
        description="Extra travel delay in minutes if stated (e.g. diversion).",
    )
    closure_window: Optional[str] = Field(
        default=None,
        description="Road closure time window if stated, e.g. '11:00–17:00'.",
    )
    display_summary: str = Field(
        description="One judge-facing sentence, max 120 characters.",
    )
    why_brief: str = Field(
        description="≤15 words: why this alert matters for cold-chain routing.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Agent 2 — Fleet Scout
# ─────────────────────────────────────────────────────────────────────────────

class ActiveShipmentBrief(BaseModel):
    """One row from active_shipments.json for fleet overview."""

    shipment_id: str
    route_name: str
    cargo_type: str
    eta_minutes: Optional[int] = None
    destination: str = Field(description="Last stop on current route.")


class FleetScoutOutput(BaseModel):
    """OUTPUT from fleet-scout — who is on the road right now."""

    total_active: int = Field(description="Count of active_shipments in CRM.")
    active_shipments: List[ActiveShipmentBrief] = Field(
        default_factory=list,
        description="All shipments currently in transit from the database.",
    )
    display_summary: str = Field(
        description="One sentence listing how many trucks and main corridors.",
    )
    why_brief: str = Field(
        description="≤15 words: why we list the fleet before matching routes.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Agent 3 — Route Impact Analyzer
# ─────────────────────────────────────────────────────────────────────────────

class ImpactAnalyzerInput(BaseModel):
    """INPUT to impact-analyzer — orchestrator passes raw alert + optional fleet JSON in task text."""

    raw_alert_text: str = Field(
        description="Full unstructured news; agent infers hazard itself."
    )
    fleet: Optional[FleetScoutOutput] = Field(
        default=None,
        description="Optional fleet snapshot from fleet-scout (not hazard JSON).",
    )


class AlternativeRouteOption(BaseModel):
    """One pre-planned alternate path from active_shipments.json."""

    id: str = Field(description="Alternative id, e.g. A1.")
    name: str = Field(description="Route name — must match alternative_routes[].name.")
    eta_minutes: Optional[int] = Field(default=None, description="Estimated minutes for this path.")
    notes: Optional[str] = Field(default=None, description="When to prefer this alternative.")


class ImpactAnalysis(BaseModel):
    """OUTPUT from impact-analyzer (Step 3 — route impact on fleet)."""

    impact_detected: bool = Field(
        description="True if at least one active shipment is affected."
    )
    affected_shipment_id: Optional[str] = Field(
        default=None,
        description="Highest-risk shipment ID from active_shipments.json.",
    )
    matched_shipment_ids: List[str] = Field(
        default_factory=list,
        description="All shipment IDs on affected routes or destinations.",
    )
    cargo_type: Optional[str] = Field(
        default=None,
        description="Cargo description for affected shipment.",
    )
    cargo_value_usd: Optional[int] = Field(
        default=None,
        description="Financial value of affected cargo in USD.",
    )
    criticality_tier: Optional[Literal["ULTRA", "CRITICAL", "STANDARD"]] = Field(
        default=None,
        description="ULTRA=plasma/organs; CRITICAL=insulin/vaccines; STANDARD=saline/etc.",
    )
    primary_route: Optional[str] = Field(
        default=None,
        description="Shipment's current planned route.",
    )
    destination: Optional[str] = Field(
        default=None,
        description="Shipment's destination facility.",
    )
    current_status: Optional[str] = Field(
        default=None,
        description="Shipment status before action, e.g. 'In Transit (On Time)'.",
    )
    alternative_routes: List[AlternativeRouteOption] = Field(
        default_factory=list,
        description="All four alternative_routes from the shipment file (id, name, eta, notes).",
    )
    backup_facility: Optional[str] = Field(
        default=None,
        description="Last stop on the best candidate alternative (for action-planner).",
    )
    backup_route: Optional[str] = Field(
        default=None,
        description="Name of the best candidate alternative route (action-planner may override).",
    )
    ambient_temperature_celsius: Optional[float] = Field(
        default=None,
        description="External temp used in calculation (from hazard or default).",
    )
    operational_impact: str = Field(
        description=(
            "Plain-language impact, e.g. 'Truck on Highway 9 — cooling fails in 45 min'."
        )
    )
    time_to_failure_minutes: Optional[int] = Field(
        default=None,
        description="Minutes until thermal spoilage if no action.",
    )
    financial_consequence: str = Field(
        description=(
            "E.g. '$50,000 cargo spoilage + critical medical shortage' or 'No financial exposure'."
        )
    )
    medical_consequence: Optional[str] = Field(
        default=None,
        description="Hospital/patient impact if cargo spoils or is delayed.",
    )
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(
        description="Overall risk after cross-checking hazard + shipment."
    )
    requires_immediate_action: bool = Field(
        description=(
            "True if route blocked AND temp above cargo threshold AND time_to_failure < 60."
        )
    )
    action_reason: str = Field(
        description="Why action is or is not required — one sentence for judges.",
    )
    display_summary: str = Field(
        description="One judge-facing sentence with ID, route, time, and money.",
    )
    why_brief: str = Field(
        description="≤15 words: why this shipment is or is not affected.",
    )
    unaffected_shipment_ids: List[str] = Field(
        default_factory=list,
        description="Active IDs that are clear of the hazard corridor.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Agent 4 — Action Planner
# ─────────────────────────────────────────────────────────────────────────────

class ActionPlannerInput(BaseModel):
    """INPUT to action-planner — raw alert + impact JSON in task text."""

    raw_alert_text: str = Field(
        description="Full unstructured news; agent infers constraints itself."
    )
    impact: ImpactAnalysis


class DatabaseSimulationPayload(BaseModel):
    """CRM update payload — written by update_crm_tool (Step 4 simulation)."""

    shipment_id: str
    new_status: str = Field(
        description="Usually 'Emergency Reroute' when diverting."
    )
    new_destination: str = Field(
        description="Last place on the chosen alternative's stops[] array."
    )
    new_route: str = Field(
        description="Exact alternative_routes[].name chosen by action-planner."
    )


class DriverNotification(BaseModel):
    """Short actionable turn-by-turn message for the truck driver."""
    message_draft: str = Field(
        description="Concise SMS/radio message for the driver: new route name, key turn, ETA. Max 100 words."
    )
    urgency_level: Literal["IMMEDIATE", "HIGH", "MEDIUM", "LOW"]
    channels: List[str] = Field(default_factory=lambda: ["sms", "radio"])


class HospitalNotification(BaseModel):
    """Formal ETA update notification for hospital administration."""
    recipient: str = Field(description="Hospital name + department, e.g. 'Liaquat Hospital, Pharmacy Admin'.")
    message_draft: str = Field(
        description="Formal email body: cargo type, original ETA, new ETA, new collection point. Max 200 words."
    )
    urgency_level: Literal["IMMEDIATE", "HIGH", "MEDIUM", "LOW"]
    channels: List[str] = Field(default_factory=lambda: ["email"])


class CoordinatorNotification(BaseModel):
    """Operational summary for fleet coordinator / dispatch."""
    message_draft: str = Field(
        description="Operational brief: shipment ID, hazard, selected route, ETA delta, cost impact. Max 150 words."
    )
    urgency_level: Literal["IMMEDIATE", "HIGH", "MEDIUM", "LOW"]
    channels: List[str] = Field(default_factory=lambda: ["email", "dashboard"])


class NotificationSimulation(BaseModel):
    """Three-way notification bundle (driver / hospital / coordinator)."""
    driver: DriverNotification
    hospital: HospitalNotification
    coordinator: CoordinatorNotification

    # Legacy single-recipient fields kept for backward compat
    recipient: str = Field(
        default="",
        description="Primary recipient name (hospital admin). Populated from hospital.recipient.",
    )
    message_draft: str = Field(
        default="",
        description="Convenience alias of hospital.message_draft.",
    )
    urgency_level: Literal["IMMEDIATE", "HIGH", "MEDIUM", "LOW"] = "HIGH"
    channels: List[str] = Field(default_factory=lambda: ["email", "sms"])


class ActionPlan(BaseModel):
    """OUTPUT from action-planner (Step 3 — Action Generation)."""

    recommended_action: str = Field(
        description="Domain-specific rescue plan in one sentence.",
    )
    action_type: Literal["REROUTE", "MONITOR", "HOLD_AT_FACILITY", "NO_ACTION"] = Field(
        description="Primary action category."
    )
    urgency: Literal["IMMEDIATE", "SOON", "MONITOR"] = Field(
        description="How quickly the orchestrator must execute."
    )
    estimated_eta_minutes: Optional[int] = Field(
        default=None,
        description="Estimated minutes to new destination after reroute.",
    )
    selected_alternative_id: Optional[str] = Field(
        default=None,
        description="Id of chosen alternative, e.g. A1.",
    )
    selected_route_name: Optional[str] = Field(
        default=None,
        description="Exact alternative_routes[].name — best of four for this hazard.",
    )
    selection_rationale: Optional[str] = Field(
        default=None,
        description="Why this alternative beat the other three (traffic, temp, ETA).",
    )
    database_simulation_payload: DatabaseSimulationPayload = Field(
        description="Exact fields for update_crm_tool."
    )
    notification_simulation: NotificationSimulation = Field(
        description="Exact fields for notify_tool."
    )
    confidence_score: Optional[float] = Field(
        default=None,
        description="Agent confidence in this action plan, 0.0–1.0. Higher = more certain.",
    )
    display_summary: str = Field(
        description="One judge-facing sentence describing the planned action.",
    )
    why_brief: str = Field(
        description="≤15 words: why this alternative won vs the other three.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Orchestrator — pipeline log (Step 6)
# ─────────────────────────────────────────────────────────────────────────────

class PipelineStepLog(BaseModel):
    """One step embedded in summary.md by write_summary_tool."""

    step_1_hazard_extraction: dict = Field(default_factory=dict)
    step_2_fleet_scout: dict = Field(default_factory=dict)
    step_3_impact_analysis: dict = Field(default_factory=dict)
    step_4_action_plan: dict = Field(default_factory=dict)
    step_5_crm_update: dict = Field(default_factory=dict)
    step_6_notification: dict = Field(default_factory=dict)


class SessionLogEntry(BaseModel):
    """Full session record embedded in summary.md."""

    session_id: str
    timestamp: str
    status: str = Field(description="'completed' or 'failed_at_<step>'.")
    pipeline: PipelineStepLog


# ─────────────────────────────────────────────────────────────────────────────
# Backward-compatible aliases (older logs / mobile may use these names)
# ─────────────────────────────────────────────────────────────────────────────

DatabaseUpdatePayload = DatabaseSimulationPayload

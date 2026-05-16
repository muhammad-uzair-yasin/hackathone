"""
schemas.py — Pydantic response_format models for all three subagents.

Using response_format on subagents guarantees the parent orchestrator always
receives valid, parseable JSON (not free-form text). This eliminates the most
common multi-agent failure mode: broken JSON between steps.

Each model is also used in the SSE stream so the React Native app can
deserialize events directly.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Subagent 1 — Hazard Extractor output
# ─────────────────────────────────────────────────────────────────────────────

class HazardExtraction(BaseModel):
    """
    Structured output from the hazard-extractor subagent.
    Produced by reading raw unstructured news / weather / traffic text and
    pulling out ONLY actionable logistics hazard data — never a generic summary.
    """

    hazard_detected: bool = Field(
        description="True if any hazard relevant to logistics is found in the text."
    )
    location: str = Field(
        description=(
            "The specific district, area, or route name where the hazard is occurring. "
            "Example: 'District 4', 'Highway 9', 'Port of Karachi'."
        )
    )
    hazard_type: str = Field(
        description=(
            "Category of hazard. One of: 'Heatwave', 'Traffic Blockage', "
            "'Flooding', 'Storm', 'Road Closure', 'Fuel Price Spike', 'Port Strike', "
            "'Earthquake', 'Wildfire', 'Unknown'."
        )
    )
    severity_level: str = Field(
        description=(
            "Operational severity: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'."
        )
    )
    affected_routes: List[str] = Field(
        default_factory=list,
        description="List of route names or highway numbers directly affected."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Subagent 2 — Impact Analyzer output
# ─────────────────────────────────────────────────────────────────────────────

class ImpactAnalysis(BaseModel):
    """
    Structured output from the impact-analyzer subagent.
    Connects the extracted hazard to a specific active shipment and calculates
    the real-world operational and financial consequence.
    """

    impact_detected: bool = Field(
        description="True if at least one active shipment is at risk from the hazard."
    )
    affected_shipment_id: Optional[str] = Field(
        default=None,
        description="The ID of the shipment at highest risk. E.g. 'SHP-882'. Null if none."
    )
    backup_facility: Optional[str] = Field(
        default=None,
        description="The backup cold-storage facility. E.g. 'District 3 Cold-Vault'. Null if none."
    )
    backup_route: Optional[str] = Field(
        default=None,
        description="The backup route. E.g. 'Route 7'. Null if none."
    )
    operational_impact: str = Field(
        description=(
            "Brief summary of operational consequence. E.g. "
            "'Truck stuck on Highway 9 — cooling unit will fail in 45 minutes.'"
        )
    )
    risk_level: str = Field(
        description="Risk level: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'."
    )
    requires_immediate_action: bool = Field(
        description="True if action must be taken within the next 30 minutes to prevent loss."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Subagent 3 — Action Planner output
# ─────────────────────────────────────────────────────────────────────────────

class DatabaseUpdatePayload(BaseModel):
    """The exact fields to update in active_shipments.json."""
    shipment_id: str
    new_status: str = Field(description="E.g. 'Emergency Reroute'")
    new_destination: str = Field(description="E.g. 'District 3 Cold-Vault'")
    new_route: str = Field(description="E.g. 'Route 7 (via District 3)'")


class ActionPlan(BaseModel):
    """
    Structured output from the action-planner subagent.
    Produces the exact payloads needed for the orchestrator to execute
    the CRM update and notification simulation — the CRITICAL REQUIREMENT.
    """

    recommended_action: str = Field(
        description=(
            "Clear, domain-relevant action statement. "
            "E.g. 'Immediately reroute SHP-882 to District 3 Cold-Vault to prevent insulin spoilage.'"
        )
    )
    urgency: str = Field(
        description="One of: 'IMMEDIATE' (act now), 'SOON' (within 1 hour), 'MONITOR' (watch and wait)."
    )
    database_update_payload: DatabaseUpdatePayload = Field(
        description="Exact fields to update in the CRM / active_shipments.json."
    )
    notification_recipient: str = Field(
        description="Who to notify. E.g. 'District 4 General Hospital Administration'."
    )
    notification_draft: str = Field(
        description="Full professional notification message string."
    )

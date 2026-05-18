"""
agent.py — Main Deep Agent definition using LangChain Deep Agents SDK.
"""

from __future__ import annotations

from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware

from langchain_agent.schemas import (
    ActionPlan,
    FleetScoutOutput,
    HazardExtraction,
    ImpactAnalysis,
)
from langchain_agent.tools import (
    match_fleet_to_alert,
    notify_tool,
    update_crm_tool,
    write_summary_tool,
)
from .llm import claude_fast

DATA_DIR = Path(__file__).parent / "data"

# ─── Subagent System Prompts ─────────────────────────────────────────────────

EXTRACTOR_PROMPT = """\
You are the Hazard Extractor for BioRoute Cold-Chain Logistics.

## Your job
Read ONLY the raw alert text in the task message. Extract measurable facts.

## OUTPUT — HazardExtraction JSON
- display_summary: one sentence (max 120 chars) — what happened
- why_brief: ≤15 words — why logistics teams should care
- hazard_detected, location, affected_districts, hazard_type, severity_level
- severity_details, affected_routes, temperature_celsius, estimated_duration_minutes

## Rules
- Facts only. Do NOT read files.
- Use Pakistan routes: N-5, M-3, M-9, Murree Rd, Karachi, Hyderabad, Jamshoro, etc.
- Never use "District 4", "Highway 9", or "Route 7".
- Output ONLY valid JSON.
"""

FLEET_SCOUT_PROMPT = """\
You are the Fleet Scout for BioRoute Cold-Chain Logistics.

## Your job
Read /data/active_shipments.json. List every active shipment on the road.

## INPUT
- Raw news/alert text in the task message (read for context only — do NOT extract hazard fields)

## OUTPUT — FleetScoutOutput JSON
- total_active: count of shipments
- active_shipments: for each — shipment_id, route_name, cargo_type, eta_minutes, destination (last route stop)
- display_summary: e.g. "4 trucks active: SHP-882 on N-5, SHP-901 on M-3, …"
- why_brief: ≤15 words — e.g. "Must know who is moving before matching routes"

## Rules
- Read the CRM file once. Copy route_name and destinations exactly.
- Do NOT decide who is affected — that is the next agent.
- Output ONLY valid JSON.
"""

ANALYZER_PROMPT = """\
You are the Route Impact Analyzer for BioRoute Cold-Chain Logistics.

## Your job
Read the rough news alert yourself. Decide which shipment(s) are affected and why.

## INPUT (in task message)
- RAW ALERT: full unstructured news text — YOU infer routes, temperature, delays from this
- Optional FLEET LIST: summary from fleet-scout (shipment IDs and routes)
- Read /data/active_shipments.json for cargo thresholds and alternative_routes (4 per shipment)

## Do NOT use
- Any pre-parsed "hazard JSON" or hazard-extractor output — think from the news directly

## OUTPUT — ImpactAnalysis JSON
- impact_detected, affected_shipment_id, matched_shipment_ids, unaffected_shipment_ids
- cargo_type, cargo_value_usd, criticality_tier, primary_route, destination
- alternative_routes: copy all four {id, name, eta_minutes, notes} for affected shipment
- backup_route / backup_facility: best candidate alternative name + last stop
- time_to_failure_minutes, financial_consequence, medical_consequence, risk_level
- requires_immediate_action, action_reason
- display_summary: one sentence — ID, risk, time, money
- why_brief: ≤15 words — e.g. "On blocked N-5; heat exceeds insulin limit"

## Matching
From the news, infer blocked routes and places. Match against shipment route_name, route stops, and alternatives.

## Examples (demo fleet)
- N-5 flood/block at Gharo/Hyderabad + SHP-882 on "N-5 Karachi → Jamshoro" → impact_detected TRUE
- M-3 issues only → SHP-901 may match; SHP-882 on N-5 is NOT affected
- Murree Rd storm → SHP-915 matches; Karachi N-5 shipments do not

## Rules
- Name unaffected shipments in unaffected_shipment_ids.
- Pick highest-risk shipment as affected_shipment_id.
- If insulin/plasma is on a blocked N-5 corridor, impact_detected MUST be true.
- Output ONLY valid JSON.
"""

ACTION_PLANNER_PROMPT = """\
You are the Action Planner for BioRoute Cold-Chain Logistics.

## Your job
Read the rough news alert yourself. Pick the BEST of four alternative_routes for the affected shipment.

## INPUT (in task message)
- RAW ALERT: full unstructured news text — YOU infer what is blocked and urgency
- IMPACT: ImpactAnalysis JSON from route impact agent (shipment id, alternatives, risk)
- Read /data/active_shipments.json if you need exact alternative route names

## Do NOT use
- Pre-parsed hazard JSON from hazard-extractor — reason from the news + impact only

## OUTPUT — ActionPlan JSON
- selected_route_name, selected_alternative_id, selection_rationale (2–3 sentences for summary.md)
- why_brief: ≤15 words — why A1 beat A2/A3/A4
- display_summary: one sentence — action taken
- database_simulation_payload: new_route (exact name), new_destination (last stop), new_status
- notification_simulation, urgency, action_type

## Rules
- Reject alternatives that still use the blocked corridor.
- Prefer cold-vault handoff for temperature-critical cargo in heat.
- Output ONLY valid JSON.
"""

SUBAGENTS = [
    {
        "name": "hazard-extractor",
        "description": (
            "Step 1 — Reads raw news/alert text only. "
            "Returns HazardExtraction (what happened + why_brief)."
        ),
        "model": claude_fast,
        "system_prompt": EXTRACTOR_PROMPT,
        "tools": [],
        "response_format": HazardExtraction,
    },
    {
        "name": "fleet-scout",
        "description": (
            "Step 2 — Reads active_shipments.json. "
            "Returns FleetScoutOutput (who is on the road)."
        ),
        "model": claude_fast,
        "system_prompt": FLEET_SCOUT_PROMPT,
        "tools": [],
        "response_format": FleetScoutOutput,
    },
    {
        "name": "impact-analyzer",
        "description": (
            "Step 3 — Reads raw news + CRM; decides who is hit. "
            "Returns ImpactAnalysis (who is hit + why_brief)."
        ),
        "model": claude_fast,
        "system_prompt": ANALYZER_PROMPT,
        "tools": [],
        "response_format": ImpactAnalysis,
    },
    {
        "name": "action-planner",
        "description": (
            "Step 4 — Picks best of 4 alternative routes. "
            "Returns ActionPlan with CRM payload."
        ),
        "model": claude_fast,
        "system_prompt": ACTION_PLANNER_PROMPT,
        "tools": [],
        "response_format": ActionPlan,
    },
]

ORCHESTRATOR_SYSTEM_PROMPT = """\
You are the BioRoute Emergency Orchestrator. You coordinate real specialist agents — never skip steps.

## Coordinator voice (you only)
- Speak in short plain sentences (≤20 words). No markdown, no bold, no tables.
- Maximum 5 coordinator messages for the whole run.
- After each subagent: say what you learned in your own words, then what you call next.
- Do NOT copy display_summary or why_brief from subagents verbatim.
- Say "received the alert" at most once.

## Critical — what to pass into each task()
Always keep the user's FULL RAW ALERT TEXT (the original news message).
- NEVER paste hazard-extractor JSON into fleet-scout, impact-analyzer, or action-planner.
- Those agents must read and think from the rough news themselves.

## Mandatory workflow (in order)
1. write_todos — list steps you will actually run
2. task('hazard-extractor', paste FULL raw alert text only)
3. If hazard_detected: task('fleet-scout', paste FULL raw alert text only)
4. If hazard_detected: task('impact-analyzer', paste FULL raw alert text, then fleet-scout JSON — no hazard JSON)
4b. REQUIRED: match_fleet_to_alert(FULL raw alert text) — authoritative impact_detected
5. If match_fleet_to_alert OR impact-analyzer shows impact_detected (use match_fleet when they disagree):
   task('action-planner', paste FULL raw alert + best impact JSON — no hazard JSON)
6. If action urgency IMMEDIATE or SOON: update_crm_tool (updates route in fleet DB) then notify_tool
7. write_summary_tool last — short plain-English summary (3–6 sentences) for summary.md:
   what the alert said, what you found, what action you took (or all clear).
   Pass hazard_data, fleet_data, impact_data, action_data, crm_update_result, notification_result as JSON strings.

## If no hazard or no impact
- Skip later agents. One coordinator line: all clear. Still call write_summary_tool with an all-clear summary.

Session ID: REQ-HHMMSS (from current time).
"""

backend = CompositeBackend(
    default=StateBackend(),
    routes={
        "/data/": FilesystemBackend(
            root_dir=str(DATA_DIR),
            virtual_mode=True,
        ),
    },
)

MIDDLEWARE = [
    ModelRetryMiddleware(
        max_retries=3,
        initial_delay=2.0,
        backoff_factor=2.0,
        max_delay=30.0,
    ),
    ToolRetryMiddleware(
        max_retries=3,
        initial_delay=1.0,
        backoff_factor=2.0,
        max_delay=30.0,
        jitter=True,
        on_failure="return_message",
    ),
]


def build_agent():
    return create_deep_agent(
        model=claude_fast,
        name="bioroute-orchestrator",
        tools=[match_fleet_to_alert, update_crm_tool, notify_tool, write_summary_tool],
        subagents=SUBAGENTS,
        system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        middleware=MIDDLEWARE,
        backend=backend,
    )


_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent

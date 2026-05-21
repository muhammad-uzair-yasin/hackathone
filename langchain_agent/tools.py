"""
tools.py — Custom tools given to the Main Orchestrator.

These are the ONLY tools the orchestrator calls directly.
Subagents use read_file (built-in) to load context; the orchestrator
uses these tools to EXECUTE the final action simulation.

Design rules (from docs):
  - Tools must have clear docstrings — the LLM reads them to decide when to call.
  - Return strings only (not dicts) — the framework wraps them in ToolMessage.
  - Keep them focused: one tool = one responsibility.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from langchain.tools import tool

# Absolute path to the data directory — safe to use from any working directory
DATA_DIR = Path(__file__).parent / "data"
SHIPMENTS_FILE = DATA_DIR / "active_shipments.json"
BASELINE_SHIPMENTS_FILE = DATA_DIR / "active_shipments_baseline.json"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
SUMMARY_FILE = DATA_DIR / "summary.md"
HISTORY_FILE = DATA_DIR / "history.json"


def append_history(event_type: str, payload: dict) -> None:
    """Append one entry to history.json for the incident log."""
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event_type,
        **{k: v for k, v in payload.items() if k not in ("before_state", "after_state")},
    }
    # Keep before/after compact summaries
    if "before_state" in payload:
        record["before_status"] = (payload["before_state"] or {}).get("current_status", "")
        record["before_route"] = (payload["before_state"] or {}).get("route_name", "")
    if "after_state" in payload:
        record["after_status"] = (payload["after_state"] or {}).get("current_status", "")
        record["after_route"] = (payload["after_state"] or {}).get("route_name", "")

    existing: dict = {"history": []}
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE) as f:
                existing = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    existing.setdefault("history", []).append(record)
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(existing, f, indent=2)
    except OSError:
        pass


def _route_points(shipment: dict, *, alternative_name: str | None = None) -> list:
    if alternative_name:
        alt = _find_alternative(shipment, alternative_name)
        if alt:
            return list(alt.get("stops") or [])
    return list(shipment.get("route") or [])


def _find_alternative(shipment: dict, route_name: str) -> dict | None:
    """Match alternative by exact name or id (e.g. A1)."""
    if not route_name:
        return None
    for alt in shipment.get("alternative_routes") or []:
        if alt.get("name") == route_name or alt.get("id") == route_name:
            return alt
    # Legacy single backup
    if shipment.get("backup_route_name") == route_name:
        return {
            "name": shipment["backup_route_name"],
            "stops": shipment.get("backup_route") or [],
        }
    return None


def _route_destination(shipment: dict, *, alternative_name: str | None = None) -> str | None:
    points = _route_points(shipment, alternative_name=alternative_name)
    if not points:
        return None
    last = points[-1]
    return last.get("place") if isinstance(last, dict) else str(last)


def _shipment_route_snapshot(shipment: dict) -> dict:
    """Fields needed for UI before/after route comparison."""
    route = [dict(p) for p in _route_points(shipment)]
    return {
        "shipment_id": shipment["shipment_id"],
        "current_status": shipment.get("current_status"),
        "route_name": shipment.get("route_name"),
        "route": route,
        "destination": _route_destination(shipment),
    }


def _apply_alternative_route(record: dict, route_name: str) -> bool:
    """Swap active route to the chosen entry in alternative_routes."""
    alt = _find_alternative(record, route_name)
    if not alt:
        return False
    stops = alt.get("stops") or []
    if not stops:
        return False
    record["route"] = [dict(p) for p in stops]
    record["route_name"] = alt.get("name") or route_name
    if alt.get("eta_minutes") is not None:
        record["eta_minutes"] = alt["eta_minutes"]
    return True


def _is_emergency_reroute_status(status: str) -> bool:
    return "reroute" in (status or "").lower()


def reset_active_shipments_to_baseline() -> bool:
    """Restore CRM mock DB to demo baseline (Pakistani routes)."""
    if not BASELINE_SHIPMENTS_FILE.exists():
        return False
    with open(BASELINE_SHIPMENTS_FILE, "r") as f:
        data = json.load(f)
    data["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(SHIPMENTS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    clear_summary_file()
    return True


def reset_demo_session() -> dict:
    """
    Full demo reset for re-testing: CRM shipments, notifications, decision log, predictions.
    """
    shipments_ok = reset_active_shipments_to_baseline()
    notifications_ok = False
    predictions_ok = False
    try:
        NOTIFICATIONS_FILE.write_text(
            json.dumps({"notifications": []}, indent=2) + "\n",
            encoding="utf-8",
        )
        notifications_ok = True
    except OSError:
        pass
    try:
        from langchain_agent.prediction_agent import PREDICTIONS_FILE, DATA_DIR
        PREDICTIONS_FILE.write_text(json.dumps({"predictions": [], "run_count": 0}, indent=2), encoding="utf-8")
        history_file = DATA_DIR / "prediction_history.json"
        if history_file.exists():
            history_file.write_text("[]", encoding="utf-8")
        predictions_ok = True
    except Exception:
        pass
    return {
        "ok": shipments_ok and notifications_ok,
        "shipments_reset": shipments_ok,
        "notifications_cleared": notifications_ok,
        "predictions_cleared": predictions_ok,
        "summary_cleared": True,
        "message": "Demo reset — CRM, notifications, predictions, and summary restored.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool 1 — CRM Update (The Critical Action Simulation)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def update_crm_tool(
    shipment_id: str,
    new_status: str,
    new_destination: str,
    new_route: str,
) -> str:
    """
    CRITICAL ACTION SIMULATION: Updates a shipment record in the live CRM database
    (active_shipments.json) to reflect an emergency reroute decision.

    This tool performs the actual system state change — it modifies the database
    record and returns a detailed before/after comparison to prove the action
    was executed. Always call this tool after the Action Planner subagent
    has confirmed a reroute is required.

    Args:
        shipment_id: The exact shipment ID to update. E.g. 'SHP-882'.
        new_status: The new operational status. Use 'Emergency Reroute' for reroutes.
        new_destination: The new destination address / facility name.
        new_route: Must exactly match one alternative_routes[].name from the shipment file
            (action-planner picks the best of four alternatives).

    On Emergency Reroute, the tool swaps route[] to the chosen alternative's stops[].

    Returns:
        A JSON string containing before_state and after_state (route arrays), and timestamp.
        Returns an error string if the shipment_id is not found.
    """
    # ── Load the database ────────────────────────────────────────────────────
    if not SHIPMENTS_FILE.exists():
        return f"ERROR: Database file not found at {SHIPMENTS_FILE}. Cannot update CRM."

    with open(SHIPMENTS_FILE, "r") as f:
        data = json.load(f)

    # ── Find the shipment ────────────────────────────────────────────────────
    target = None
    target_index = -1
    for i, shipment in enumerate(data["active_shipments"]):
        if shipment["shipment_id"] == shipment_id:
            target = shipment
            target_index = i
            break

    if target is None:
        available_ids = [s["shipment_id"] for s in data["active_shipments"]]
        return (
            f"ERROR: Shipment '{shipment_id}' not found in database. "
            f"Available IDs: {available_ids}"
        )

    record = data["active_shipments"][target_index]
    before_state = _shipment_route_snapshot(record)

    # ── Apply update ─────────────────────────────────────────────────────────
    record["current_status"] = new_status
    if _is_emergency_reroute_status(new_status):
        if not _apply_alternative_route(record, new_route):
            return (
                f"ERROR: new_route '{new_route}' not found in alternative_routes for {shipment_id}. "
                f"Available: {[a.get('name') for a in record.get('alternative_routes', [])]}"
            )
    else:
        record["route_name"] = new_route

    data["last_updated"] = datetime.now(timezone.utc).isoformat()

    with open(SHIPMENTS_FILE, "w") as f:
        json.dump(data, f, indent=2)

    after_state = _shipment_route_snapshot(record)

    result = {
        "success": True,
        "update_timestamp": datetime.now(timezone.utc).isoformat(),
        "before_state": before_state,
        "after_state": after_state,
        "message": (
            f"SUCCESS: Shipment {shipment_id} updated. "
            f"Status: '{before_state['current_status']}' → '{new_status}'. "
            f"Route: '{before_state.get('route_name')}' → '{record.get('route_name')}'."
        ),
    }
    append_history("update_crm", result)

    return json.dumps(result, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# Tool 2 — Notification Sender (Action Simulation #2)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def notify_tool(
    recipient: str,
    shipment_id: str,
    notification_message: str,
    urgency_level: str,
    driver_message: str = "",
    coordinator_message: str = "",
    owner_message: str = "",
) -> str:
    """
    NOTIFICATION SIMULATION: Writes 4 email-style notifications to notifications.json —
    one each for the hospital, driver, fleet coordinator, and company owner.

    Always call this AFTER update_crm_tool.

    Args:
        recipient: Hospital/clinic name.
        shipment_id: Shipment ID.
        notification_message: Full email body for the hospital (subject + body).
        urgency_level: 'IMMEDIATE', 'HIGH', 'MEDIUM', or 'LOW'.
        driver_message: SMS/radio message for the driver with new route instructions.
        coordinator_message: Operational email for the fleet coordinator.
        owner_message: Executive summary email for the company owner.

    Returns:
        JSON string with notification IDs and delivery confirmation.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    ts_short = datetime.now().strftime('%H%M%S')

    records = [
        {
            "notification_id": f"NOTIF-{shipment_id}-HOSP-{ts_short}",
            "timestamp": timestamp,
            "shipment_id": shipment_id,
            "recipient_type": "hospital",
            "recipient": recipient,
            "urgency_level": urgency_level,
            "status": "SENT (simulated)",
            "channels": ["email"],
            "subject": f"[URGENT] Shipment {shipment_id} — Route Change & Updated Delivery Time",
            "message": notification_message,
        },
        {
            "notification_id": f"NOTIF-{shipment_id}-DRVR-{ts_short}",
            "timestamp": timestamp,
            "shipment_id": shipment_id,
            "recipient_type": "driver",
            "recipient": f"Driver — Truck {shipment_id}",
            "urgency_level": urgency_level,
            "status": "SENT (simulated)",
            "channels": ["sms", "radio"],
            "subject": f"ACTION REQUIRED: New Route for {shipment_id}",
            "message": driver_message or f"ROUTE CHANGE for {shipment_id}. Do NOT continue on current road. Follow new route instructions from your GPS. Cargo is time-sensitive. Confirm receipt immediately.",
        },
        {
            "notification_id": f"NOTIF-{shipment_id}-COORD-{ts_short}",
            "timestamp": timestamp,
            "shipment_id": shipment_id,
            "recipient_type": "coordinator",
            "recipient": "Fleet Operations Coordinator",
            "urgency_level": urgency_level,
            "status": "SENT (simulated)",
            "channels": ["email", "dashboard"],
            "subject": f"[Fleet Alert] Emergency Reroute Executed — {shipment_id}",
            "message": coordinator_message or notification_message[:400],
        },
        {
            "notification_id": f"NOTIF-{shipment_id}-OWNR-{ts_short}",
            "timestamp": timestamp,
            "shipment_id": shipment_id,
            "recipient_type": "owner",
            "recipient": "Company Owner / CEO",
            "urgency_level": urgency_level,
            "status": "SENT (simulated)",
            "channels": ["email"],
            "subject": f"[Executive Alert] Shipment {shipment_id} Rerouted — AI Action Taken",
            "message": owner_message or (
                f"Dear Owner,\n\n"
                f"This is an automated alert from your BioRoute AI system.\n\n"
                f"One of your shipments ({shipment_id}) encountered an emergency on the road "
                f"and our AI agent has automatically rerouted it to protect the cargo and ensure "
                f"on-time delivery.\n\n"
                f"The situation has been handled. The hospital has been notified, the driver has "
                f"new instructions, and your fleet coordinator is monitoring the situation.\n\n"
                f"No action is required from you at this time. You will receive a delivery "
                f"confirmation once the shipment arrives safely.\n\n"
                f"Urgency Level: {urgency_level}\n\n"
                f"Best regards,\nBioRoute AI Operations System"
            ),
        },
    ]

    existing = {"notifications": []}
    if NOTIFICATIONS_FILE.exists():
        try:
            with open(NOTIFICATIONS_FILE, "r") as f:
                existing = json.load(f)
        except json.JSONDecodeError:
            pass

    existing.setdefault("notifications", []).extend(records)
    with open(NOTIFICATIONS_FILE, "w") as f:
        json.dump(existing, f, indent=2)

    mobile_notification = (
        f"🚨 BioRoute Alert — {shipment_id}\n"
        f"Urgency: {urgency_level}\n"
        f"Hospital: {recipient}\n"
        f"Instructions: {driver_message[:60] if driver_message else 'Route change instructions sent.'}..."
    )

    ids = [r["notification_id"] for r in records]
    return json.dumps({
        "success": True,
        "notifications_sent": len(records),
        "notification_ids": ids,
        "notification_id": ids[0],  # backward compat
        "shipment_id": shipment_id,
        "mobile_notification": mobile_notification,
        "timestamp": timestamp,
        "recipient": recipient,
        "recipients": ["hospital", "driver", "coordinator", "owner"],
        "channels_used": ["email", "sms", "radio", "dashboard"],
        "message": f"4 notifications sent for {shipment_id} — hospital, driver, coordinator, owner.",
    }, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# Tool 3 — Write run summary (summary.md)
# ─────────────────────────────────────────────────────────────────────────────

def _safe_parse_json(s: str) -> dict:
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return {"raw": str(s)}


def _format_summary_markdown(
    session_id: str,
    status: str,
    timestamp: str,
    summary_markdown: str,
    pipeline: dict,
) -> str:
    """Short human-readable summary.md (detailed pipeline kept in HTML comment for API)."""
    sections = [
        "# BioRoute Run Summary",
        "",
        f"_Session {session_id} · {status} · {timestamp}_",
        "",
        summary_markdown.strip() or "_No summary provided._",
        "",
        "<!--BIOROUTE_PIPELINE",
        json.dumps(
            {
                "session_id": session_id,
                "timestamp": timestamp,
                "status": status,
                "pipeline": pipeline,
            },
            indent=2,
        ),
        "-->",
    ]
    return "\n".join(sections)


def clear_summary_file() -> None:
    """Reset summary.md before a new agent run."""
    SUMMARY_FILE.write_text(
        "# BioRoute Run Summary\n\n"
        "_Waiting for agent run…_\n",
        encoding="utf-8",
    )


def read_summary_session_record() -> dict:
    """Load session metadata + pipeline from summary.md."""
    if not SUMMARY_FILE.exists():
        return {}
    text = SUMMARY_FILE.read_text(encoding="utf-8")
    start = text.find("<!--BIOROUTE_PIPELINE")
    end = text.find("-->", start)
    if start < 0 or end < 0:
        return {}
    blob = text[start + len("<!--BIOROUTE_PIPELINE") : end].strip()
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        return {}


def read_summary_public_markdown() -> str:
    """Human-visible markdown only (no pipeline blob)."""
    if not SUMMARY_FILE.exists():
        return ""
    raw = SUMMARY_FILE.read_text(encoding="utf-8")
    cut = raw.find("<!--BIOROUTE_PIPELINE")
    return (raw[:cut] if cut > 0 else raw).strip()


@tool
def write_summary_tool(
    session_id: str,
    status: str,
    summary_markdown: str,
    hazard_data: str,
    fleet_data: str = "{}",
    impact_data: str = "{}",
    action_data: str = "{}",
    crm_update_result: str = "{}",
    notification_result: str = "{}",
) -> str:
    """
    Write a SHORT plain-language summary to summary.md. Call LAST after all other steps.

    Args:
        session_id: Unique run id, e.g. 'REQ-143052'.
        status: 'completed' or 'failed_at_<step>'.
        summary_markdown: 3–6 sentences in simple English for a human reader:
            what the alert said, what you found (hazard/fleet/impact), what action you took
            (reroute, CRM, hospital alert) or why no action was needed.
        hazard_data: JSON string from hazard-extractor.
        fleet_data: JSON string from fleet-scout (or '{}' if skipped).
        impact_data: JSON string from impact-analyzer.
        action_data: JSON string from action-planner (or '{}' if skipped).
        crm_update_result: JSON string from update_crm_tool (or '{}' if skipped).
        notification_result: JSON string from notify_tool (or '{}' if skipped).

    Returns:
        JSON confirmation with file path and byte size.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    pipeline = {
        "step_1_hazard_extraction": _safe_parse_json(hazard_data),
        "step_2_fleet_scout": _safe_parse_json(fleet_data),
        "step_3_impact_analysis": _safe_parse_json(impact_data),
        "step_4_action_plan": _safe_parse_json(action_data),
        "step_5_crm_update": _safe_parse_json(crm_update_result),
        "step_6_notification": _safe_parse_json(notification_result),
    }
    body = _format_summary_markdown(
        session_id, status, timestamp, summary_markdown, pipeline
    )
    SUMMARY_FILE.write_text(body, encoding="utf-8")
    result = {
        "success": True,
        "session_id": session_id,
        "status": status,
        "file": SUMMARY_FILE.name,
        "bytes": len(body.encode("utf-8")),
        "message": f"Run summary written to {SUMMARY_FILE.name}",
    }
    return json.dumps(result, indent=2)



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
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
STATE_LOG_FILE = DATA_DIR / "state_log.json"


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
        new_route: The new route the driver should take. E.g. 'Route 7 (via District 3)'.

    Returns:
        A JSON string containing the before_state, after_state, and update timestamp.
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

    # ── Capture before state ─────────────────────────────────────────────────
    before_state = {
        "shipment_id": target["shipment_id"],
        "current_status": target["current_status"],
        "destination": target["destination"],
        "primary_route": target["primary_route"],
    }

    # ── Apply update ─────────────────────────────────────────────────────────
    data["active_shipments"][target_index]["current_status"] = new_status
    data["active_shipments"][target_index]["destination"] = new_destination
    data["active_shipments"][target_index]["primary_route"] = new_route
    data["last_updated"] = datetime.now(timezone.utc).isoformat()

    # ── Save to disk ─────────────────────────────────────────────────────────
    with open(SHIPMENTS_FILE, "w") as f:
        json.dump(data, f, indent=2)

    # ── Capture after state ──────────────────────────────────────────────────
    after_state = {
        "shipment_id": shipment_id,
        "current_status": new_status,
        "destination": new_destination,
        "primary_route": new_route,
    }

    result = {
        "success": True,
        "update_timestamp": datetime.now(timezone.utc).isoformat(),
        "before_state": before_state,
        "after_state": after_state,
        "message": (
            f"SUCCESS: Shipment {shipment_id} updated. "
            f"Status: '{before_state['current_status']}' → '{new_status}'. "
            f"Route: '{before_state['primary_route']}' → '{new_route}'."
        ),
    }

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
) -> str:
    """
    NOTIFICATION SIMULATION: Generates and logs an automated emergency notification
    to the destination hospital, driver, and dispatch control center.

    In a production system this would send a real email/SMS. For the simulation,
    it writes the notification to notifications.json and returns a confirmation
    with a generated message ID.

    Always call this tool AFTER update_crm_tool has successfully updated the database.

    Args:
        recipient: Who to notify. E.g. 'District 4 General Hospital Administration'.
        shipment_id: The shipment ID this notification relates to.
        notification_message: The full notification text to send. Should be professional
            and include: cargo type, reason for reroute, new destination, and ETA.
        urgency_level: One of 'IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW'.

    Returns:
        A JSON string with the notification ID, timestamp, and delivery confirmation.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    notification_id = f"NOTIF-{shipment_id}-{datetime.now().strftime('%H%M%S')}"

    notification_record = {
        "notification_id": notification_id,
        "timestamp": timestamp,
        "shipment_id": shipment_id,
        "recipient": recipient,
        "urgency_level": urgency_level,
        "status": "SENT (simulated)",
        "channels": ["email", "sms"],
        "message": notification_message,
    }

    # ── Load existing notifications (or start fresh) ─────────────────────────
    existing = {"notifications": []}
    if NOTIFICATIONS_FILE.exists():
        try:
            with open(NOTIFICATIONS_FILE, "r") as f:
                existing = json.load(f)
        except json.JSONDecodeError:
            pass  # start fresh if file is corrupt

    # ── Append and save ──────────────────────────────────────────────────────
    existing["notifications"].append(notification_record)
    with open(NOTIFICATIONS_FILE, "w") as f:
        json.dump(existing, f, indent=2)

    result = {
        "success": True,
        "notification_id": notification_id,
        "timestamp": timestamp,
        "recipient": recipient,
        "channels_used": ["email", "sms"],
        "message": (
            f"NOTIFICATION SENT (simulated) to '{recipient}' | "
            f"ID: {notification_id} | Urgency: {urgency_level}"
        ),
    }

    return json.dumps(result, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# Tool 3 — Write State Log (Agent Trace)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def write_state_log_tool(
    session_id: str,
    status: str,
    hazard_data: str,
    impact_data: str,
    action_data: str,
    crm_update_result: str,
    notification_result: str,
) -> str:
    """
    Writes the complete agent trace log to state_log.json.

    This is the final step in every workflow. It records the full pipeline
    result so the React Native app can display the agent trace, the before/after
    state, and the reasoning chain.

    Call this tool LAST, after both update_crm_tool and notify_tool have completed.

    Args:
        session_id: A unique identifier for this run. E.g. 'REQ-1092'.
        status: Final status of the pipeline. Use 'completed' on success or
            'failed_at_<step>' if a step failed.
        hazard_data: JSON string from the hazard-extractor subagent result.
        impact_data: JSON string from the impact-analyzer subagent result.
        action_data: JSON string from the action-planner subagent result.
        crm_update_result: JSON string returned by update_crm_tool.
        notification_result: JSON string returned by notify_tool.

    Returns:
        Confirmation string with the log file path and record count.
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    # Parse each JSON string safely
    def safe_parse(s: str) -> dict:
        try:
            return json.loads(s)
        except (json.JSONDecodeError, TypeError):
            return {"raw": str(s)}

    log_record = {
        "session_id": session_id,
        "timestamp": timestamp,
        "status": status,
        "pipeline": {
            "step_1_hazard_extraction": safe_parse(hazard_data),
            "step_2_impact_analysis": safe_parse(impact_data),
            "step_3_action_plan": safe_parse(action_data),
            "step_4_crm_update": safe_parse(crm_update_result),
            "step_5_notification": safe_parse(notification_result),
        },
    }

    # ── Load existing log or start fresh ─────────────────────────────────────
    existing = {"logs": []}
    if STATE_LOG_FILE.exists():
        try:
            with open(STATE_LOG_FILE, "r") as f:
                existing = json.load(f)
        except json.JSONDecodeError:
            pass

    existing["logs"].append(log_record)

    with open(STATE_LOG_FILE, "w") as f:
        json.dump(existing, f, indent=2)

    total_logs = len(existing["logs"])
    return (
        f"STATE LOG WRITTEN: Session '{session_id}' | Status: '{status}' | "
        f"Log file: {STATE_LOG_FILE} | Total records: {total_logs}"
    )

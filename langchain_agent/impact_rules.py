"""
Deterministic route-impact matching for demo reliability.
Used by match_fleet_to_alert tool so N-5 / M-3 / Murree alerts flag the right shipments.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from langchain_agent.tools import SHIPMENTS_FILE

# Corridor tokens in alerts → substrings that must appear in shipment route_name
CORRIDOR_ROUTE_MARKERS: dict[str, tuple[str, ...]] = {
    "n-5": ("n-5", "n5", "national highway 5", "karachi", "hyderabad", "jamshoro", "gharo", "malir", "thatta"),
    "m-3": ("m-3", "m3", "lahore", "faisalabad", "sheikhupura"),
    "m-9": ("m-9", "m9", "thatta bypass"),
    "murree": ("murree", "rawalpindi", "islamabad", "faizabad"),
}

HAZARD_WORDS = (
    "block", "blocked", "closure", "closed", "flood", "submerged", "stuck",
    "impassable", "jam", "accident", "collision", "avoid", "do not cross",
    "shutdown", "gridlock", "stranded",
)

PLACE_KEYWORDS = (
    "gharo", "hyderabad", "jamshoro", "karachi", "malir", "thatta",
    "lahore", "faisalabad", "sheikhupura", "multan", "bahawalpur",
    "rawalpindi", "islamabad", "murree", "faizabad",
)


def _load_shipments() -> list[dict[str, Any]]:
    path = SHIPMENTS_FILE
    if not path.exists():
        baseline = Path(__file__).parent / "data" / "active_shipments_baseline.json"
        path = baseline
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return list(data.get("active_shipments") or [])


def _alert_has_hazard(alert: str) -> bool:
    a = alert.lower()
    return any(w in a for w in HAZARD_WORDS)


def _blocked_corridors(alert: str) -> set[str]:
    if not _alert_has_hazard(alert):
        return set()
    a = alert.lower()
    blocked: set[str] = set()
    for corridor, markers in CORRIDOR_ROUTE_MARKERS.items():
        if any(m in a for m in markers[:3]):  # primary road names first
            blocked.add(corridor)
        elif corridor == "n-5" and any(m in a for m in ("gharo", "jamshoro", "karachi→jamshoro", "karachi-jamshoro")):
            blocked.add(corridor)
        elif corridor == "murree" and "murree" in a:
            blocked.add(corridor)
    return blocked


def _places_in_alert(alert: str) -> set[str]:
    a = alert.lower()
    return {p for p in PLACE_KEYWORDS if p in a}


def _shipment_place_text(ship: dict[str, Any]) -> str:
    parts = [(ship.get("route_name") or "")]
    for stop in ship.get("route") or []:
        parts.append(stop.get("place") or "")
    return " ".join(parts).lower()


def _shipment_hits_corridor(
    ship: dict[str, Any], corridor: str, alert_places: set[str]
) -> bool:
    rn = (ship.get("route_name") or "").lower()
    on_corridor = False
    if corridor == "n-5" and "n-5" in rn:
        on_corridor = True
    elif corridor == "m-3" and "m-3" in rn:
        on_corridor = True
    elif corridor == "m-9" and "m-9" in rn:
        on_corridor = True
    elif corridor == "murree" and "murree" in rn:
        on_corridor = True
    if not on_corridor:
        markers = CORRIDOR_ROUTE_MARKERS.get(corridor, ())
        text = _shipment_place_text(ship)
        on_corridor = any(m in text for m in markers[:4])

    if not on_corridor:
        return False

    # When the alert names specific cities/checkpoints, require geographic overlap
    if alert_places:
        text = _shipment_place_text(ship)
        return any(p in text for p in alert_places)
    return True


def _criticality(cargo: str) -> str:
    c = cargo.lower()
    if "plasma" in c or "organ" in c:
        return "ULTRA"
    if "insulin" in c or "vaccine" in c:
        return "CRITICAL"
    return "STANDARD"


def _risk_rank(ship: dict[str, Any]) -> int:
    crit = _criticality(str(ship.get("cargo_type", "")))
    value = int(ship.get("cargo_value_usd") or 0)
    ranks = {"ULTRA": 3, "CRITICAL": 2, "STANDARD": 1}
    return ranks.get(crit, 0) * 100_000 + value


def _destination(ship: dict[str, Any]) -> str:
    route = ship.get("route") or []
    if route:
        return str(route[-1].get("place") or "")
    return ""


def analyze_impact_deterministic(alert_text: str) -> dict[str, Any]:
    """Return ImpactAnalysis-shaped dict from alert + active_shipments.json."""
    shipments = _load_shipments()
    all_ids = [s["shipment_id"] for s in shipments]
    blocked = _blocked_corridors(alert_text)

    if not blocked or not shipments:
        return {
            "impact_detected": False,
            "affected_shipment_id": None,
            "matched_shipment_ids": [],
            "unaffected_shipment_ids": all_ids,
            "operational_impact": "No active shipments on corridors mentioned in the alert.",
            "financial_consequence": "No financial exposure",
            "risk_level": "LOW",
            "requires_immediate_action": False,
            "action_reason": "Fleet clear of blocked corridors for this alert.",
            "display_summary": "All clear — no shipments on affected routes.",
            "why_brief": "No corridor overlap with active fleet",
        }

    alert_places = _places_in_alert(alert_text)
    matched: list[dict[str, Any]] = []
    for ship in shipments:
        if any(_shipment_hits_corridor(ship, c, alert_places) for c in blocked):
            matched.append(ship)

    if not matched:
        return {
            "impact_detected": False,
            "affected_shipment_id": None,
            "matched_shipment_ids": [],
            "unaffected_shipment_ids": all_ids,
            "operational_impact": "Hazard reported but no active shipment uses those corridors.",
            "financial_consequence": "No financial exposure",
            "risk_level": "LOW",
            "requires_immediate_action": False,
            "action_reason": "Alert corridors do not match any in-transit route_name.",
            "display_summary": "All clear — fleet not on blocked corridors.",
            "why_brief": "Corridors in alert do not match CRM routes",
        }

    affected = max(matched, key=_risk_rank)
    aid = affected["shipment_id"]
    matched_ids = [s["shipment_id"] for s in matched]
    unaffected = [i for i in all_ids if i not in matched_ids]
    cargo = str(affected.get("cargo_type") or "")
    crit = _criticality(cargo)
    alts = [
        {
            "id": a.get("id", ""),
            "name": a.get("name", ""),
            "eta_minutes": a.get("eta_minutes"),
            "notes": a.get("notes"),
        }
        for a in (affected.get("alternative_routes") or [])
    ]
    best_alt = alts[0] if alts else {}
    temp_match = re.search(r"(\d{2})\s*°?\s*c", alert_text, re.I)
    ambient = float(temp_match.group(1)) if temp_match else None
    ttf = int(affected.get("max_safe_idle_minutes") or 60)
    value = int(affected.get("cargo_value_usd") or 0)
    risk = "CRITICAL" if crit in ("ULTRA", "CRITICAL") else "HIGH"
    immediate = True

    return {
        "impact_detected": True,
        "affected_shipment_id": aid,
        "matched_shipment_ids": matched_ids,
        "unaffected_shipment_ids": unaffected,
        "cargo_type": cargo,
        "cargo_value_usd": value,
        "criticality_tier": crit,
        "primary_route": affected.get("route_name"),
        "destination": _destination(affected),
        "current_status": affected.get("current_status"),
        "alternative_routes": alts,
        "backup_route": best_alt.get("name"),
        "backup_facility": (best_alt.get("name") and _destination(affected)) or None,
        "ambient_temperature_celsius": ambient,
        "operational_impact": (
            f"{aid} on {affected.get('route_name')} — corridor blocked; "
            f"{ttf} min safe idle for {cargo}."
        ),
        "time_to_failure_minutes": ttf,
        "financial_consequence": f"${value:,} cargo spoilage risk",
        "medical_consequence": "Hospital delivery delay if insulin/plasma spoils",
        "risk_level": risk,
        "requires_immediate_action": immediate,
        "action_reason": f"{aid} uses a corridor named in the alert while hazard keywords indicate blockage.",
        "display_summary": (
            f"{aid} ({cargo}) on {affected.get('route_name')} — "
            f"blocked corridor; reroute required."
        ),
        "why_brief": f"On blocked corridor per alert text",
    }

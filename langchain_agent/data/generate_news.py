"""
generate_news.py — Realistic semi-structured news data generator.

Generates a variety of unstructured/semi-structured input scenarios that the
BioRoute agent will process. Each scenario is a different hazard type and
phrasing style (formal news, social media tweet, official advisory, radio report).

Usage:
    uv run langchain_agent/data/generate_news.py

    # Print a single random scenario
    uv run langchain_agent/data/generate_news.py --random

    # Print all scenarios
    uv run langchain_agent/data/generate_news.py --all

    # Save all to file
    uv run langchain_agent/data/generate_news.py --save
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Scenario Library — 10 realistic scenarios in varied formats
# ─────────────────────────────────────────────────────────────────────────────

SCENARIOS = [
    {
        "id": "SCN-001",
        "label": "Heatwave + Traffic Block (Primary Test Scenario)",
        "hazard_type": "Heatwave + Traffic Blockage",
        "affects_shipment": "SHP-882",
        "expected_action": "Emergency Reroute",
        "text": """\
🚨 DISTRICT 4 EMERGENCY ADVISORY — Issued 2:15 PM

WEATHER: Extreme heat warning in effect for District 4 and surrounding areas.
Temperature currently 42°C, forecast to reach 44°C by 3:00 PM. Advisory
in effect until 6:00 PM tonight.

TRAFFIC: Multi-vehicle collision on Highway 9 at Junction 4-B. ALL lanes
blocked. Emergency services on scene. Traffic backed up 4km. Estimated
clearance time: 2-3 hours. Avoid Highway 9 entirely.

Motorists are advised to seek alternate routes via Route 7 or Inner Ring Road.
The District Civil Defense Authority urges all citizens to stay indoors.

— District 4 Emergency Management Office
""",
    },
    {
        "id": "SCN-002",
        "label": "Social Media Style — Flooding Alert",
        "hazard_type": "Flooding",
        "affects_shipment": "SHP-882",
        "expected_action": "Emergency Reroute",
        "text": """\
@District4News: 🌊 FLASH FLOOD WARNING!! Highway 9 completely submerged near
District 4 entry point!! Water level rising fast. 3 trucks already stuck.
Fire department deploying boats. DO NOT attempt to cross!! #District4Flood
#EmergencyAlert

Retweeted by @BioRoute_Dispatch: Driver teams please check alternate routes.
Highway 9 impassable. Use Route 7. Stay safe out there 🙏

Local weather station reading: 38mm rain in last 2 hours. More coming.
Highway 9 expected to remain closed minimum 90 minutes.
""",
    },
    {
        "id": "SCN-003",
        "label": "Formal News Article — Port Strike",
        "hazard_type": "Port Strike",
        "affects_shipment": None,
        "expected_action": "Monitor / No immediate reroute",
        "text": """\
KARACHI BUSINESS DAILY — May 16, 2026

PORT WORKERS STRIKE ENTERS DAY TWO

Dock workers at the Port of Karachi have extended their strike into a second
consecutive day, causing significant delays in cargo processing. An estimated
2,400 containers remain unloaded as negotiations between union representatives
and port management broke down late Thursday evening.

Port authorities confirmed that pharmaceutical cold-chain cargo has been
given priority clearance, with a dedicated processing window from 6-10 AM daily.
However, general cargo shipments face delays of 48-72 hours.

The strike is not expected to affect intra-city road deliveries at this time.
District-level distribution networks remain fully operational.

Officials expect the strike to continue through the weekend.
""",
    },
    {
        "id": "SCN-004",
        "label": "Radio-style broadcast — Storm Warning",
        "hazard_type": "Storm",
        "affects_shipment": "SHP-915",
        "expected_action": "Emergency Reroute",
        "text": """\
...and now for the traffic and weather update. It's 1:45 PM and here's
what you need to know if you're on the roads right now.

Highway 12 heading toward District 7 — AVOID IT. We've got heavy storm
conditions with visibility near zero. Wind gusts reported at 85 km/h.
A refrigerated logistics vehicle flipped over near the District 7 entrance.
Emergency vehicles are responding. Highway 12 is completely shut down,
no ETA on reopening.

The Inner Ring Road is your best bet right now but expect 40-minute
delays due to redirected traffic.

Temperature drops accompanying the storm — currently 29°C and falling fast.
Forecast says it'll drop another 8 degrees by nightfall.

If you're a commercial driver, please contact your dispatch immediately.
This storm is no joke, folks. Stay safe out there. Back to you, Ahmed.
""",
    },
    {
        "id": "SCN-005",
        "label": "Government Advisory — Fuel Price Spike",
        "hazard_type": "Fuel Price Spike",
        "affects_shipment": None,
        "expected_action": "No immediate reroute — cost impact only",
        "text": """\
OFFICIAL NOTIFICATION
Ministry of Energy and Petroleum
Republic Notice — Effective Immediately

PETROLEUM PRICE REVISION — EFFECTIVE 16 MAY 2026, 00:01 HRS

Following the global crude oil market correction, the government has revised
domestic fuel prices as follows:

  • Petrol (RON 92): PKR 320/litre → PKR 367/litre (+14.7%)
  • Diesel: PKR 298/litre → PKR 341/litre (+14.4%)
  • LPG: No change

This revision will remain in effect until the next scheduled review on
June 1, 2026. Logistics operators are advised to review their operational
cost structures accordingly.

Issued by: Ministry of Energy and Petroleum
""",
    },
    {
        "id": "SCN-006",
        "label": "WhatsApp-style informal message — Road Closure",
        "hazard_type": "Road Closure",
        "affects_shipment": "SHP-901",
        "expected_action": "Monitor (temp threshold not exceeded)",
        "text": """\
yaar Route 66 is closed today from 11am to 5pm for VIP visit
police have blocked entire stretch from District 1 junction to Main Boulevard
nobody getting through. tried myself got turned back

traffic is a nightmare. going through old city takes 45 mins extra at least

if anyone is delivering to district 1 today good luck lol

also its hot today maybe 36 degrees? not as bad as yesterday but still
""",
    },
    {
        "id": "SCN-007",
        "label": "Multi-hazard official alert — Heatwave + Road Closure",
        "hazard_type": "Heatwave + Road Closure",
        "affects_shipment": "SHP-882",
        "expected_action": "Emergency Reroute",
        "text": """\
DISTRICT EMERGENCY MANAGEMENT BULLETIN
Date: 16 May 2026 | Time: 14:30 PKT | Priority: CRITICAL

DUAL HAZARD ALERT — DISTRICT 4

HAZARD 1 — EXTREME HEAT:
The Pakistan Meteorological Department has issued a RED LEVEL heat advisory
for District 4. Current temperature: 41°C. Expected peak: 43°C at 15:30.
Heat index with humidity: feels like 48°C. Stay indoors. Avoid exertion.

HAZARD 2 — INFRASTRUCTURE:
Highway 9 is closed for emergency water main repairs following a pipe burst
at KM 12.4. One-way diversion is in effect via Service Road 4A.
Estimated repair completion: 18:00 PKT. Heavy vehicles (>5 tonnes) are
prohibited from using the diversion route due to weight limits.

All logistics operators serving District 4 must coordinate with District
Emergency Management at +92-21-4455667 before entering the district.

COMBINED RISK: Commercial refrigerated vehicles should not idle in
District 4 under current conditions.
""",
    },
    {
        "id": "SCN-008",
        "label": "Mixed English-Urdu informal news",
        "hazard_type": "Traffic Blockage",
        "affects_shipment": "SHP-882",
        "expected_action": "Emergency Reroute",
        "text": """\
Breaking news District 4 mein bht bura accident hua hai Highway 9 par.
3 gaadiyaan crash ho gaye hain. Police aur rescue on the way.

Highway 9 completely jam hai. Log 2 ghante se phanse hue hain.
Temperature bhi bohut zyada hai aaj — 41 degrees C.

Alternative route Route 7 try karo. Thora longer hai lekin clear hai.

Drivers please apni dispatch ko inform karo immediately.
Medical vehicles ko priority milegi agar aap emergency number call karo:
District Traffic Police: 1915
""",
    },
    {
        "id": "SCN-009",
        "label": "Structured weather API response (JSON-like)",
        "hazard_type": "Heatwave",
        "affects_shipment": "SHP-882",
        "expected_action": "Emergency Reroute",
        "text": """\
WEATHER SERVICE ALERT — AUTO-GENERATED NOTIFICATION
{alert_id: "PKM-20260516-D4-001", severity: "EXTREME", type: "HEAT_ADVISORY"}

Location: District 4, City Zone B
Current Conditions:
  - Temperature: 42.3°C (feels like 47.1°C)
  - Humidity: 68%
  - Wind: 8 km/h (southward)
  - UV Index: 11 (Extreme)

Forecast (next 4 hours):
  - 15:00: 43.1°C
  - 16:00: 42.8°C
  - 17:00: 41.5°C
  - 18:00: 39.2°C

Transportation Impact:
  - Highway 9: Reported vehicle breakdowns due to heat. 2-lane restriction.
    Advisory: Avoid if possible. High ambient temperature risk for cold-chain cargo.
  - Route 7: Clear. Recommended alternate.

Alert expires: 19:00 PKT

[END OF AUTOMATED ALERT]
""",
    },
    {
        "id": "SCN-010",
        "label": "Safe scenario — No hazard detected",
        "hazard_type": "None",
        "affects_shipment": None,
        "expected_action": "No action — all clear",
        "text": """\
Good afternoon Karachi. Here's your afternoon traffic update for Friday,
May 16th, 2026.

Roads are largely clear across the city. Minor delays on the Ring Road
near Junction 12 due to routine maintenance — expect 10 minute delays.
All major highways including Highway 9, Highway 12, and Route 66 are
operating normally with no significant incidents reported.

Weather is pleasant today — 28°C with a light breeze from the coast.
Excellent driving conditions across all districts.

Karachi Port: Normal operations. No delays reported.

Have a great Friday evening everyone. Drive safe!
""",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# CLI Interface
# ─────────────────────────────────────────────────────────────────────────────

def print_scenario(scenario: dict, show_metadata: bool = True):
    """Pretty-print a single scenario."""
    print("\n" + "═" * 70)
    if show_metadata:
        print(f"  ID:       {scenario['id']}")
        print(f"  Label:    {scenario['label']}")
        print(f"  Hazard:   {scenario['hazard_type']}")
        print(f"  Affects:  {scenario['affects_shipment'] or 'None'}")
        print(f"  Expected: {scenario['expected_action']}")
        print("─" * 70)
    print("\nINPUT TEXT (send this to the agent):\n")
    print(scenario["text"])
    print("═" * 70)


def get_random_scenario() -> dict:
    return random.choice(SCENARIOS)


def get_scenario_by_id(scenario_id: str) -> dict | None:
    for s in SCENARIOS:
        if s["id"] == scenario_id:
            return s
    return None


def save_to_file(output_path: Path):
    """Save all scenarios to a JSON file."""
    data = {
        "generated_at": datetime.utcnow().isoformat(),
        "total_scenarios": len(SCENARIOS),
        "scenarios": SCENARIOS,
    }
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\n✅ Saved {len(SCENARIOS)} scenarios to: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="BioRoute News Data Generator — creates realistic semi-structured input scenarios"
    )
    parser.add_argument("--random", action="store_true", help="Print one random scenario")
    parser.add_argument("--all", action="store_true", help="Print all scenarios")
    parser.add_argument("--id", type=str, help="Print a specific scenario by ID (e.g. SCN-001)")
    parser.add_argument("--list", action="store_true", help="List all scenario IDs and labels")
    parser.add_argument("--save", action="store_true", help="Save all scenarios to news_scenarios.json")
    parser.add_argument("--text-only", action="store_true", help="Print only the input text (no metadata)")

    args = parser.parse_args()

    if args.list:
        print("\nAvailable scenarios:")
        for s in SCENARIOS:
            print(f"  {s['id']} — {s['label']}")

    elif args.random:
        scenario = get_random_scenario()
        print_scenario(scenario, show_metadata=not args.text_only)
        print(f"\n📋 Copy the text above and send it to: GET /api/stream?input=<text>")

    elif args.all:
        for scenario in SCENARIOS:
            print_scenario(scenario, show_metadata=not args.text_only)

    elif args.id:
        scenario = get_scenario_by_id(args.id.upper())
        if scenario:
            print_scenario(scenario, show_metadata=not args.text_only)
        else:
            print(f"❌ Scenario '{args.id}' not found. Use --list to see available IDs.")

    elif args.save:
        output_path = Path(__file__).parent / "news_scenarios.json"
        save_to_file(output_path)

    else:
        # Default: print the primary test scenario
        print("\n📰 BioRoute News Data Generator")
        print("Using primary test scenario (SCN-001). Use --help for more options.\n")
        print_scenario(SCENARIOS[0])
        print("\n💡 Send this text to the agent:")
        print("   GET /api/stream?input=<paste+the+text+above>")
        print("\n   Or use the /test endpoint in the API for easy testing.")

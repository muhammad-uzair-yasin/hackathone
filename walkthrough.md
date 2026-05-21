# Walkthrough — BioRoute Cold-Chain Agent

This document walks through what BioRoute does, how the agent pipeline works, and what you see in the demo. Written for hackathon judges.

---

## What We Built

BioRoute is an **autonomous AI agent** for medical cold-chain logistics. It ingests unstructured news alerts (heatwaves, road blocks, accidents), reasons about which active shipments are at risk, and takes real protective action — updating databases, generating notifications, and streaming every decision live to a mobile app.

There are **two independent agent pipelines**:

1. **Disaster Mitigation Agent** — triggered by an alert, takes immediate action
2. **Predictive Risk Agent** — runs proactively to forecast future breaches before they happen

---

## Pipeline 1 — Disaster Mitigation Agent

### Input

The operator (or a driver via the app) submits an unstructured alert:

```
Severe heatwave alert issued for District 4.
Temperatures expected to spike to 42°C in the next hour.
A multi-vehicle accident has completely blocked Highway 9.
```

### Subagent Pipeline (4 steps)

**Step 1 — `hazard-detector`**
Reads the raw alert text. Extracts structured facts only — no summaries.
```json
{
  "hazard_detected": true,
  "location": "District 4 / Highway 9",
  "hazard_type": "Heatwave + Road Block",
  "severity": "CRITICAL",
  "affected_route": "Highway 9"
}
```

**Step 2 — `shipment-analyzer`**
Cross-references the hazard against `active_shipments.json`. Finds which shipments are on the affected route.
```json
{
  "affected_shipment_id": "SHP-882",
  "cargo": "Insulin (Temp Critical)",
  "current_route": "Highway 9",
  "backup_facility": "District 3 Cold-Vault"
}
```

**Step 3 — `impact-analyzer`**
Calculates time-to-failure and financial consequence.
```json
{
  "time_to_breach_minutes": 45,
  "financial_risk_usd": 50000,
  "severity": "CRITICAL — immediate action required"
}
```

**Step 4 — `action-planner`**
Decides the reroute destination and drafts the hospital notification.
```json
{
  "recommended_action": "Reroute SHP-882 to District 3 Cold-Vault immediately",
  "new_route": "M-9 → District 3 bypass",
  "notify_recipient": "District 4 General Hospital Administration",
  "urgency": "IMMEDIATE"
}
```

### Tool Execution

After the action-planner completes, the orchestrator calls three tools:

- **`update_crm_tool`** — writes the reroute to `active_shipments.json` (status: `Emergency Reroute`, destination: `District 3 Cold-Vault`)
- **`notify_tool`** — logs four notification records (hospital, driver, coordinator, owner) to `notifications.json` and fires a real **local push notification** on the operator's phone with a 4-line structured alert
- **`write_summary_tool`** — writes the full agent trace to `system_state_log.json`

---

## Pipeline 2 — Predictive Risk Agent

Runs independently of the main agent. Triggered manually from the **Risk Forecast** screen or on a background schedule.

### Subagent Pipeline (3 steps)

**Step 1 — `sensor-analyst`**
Reads `active_shipments.json` + `risk_context.json` (ambient temperature, vehicle telemetry, road conditions). Produces a risk signal per shipment.

**Step 2 — `pattern-matcher`**
Cross-references sensor signals against `breach_patterns.json` (historical cold-chain failures). Calculates breach probability per shipment based on idle time, cargo type, and temperature.

**Step 3 — `risk-scorer`**
Combines sensor and pattern scores. Produces a final `0–100` risk score per shipment with:
- Risk level: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `SAFE`
- Recommended action for the coordinator
- Estimated minutes to breach

When the pipeline completes, `CRITICAL` and `HIGH` risk shipments automatically trigger **push notifications** on the operator's device.

---

## Mobile App Screens

| Screen | What it shows |
|---|---|
| **Ingestion Dashboard** | Alert input, pre-built scenarios, active shipment count |
| **AI Decision Engine** | Live streaming subagent steps with animated activity cards |
| **Outcome Visualization** | Before/after shipment state, notification log, acknowledge button |
| **Fleet Screen** | All shipments list + Leaflet map with original vs. rerouted route |
| **Risk Forecast** | Predictive pipeline dashboard with risk scores, history chart, Run Now button |
| **Driver Report** | Field issue submission form (breakdown, temp breach, accident, etc.) |

---

## SSE Streaming — How Live Updates Work

The backend uses **Server-Sent Events (SSE)** to stream every agent event to the mobile app.

Event types emitted:
- `SUBAGENT_START` → shows a new agent card as "active" in the UI
- `SUBAGENT_RESULT` → populates the agent card with extracted data
- `SUBAGENT_DONE` → marks the step complete
- `TOOL_CALL` → shows a tool being executed
- `TOOL_RESULT` → triggers the push notification (for `notify_tool`)
- `SUMMARY_WRITTEN` → finalizes the session and shows the outcome screen
- `PRED_COMPLETE` → (prediction pipeline) sends risk notifications + updates the chart

---

## Real Actions Taken

This is not just a summarization tool. The agent **writes to files**:

| Action | File modified |
|---|---|
| Shipment rerouted | `langchain_agent/data/active_shipments.json` |
| Notifications logged | `langchain_agent/data/notifications.json` |
| Agent trace written | `langchain_agent/data/system_state_log.json` |
| Predictions stored | `langchain_agent/data/predictions.json` |

The mobile app reads these changes live via the API endpoints.

---

## Push Notifications

When `notify_tool` executes, the mobile app receives a structured 4-line push notification:

```
🚨 BioRoute Alert — SHP-882
Urgency: IMMEDIATE
Hospital: District 4 General Hospital
Instructions: Emergency reroute initiated. New route via M-9...
```

For prediction alerts (`CRITICAL` / `HIGH` risk):
```
⚠️ Risk Alert — SHP-901
Risk score: 78/100
Urgency: WITHIN_15_MIN
Action: Reduce idle time. Move to shaded staging area immediately.
```

---

## Technology Decisions

**Why LangChain Deep Agents?**
The `deepagents` SDK gives us structured subagent orchestration with Pydantic response schemas. Every subagent is forced to return validated JSON — no hallucinated free-text leaking between steps.

**Why SSE instead of WebSocket?**
SSE is unidirectional and stateless — perfect for streaming agent logs from server to client. No connection management overhead on the mobile side.

**Why two separate agent pipelines?**
Disaster mitigation is reactive (triggered by an alert). Risk prediction is proactive (runs on a schedule). Keeping them separate means neither blocks the other and they can run concurrently.

**Why local push notifications?**
`expo-notifications` works without a push server — notifications are scheduled locally when the SSE event arrives. Zero backend infrastructure needed for the demo.

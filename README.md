# 🚑 BioRoute Cold-Chain Agent

> **Hackathon:** Antigravity: The Content-to-Action Agent Design Framework
> **Track:** AI Agents × Real-World Action

An autonomous AI agent that monitors unstructured news and environmental alerts, then **takes real action** to protect temperature-sensitive medical cargo — rerouting shipments, updating databases, and notifying hospitals — all without human intervention.

---

## The Problem

Medical cold-chain logistics is fragile. A single heatwave alert or road block can mean:

- Insulin, vaccines, or organs spoiling en route
- **$50,000+ cargo loss** per shipment
- Critical hospital shortages with zero warning time

Today, logistics coordinators read alerts manually, call drivers, and update systems by hand. By the time a decision is made, the cargo is already compromised.

---

## Our Solution

BioRoute Cold-Chain Agent is a **multi-agent AI pipeline** that reads raw, unstructured news alerts and automatically:

1. **Extracts** the operational hazard (location, type, severity) from the text
2. **Analyzes** which active shipments are at risk and calculates time-to-failure
3. **Plans** the optimal reroute action
4. **Executes** the action — updating the shipment database and sending notifications
5. **Predicts** future risks using a separate Predictive Risk Agent that runs continuously

The entire pipeline streams in real-time to a mobile app, giving operators a live view of every agent decision.

---

## Key Features

| Feature | Details |
|---|---|
| **Multi-Agent Orchestration** | 4-subagent pipeline: `hazard-detector` → `shipment-analyzer` → `impact-analyzer` → `action-planner` |
| **Real Action Simulation** | Writes directly to `active_shipments.json` (mock CRM) and `notifications.json` |
| **Live SSE Streaming** | Every agent step streams to the mobile app in real time via Server-Sent Events |
| **Predictive Risk Agent** | A separate 3-subagent pipeline (`sensor-analyst` → `pattern-matcher` → `risk-scorer`) predicts breach risks proactively |
| **Mobile Push Notifications** | Critical alerts fire real local push notifications on the operator's phone |
| **Fleet Map** | Live Leaflet map showing original vs. AI-rerouted routes per shipment |
| **Driver Reports** | Drivers submit field reports via the app; the agent re-analyzes automatically |
| **Before / After Visualization** | Clear split view of shipment state before and after AI intervention |

---

## Architecture

```
Unstructured News Alert (text)
        ↓
FastAPI SSE Endpoint (/api/analyze/stream)
        ↓
LangChain Deep Agent Orchestrator
    ├── hazard-detector      → extracts: location, hazard type, severity
    ├── shipment-analyzer    → finds: affected shipments from active_shipments.json
    ├── impact-analyzer      → calculates: time-to-failure, financial risk
    └── action-planner       → decides: reroute destination + urgency
        ↓
Tool Execution
    ├── update_crm_tool      → writes to active_shipments.json
    ├── notify_tool          → writes to notifications.json + fires push notification
    └── write_summary_tool   → writes to system_state_log.json
        ↓
Mobile App (React Native / Expo)
    ├── NewsInputScreen      → alert ingestion + live agent stream
    ├── FleetScreen          → shipment list + map
    ├── OutcomeVisualization → before/after state view
    ├── PredictionScreen     → risk forecast dashboard
    └── DriverReportScreen   → field report submission
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Framework | LangChain Deep Agents (`deepagents` SDK) |
| LLM | Claude (Anthropic) via `claude_fast` |
| Backend | FastAPI + uvicorn (Python 3.13) |
| Streaming | Server-Sent Events (SSE) |
| Mobile | React Native + Expo |
| Maps | Leaflet (via WebView) |
| Push Notifications | `expo-notifications` |
| Package Manager | `uv` (Python), `npm` (Node) |

---

## Project Structure

```
hackathone/
├── langchain_agent/
│   ├── api/server.py          # FastAPI server — all endpoints + SSE streaming
│   ├── agent.py               # Main disaster mitigation agent (4 subagents)
│   ├── prediction_agent.py    # Predictive risk agent (3 subagents)
│   ├── tools.py               # update_crm_tool, notify_tool, write_summary_tool
│   ├── schemas.py             # Pydantic output schemas for all subagents
│   ├── prediction_schemas.py  # Pydantic schemas for prediction pipeline
│   ├── llm.py                 # LLM provider config
│   └── data/
│       ├── active_shipments.json   # Live shipment CRM (updated by agent)
│       ├── notifications.json      # Notification log (written by agent)
│       ├── predictions.json        # Latest risk predictions
│       └── system_state_log.json   # Full agent trace logs
├── mobile/                    # React Native / Expo app
│   ├── src/screens/           # App screens
│   ├── src/hooks/             # useAgentStream (SSE consumer)
│   └── src/services/          # NotificationService
├── webapp/                    # Static HTML dashboard
└── README.md
```

---

## Quick Start

See **[instructions.md](./instructions.md)** for the full setup guide.

**Short version — two terminals:**

```bash
# Terminal 1: Backend
uv run uvicorn langchain_agent.api.server:app --reload --port 8000

# Terminal 2: Mobile app
cd mobile && npm install && npm start
```

---

## Demo Scenario

Paste this into the app's alert input to trigger a full agent run:

```
Severe heatwave alert issued for District 4.
Temperatures expected to spike to 42°C in the next hour.
A multi-vehicle accident has completely blocked Highway 9 near the Thatta Bypass.
```

**What happens:**
1. `hazard-detector` extracts: `District 4, heatwave 42°C, Highway 9 blocked`
2. `shipment-analyzer` finds: `SHP-882` is on Highway 9
3. `impact-analyzer` calculates: cooling failure in ~45 min, $50,000 at risk
4. `action-planner` decides: reroute to `District 3 Cold-Vault`
5. `update_crm_tool` writes the new route to `active_shipments.json`
6. `notify_tool` logs the alert and fires a push notification to the operator's phone
7. The mobile app map shows the new route in green

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analyze/stream?input=...` | Main agent SSE stream |
| `POST` | `/api/analyze` | Main agent (non-streaming) |
| `GET` | `/api/predict/stream` | Predictive risk agent SSE stream |
| `POST` | `/api/predict` | Run prediction pipeline |
| `GET` | `/api/predictions` | Latest predictions JSON |
| `GET` | `/api/db` | Current shipments state |
| `POST` | `/api/reset` | Reset data to baseline |
| `GET` | `/api/scenarios` | Pre-built test scenarios |
| `GET` | `/health` | Health check |

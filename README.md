# 🚑 RouteWise AI — BioRoute Cold-Chain Agent

> **Hackathon:** Antigravity: The Content-to-Action Agent Design Framework
> **Track:** AI Agents × Real-World Action
> **Built with:** Google Antigravity (Deep Agents SDK)

---

## 📱 Mobile App

**[⬇️ Download APK](https://drive.google.com/file/d/19A6tP6Te7TLuTqKB0mWrVeDUroHJC6sc/view?usp=sharing)**

**GitHub:** [github.com/muhammad-uzair-yasin/hackathone](https://github.com/muhammad-uzair-yasin/hackathone)

---

## The Problem

Medical cold-chain logistics is fragile. A single heatwave alert or road block can mean:

- Insulin, vaccines, or organs spoiling en route
- **$50,000+ cargo loss** per shipment
- Critical hospital shortages with zero warning time

Today, logistics coordinators read alerts manually, call drivers, and update systems by hand. By the time a decision is made, the cargo is already compromised.

---

## Our Solution

**RouteWise AI** is an autonomous multi-agent AI pipeline that reads raw, unstructured news alerts and automatically:

1. **Extracts** the operational hazard (location, type, severity) from plain text
2. **Analyzes** which active shipments are at risk and calculates time-to-failure
3. **Plans** the optimal reroute action with confidence scoring
4. **Executes** — updates the shipment database and sends 4 targeted notifications
5. **Predicts** future risks proactively using a separate Predictive Risk Agent

The entire pipeline streams in real-time to a mobile app, giving operators a live view of every agent decision.

---

## 🤖 Agents Developed

### Agent 1 — Disaster Mitigation Orchestrator
A 4-subagent pipeline triggered by unstructured news/weather/traffic alerts:

| Subagent | Role | Output Schema |
|---|---|---|
| `hazard-detector` | Extracts location, hazard type, severity from raw text | `HazardExtraction` |
| `shipment-analyzer` | Scans active fleet, finds affected shipments | `FleetScoutOutput` |
| `impact-analyzer` | Calculates time-to-failure, financial risk, breach probability | `ImpactAnalysis` |
| `action-planner` | Selects optimal reroute, calculates confidence score | `ActionPlan` |

**Tools executed after pipeline:**
- `update_crm_tool` — writes new route to `active_shipments.json`
- `notify_tool` — sends 4 email-style notifications (hospital, driver, coordinator, owner)
- `write_summary_tool` — writes plain-English run summary to `summary.md`

### Agent 2 — Predictive Risk Agent
A separate 3-subagent pipeline that runs on a configurable schedule (1/5/15/30/60 min):

| Subagent | Role |
|---|---|
| `sensor-analyst` | Reads live telemetry, flags temperature anomalies |
| `pattern-matcher` | Cross-references historical breach patterns |
| `risk-scorer` | Assigns final risk score (0–100) and urgency level per shipment |

### Agent 3 — Intent Classifier
A lightweight single LLM call that runs before the main pipeline. Classifies input as `alert` (run full pipeline) or `chat` (respond conversationally). Prevents the structured-output pipeline from running on casual messages like "hi" or "what can you do?".

---

## 🏗️ Architecture

```
Unstructured News Alert (text / voice)
        ↓
Intent Classifier (single LLM call)
        ↓ alert                    ↓ chat
Full Pipeline                 Chatbot Response
        ↓
FastAPI SSE Endpoint (/api/analyze/stream)
        ↓
Deep Agent Orchestrator (Google Antigravity)
    ├── hazard-detector      → HazardExtraction schema
    ├── shipment-analyzer    → FleetScoutOutput schema
    ├── impact-analyzer      → ImpactAnalysis schema
    └── action-planner       → ActionPlan schema
        ↓
Tool Execution
    ├── update_crm_tool      → writes to active_shipments.json
    ├── notify_tool          → 4 notifications to notifications.json
    └── write_summary_tool   → writes to summary.md
        ↓
Mobile App (React Native / Expo) — Live SSE Stream
    ├── News Tab        → alert ingestion + live agent stream
    ├── Fleet Tab       → shipment list + Leaflet map
    ├── Agent Tab       → real-time pipeline timeline
    ├── Outcome Tab     → before/after state + map + notifications
    ├── Report Tab      → driver field reports (text + voice)
    └── Predict Tab     → risk forecast dashboard + auto-schedule
```

---

## 🔌 APIs & Integrations

| Service | Usage |
|---|---|
| **Pollinations.ai** | LLM provider — OpenAI-compatible API for Claude Haiku 4.5 |
| **Pollinations Whisper** | Speech-to-text for voice input (driver reports + news alerts) |
| **Pollinations TTS** | Text-to-speech for agent responses |
| **OpenStreetMap / CARTO** | Leaflet map tiles for route visualization |
| **expo-notifications** | Local push notifications for critical alerts |

---

## 📱 Mobile App Features

| Feature | Details |
|---|---|
| **Live SSE Streaming** | Every agent step streams to the app in real time |
| **Voice Input** | Record audio → Whisper transcription → agent analysis |
| **Fleet Map** | Leaflet map showing original vs AI-rerouted routes |
| **Before / After View** | Clear split view of shipment state before and after AI intervention |
| **4-Audience Notifications** | Hospital, Driver, Coordinator, Owner — each gets a tailored email |
| **Predictive Dashboard** | Risk scores, breach probability, time-to-breach per shipment |
| **Auto-Schedule** | Configure prediction agent to run every 1/5/15/30/60 minutes |
| **Driver Reports** | Field reports via text or mic; agent re-analyzes automatically |
| **Push Notifications** | Critical alerts fire real local push notifications |
| **Chatbot Fallback** | Simple messages get a conversational response, not a full pipeline run |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Agent Framework | Google Antigravity Deep Agents (`deepagents` SDK) |
| LLM | Claude Haiku 4.5 (via Pollinations.ai OpenAI-compatible API) |
| Backend | FastAPI + uvicorn (Python 3.13) |
| Streaming | Server-Sent Events (SSE) |
| Mobile | React Native + Expo SDK 55 |
| Maps | Leaflet (via WebView) |
| Push Notifications | `expo-notifications` |
| Voice | `expo-av` + Pollinations Whisper API |
| Package Manager | `uv` (Python), `npm` (Node) |

---

## 📁 Project Structure

```
hackathone/
├── langchain_agent/
│   ├── api/server.py          # FastAPI — all endpoints + SSE streaming + intent classifier
│   ├── agent.py               # Disaster mitigation agent (4 subagents)
│   ├── prediction_agent.py    # Predictive risk agent (3 subagents)
│   ├── tools.py               # update_crm_tool, notify_tool, write_summary_tool
│   ├── schemas.py             # Pydantic output schemas for all subagents
│   ├── prediction_schemas.py  # Pydantic schemas for prediction pipeline
│   ├── llm.py                 # LLM provider (Pollinations claude-fast)
│   └── data/
│       ├── active_shipments.json        # Live shipment CRM (updated by agent)
│       ├── active_shipments_baseline.json  # Reset baseline
│       ├── notifications.json           # 4-audience notification log
│       ├── predictions.json             # Latest risk predictions
│       ├── prediction_history.json      # Rolling 20-run history
│       └── summary.md                   # Plain-English run summary
├── mobile/                    # React Native / Expo app
│   ├── src/screens/           # 6 app screens
│   ├── src/hooks/useAgentStream.ts  # SSE consumer + state management
│   └── src/services/NotificationService.ts  # Push notifications
├── webapp/                    # Static HTML dashboard
└── README.md
```

---

## ⚠️ Demo Note

This project uses **realistic mock data** for demonstration purposes. The shipment fleet (`active_shipments.json`), sensor telemetry, and breach history are all simulated to showcase the full AI pipeline end-to-end. In a production deployment, these would connect to real GPS tracking APIs, IoT temperature sensors, and a live logistics CRM.

---



**Backend:**
```bash
uv run uvicorn langchain_agent.api.server:app --reload --port 8000 --host 0.0.0.0
```

**Mobile app:**
```bash
cd mobile && npm install && npx expo start
```

---

## 🎬 Demo Scenario

Paste this into the app's alert input:

```
Severe heatwave alert issued for District 4.
Temperatures expected to spike to 42°C in the next hour.
A multi-vehicle accident has completely blocked Highway 9 near the Thatta Bypass.
```

**What happens in ~60 seconds:**
1. `hazard-detector` → `District 4, heatwave 42°C, Highway 9 blocked`
2. `shipment-analyzer` → `SHP-882` is on Highway 9
3. `impact-analyzer` → cooling failure in ~45 min, $50,000 at risk
4. `action-planner` → reroute to `M-9 Thatta Bypass` (confidence: 94%)
5. `update_crm_tool` → new route written to fleet database
6. `notify_tool` → 4 notifications sent (hospital, driver, coordinator, owner)
7. Mobile map → original route (red dashed) vs AI reroute (green)
8. Push notification → fires on operator's phone

---

## 🔗 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stream?input=...` | Main agent SSE stream |
| `POST` | `/api/analyze` | Main agent (JSON body) |
| `GET` | `/api/predict/stream` | Predictive risk agent SSE stream |
| `POST` | `/api/predict/schedule` | Configure auto-run schedule |
| `GET` | `/api/predictions` | Latest predictions JSON |
| `GET` | `/api/db` | Current shipments state |
| `POST` | `/api/reset` | Reset data to baseline |
| `POST` | `/api/driver-report` | Submit driver field report |
| `POST` | `/api/voice/transcribe` | Speech-to-text (Whisper) |
| `GET` | `/api/voice/tts` | Text-to-speech |
| `GET` | `/api/summary/pdf` | Download run summary as PDF |
| `GET` | `/health` | Health check |

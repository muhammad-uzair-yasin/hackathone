# Project Context — BioRoute Cold-Chain Agent

**Project Name:** BioRoute Cold-Chain AI Agent  
**Framework:** Google Antigravity (Deep Agents SDK) + LangChain Deep Agents  
**Status:** Active Development (Hackathon 24h Sprint)  
**Last Updated:** 2026-06-02

---

## 📋 Project Overview

**What it does:**
An autonomous multi-agent AI system that monitors unstructured news/weather/traffic alerts and automatically protects temperature-sensitive medical logistics (vaccines, insulin, organs) by executing emergency reroutes, updating the shipment database, and notifying stakeholders in real-time.

**Why it matters:**
A single heatwave or traffic blockage can spoil $50,000+ in medical cargo and cause critical hospital shortages. The system turns raw alerts into instant, traceable, measurable actions — no manual coordination.

---

## 🏗️ Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Backend** | FastAPI (Python 3.13) + uvicorn | REST API + SSE streaming |
| **Agent Orchestration** | LangChain Deep Agents (deepagents SDK) | 4 subagents + 1 prediction pipeline |
| **LLM Provider** | Claude Haiku 4.5 via Pollinations.ai | OpenAI-compatible API |
| **Database (Mock)** | JSON files (active_shipments.json) | Local file-based CRM |
| **Mobile Frontend** | React Native + Expo SDK 55 | 6 screens + real-time SSE stream |
| **Maps** | Leaflet (via WebView) | Route visualization |
| **Push Notifications** | expo-notifications | Local alerts on mobile |
| **Voice I/O** | Pollinations Whisper + TTS | Speech-to-text + text-to-speech |
| **Package Manager** | `uv` (Python) + `npm` (Node) | Deterministic builds |

---

## 📁 Project Structure

```
hackathone/
├── langchain_agent/               ← Backend core
│   ├── api/server.py              ← FastAPI (SSE endpoints)
│   ├── agent.py                   ← Main orchestrator (4 subagents)
│   ├── prediction_agent.py        ← Predictive risk pipeline (3 subagents)
│   ├── tools.py                   ← update_crm_tool, notify_tool, write_summary_tool
│   ├── schemas.py                 ← Pydantic output schemas (subagents)
│   ├── prediction_schemas.py      ← Pydantic schemas (predictive pipeline)
│   ├── llm.py                     ← Claude Haiku 4.5 via Pollinations
│   └── data/
│       ├── active_shipments.json          ← Live CRM (updated by agent)
│       ├── active_shipments_baseline.json ← Demo reset baseline
│       ├── notifications.json             ← 4-audience notification log
│       ├── predictions.json               ← Latest risk predictions
│       ├── prediction_history.json        ← Rolling 20-run history
│       ├── breach_patterns.json           ← Historical breach thresholds
│       ├── risk_context.json              ← Live environment + telemetry
│       ├── summary.md                     ← Run summary (session record in HTML comment)
│       └── business_context.md            ← Agent grounding rules
├── mobile/                        ← React Native / Expo app
│   ├── src/screens/               ← 6 app screens
│   ├── src/hooks/useAgentStream.ts ← SSE consumer + state management
│   ├── src/services/NotificationService.ts ← Push notifications
│   ├── .env                       ← Backend API URL (EXPO_PUBLIC_API_URL)
│   └── app.json                   ← Expo config
├── webapp/                        ← Static web dashboard (optional)
├── docs/context/                  ← Agent context files (this folder)
├── .env                           ← Python: Pollinations API key
├── pyproject.toml                 ← Python dependencies + uv config
└── README.md                      ← Project overview + run instructions
```

---

## 🤖 Agents & Modules

### Main Agent Pipeline (Disaster Mitigation Orchestrator)
**File:** `langchain_agent/agent.py`  
**Trigger:** POST /api/analyze (news alert)  
**Workflow:** Sequential subagent execution via LangChain Deep Agents

| Subagent | Role | Output Schema | Input |
|----------|------|---------------|-------|
| `hazard-detector` | Extract hazard facts from raw text | HazardExtraction | Raw alert text only |
| `shipment-analyzer` | List all active shipments on the road | FleetScoutOutput | Read /data/active_shipments.json |
| `impact-analyzer` | Match hazard to affected shipments + calculate time-to-failure | ImpactAnalysis | Raw alert + shipment list |
| `action-planner` | Pick best of 4 alternative routes + create notification drafts | ActionPlan | Raw alert + impact analysis |

**Execution Path:**
```
Orchestrator → [hazard-detector] → [shipment-analyzer] → [impact-analyzer] → [action-planner] → Tools
  ↓                                                                                  ↓
  └─ update_crm_tool (updates route in DB)
  └─ notify_tool (4-audience email simulation)
  └─ write_summary_tool (persists summary.md)
```

### Predictive Risk Agent (Proactive Monitoring)
**File:** `langchain_agent/prediction_agent.py`  
**Trigger:** GET /api/predict/stream or scheduled (1/5/15/30/60 min)  
**Workflow:** 3 subagents → risk scoring

| Subagent | Role | Output Schema |
|----------|------|---------------|
| `sensor-analyst` | Read live telemetry from active shipments + environment | SensorAnalysisOutput |
| `pattern-matcher` | Cross-reference sensor data with historical breach patterns | PatternAnalysisOutput |
| `risk-scorer` | Combine scores into final 0–100 risk per shipment + actions | PredictionOutput |

---

## 🔌 API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/stream?input=...` | Main agent SSE stream (query param) |
| `POST` | `/api/analyze` | Main agent (JSON body) |
| `GET` | `/api/predict/stream` | Predictive risk agent SSE stream |
| `POST` | `/api/predict` | Run predictive pipeline once |
| `GET` | `/api/predictions` | Latest predictions JSON |
| `GET` | `/api/db` | Current active_shipments.json |
| `POST` | `/api/reset` | Restore demo baseline |
| `GET` | `/health` | Health check |

---

## 📱 Mobile Screens (6 Total)

1. **Home / News Ingestion** — Input alert, auto-stream agent steps
2. **Fleet Dashboard** — Live shipment list + map
3. **Agent Timeline** — Step-by-step agent reasoning (Hazard → Fleet → Impact → Action)
4. **Outcome Visualization** — Before/after route comparison + notification log
5. **Risk Forecast** — Predictive risk dashboard + auto-schedule config
6. **Driver Reports** — Field reports from drivers (text + voice)

---

## 🎯 Core Modules (Status Table)

| Module | Owner | Status | Last Update | Notes |
|--------|-------|--------|-------------|-------|
| `agent.py` — Orchestrator | backend-engineer | ✅ Complete | 2026-06-02 | 4 subagents, schema validation |
| `api/server.py` — FastAPI | backend-engineer | ✅ Complete | 2026-06-02 | SSE streaming, intent classifier |
| `tools.py` — CRM + Notify | backend-engineer | ✅ Complete | 2026-06-02 | Action simulation tools |
| `prediction_agent.py` — Risk | backend-engineer | ✅ Complete | 2026-06-02 | 3 subagents, scoring logic |
| `mobile/` — React Native | frontend-engineer | ✅ Complete | 2026-06-02 | 6 screens, real-time SSE, notifications |
| `docs/ui/` — Route tracking | frontend-engineer | ✅ Complete | 2026-06-02 | frontend-flow-map.md, wireframe-tracker.md |

---

## 📊 Data Files

| File | Purpose | Owner | Status |
|------|---------|-------|--------|
| `active_shipments.json` | Live CRM (mock fleet database) | orchestrator | Updated by agent at runtime |
| `active_shipments_baseline.json` | Demo reset baseline | demo setup | Static reference |
| `notifications.json` | 4-audience notification log | notify_tool | Appended by agent |
| `predictions.json` | Latest risk predictions (per-shipment) | write_predictions_tool | Overwritten by prediction agent |
| `prediction_history.json` | Rolling 20-run history | write_predictions_tool | Appended after each prediction run |
| `breach_patterns.json` | Historical breach thresholds (seeded) | grounding | Static reference |
| `risk_context.json` | Live environment + vehicle telemetry | seeded | Static for demo |
| `summary.md` | Session record + pipeline log | write_summary_tool | Overwritten after each run |
| `business_context.md` | Agent grounding rules | grounding | Static reference |

---

## 🚀 Key Features

- ✅ **Real-time SSE streaming** — Every agent step streams to mobile app live
- ✅ **Multi-agent orchestration** — LangChain Deep Agents + Pydantic schema validation
- ✅ **Action simulation** — Physical database writes (before/after state tracking)
- ✅ **4-audience notifications** — Hospital, driver, coordinator, owner (simulation)
- ✅ **Predictive risk scoring** — Proactive breach probability (0–100)
- ✅ **Intent classifier** — Skips pipeline for casual chat ("hi", "what can you do?")
- ✅ **Voice I/O** — Whisper + TTS via Pollinations
- ✅ **Mobile-first** — Expo app with Leaflet map + push notifications
- ✅ **Traceable decisions** — Session record + pipeline logs in summary.md

---

## 🔐 Environment Variables

| Key | Purpose | Example | Where |
|-----|---------|---------|-------|
| `Pollinations` | LLM API key (Claude Haiku 4.5) | `sk-ant-...` | `.env` (root) |
| `EXPO_PUBLIC_API_URL` | Backend URL for mobile app | `http://192.168.x.x:8000` | `mobile/.env` |

---

## 📋 Dependencies

**Backend (Python 3.13):**
- `langchain-core`, `langchain-openai` — Agent framework
- `deepagents` — Google Deep Agents SDK
- `fastapi`, `uvicorn` — REST API + SSE
- `pydantic` — Schema validation
- `httpx` — Async HTTP client

**Mobile (Node 18+):**
- `react-native`, `expo` — Framework
- `@react-navigation` — Navigation
- `leaflet`, `react-leaflet` — Maps
- `expo-notifications` — Push notifications
- `expo-av` — Audio recording


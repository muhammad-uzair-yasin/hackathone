# File Paths & Directory Structure — BioRoute Project

**Last Updated:** 2026-06-02

---

## Root Directory Structure

```
hackathone/                         ← Project root
├── .env                            ← Pollinations API key (Pollinations=sk-...)
├── .python-version                 ← Python 3.13
├── pyproject.toml                  ← Python dependencies + uv config
├── .gitignore                      ← Git ignore patterns
├── README.md                        ← Project overview + run instructions
├── PROJECT_SCOPE.md                ← Business requirements + BRD
├── instructions.md                 ← Step-by-step run guide
│
├── docs/                           ← Documentation
│   ├── context/                    ← Agent context files (THIS FOLDER)
│   │   ├── context.md              ← Project overview, tech stack, modules
│   │   ├── progress.md             ← Active task tracking
│   │   ├── preferences.md          ← Code style + standards
│   │   ├── conventions.md          ← Tech decisions + patterns
│   │   └── paths.md                ← This file
│   ├── ui/                         ← Frontend documentation
│   │   ├── frontend-flow-map.md    ← Route + screen tracking
│   │   └── wireframe-implementation-tracker.md ← Screen specs
│   └── architecture.md             ← (optional) System diagrams
│
├── langchain_agent/                ← Backend core (Python)
│   ├── __init__.py
│   ├── agent.py                    ← Main orchestrator (4 subagents)
│   ├── prediction_agent.py         ← Prediction orchestrator (3 subagents)
│   ├── llm.py                      ← LLM provider (Claude Haiku 4.5)
│   ├── tools.py                    ← Custom tools (update_crm, notify, write_summary)
│   ├── schemas.py                  ← Pydantic output schemas (main pipeline)
│   ├── prediction_schemas.py       ← Pydantic schemas (prediction pipeline)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   └── server.py               ← FastAPI + SSE endpoints
│   │
│   └── data/                       ← Mock CRM + seeded data
│       ├── active_shipments.json   ← Live CRM (updated by agent)
│       ├── active_shipments_baseline.json ← Demo reset baseline
│       ├── notifications.json      ← 4-audience notification log
│       ├── predictions.json        ← Latest risk predictions
│       ├── prediction_history.json ← Rolling 20-run history
│       ├── breach_patterns.json    ← Historical breach thresholds (seeded)
│       ├── risk_context.json       ← Live environment + telemetry (seeded)
│       ├── summary.md              ← Session record + pipeline log
│       ├── business_context.md     ← Agent grounding rules
│       └── generate_news.py        ← Script to generate test news scenarios
│
├── mobile/                         ← React Native / Expo app
│   ├── .env                        ← Backend API URL (EXPO_PUBLIC_API_URL=...)
│   ├── .env.example                ← Template
│   ├── app.json                    ← Expo config + app metadata
│   ├── package.json                ← Node dependencies
│   ├── tsconfig.json               ← TypeScript config
│   ├── babel.config.js             ← Babel config
│   │
│   ├── src/
│   │   ├── App.tsx                 ← Root component
│   │   ├── types/                  ← TypeScript interfaces
│   │   │   └── index.ts            ← Shared types
│   │   │
│   │   ├── screens/                ← App screens (6 total)
│   │   │   ├── HomeScreen.tsx      ← 1. News ingestion + live stream
│   │   │   ├── FleetScreen.tsx     ← 2. Shipment list + map
│   │   │   ├── AgentScreen.tsx     ← 3. Agent timeline (steps)
│   │   │   ├── OutcomeScreen.tsx   ← 4. Before/after visualization
│   │   │   ├── RiskScreen.tsx      ← 5. Predictive risk dashboard
│   │   │   └── ReportScreen.tsx    ← 6. Driver field reports
│   │   │
│   │   ├── hooks/                  ← Custom React hooks
│   │   │   ├── useAgentStream.ts   ← SSE consumer + state mgmt
│   │   │   └── usePredictions.ts   ← Prediction polling
│   │   │
│   │   ├── components/             ← Shared UI components
│   │   │   ├── MapView.tsx         ← Leaflet map wrapper
│   │   │   ├── Timeline.tsx        ← Agent step timeline
│   │   │   ├── NotificationBadge.tsx ← Notification UI
│   │   │   └── ...
│   │   │
│   │   ├── services/               ← Business logic
│   │   │   ├── ApiClient.ts        ← REST client (fetch, SSE)
│   │   │   ├── NotificationService.ts ← Push notifications
│   │   │   └── VoiceService.ts     ← Whisper + TTS
│   │   │
│   │   └── utils/                  ← Helpers
│   │       ├── constants.ts        ← API paths, colors
│   │       └── formatters.ts       ← String/time formatters
│   │
│   ├── .expo/                      ← Expo cache (generated, .gitignore)
│   └── node_modules/               ← Node packages (generated, .gitignore)
│
├── webapp/                         ← (Optional) Static web dashboard
│   ├── index.html
│   ├── style.css
│   └── ...
│
├── agents/                         ← Agent specs + rules (for this workflow)
│   ├── agents/                     ← Agent definitions
│   │   ├── product-manager.md      ← Product discussion role
│   │   ├── domain-expert.md        ← Domain knowledge role
│   │   ├── backend-engineer.md     ← Backend development role
│   │   ├── frontend-engineer.md    ← Frontend development role
│   │   ├── database-engineer.md    ← DB/schema role
│   │   ├── code-reviewer.md        ← Code quality gate
│   │   └── qa-debugger.md          ← Testing + debugging role
│   │
│   ├── skills/                     ← SpecKit skills (spec planning)
│   │   ├── speckit-specify/
│   │   ├── speckit-clarify/
│   │   ├── speckit-plan/
│   │   ├── speckit-tasks/
│   │   ├── speckit-analyze/
│   │   ├── speckit-implement/
│   │   ├── speckit-checklist/
│   │   └── ... (all SpecKit skills)
│   │
│   └── rules/
│       └── workflow_v4.mdc         ← Agent workflow rules (this project uses it)
│
├── specs/                          ← (Optional) Feature specs folder
│   └── small-tasks/                ← Small task specs
│
└── .git/                           ← Git repository (generated)
```

---

## Key File Paths

### Backend (Python)

| Path | Purpose | Owner | Status |
|------|---------|-------|--------|
| `langchain_agent/agent.py` | Main orchestrator (4 subagents) | backend-engineer | ✅ Complete |
| `langchain_agent/prediction_agent.py` | Prediction orchestrator (3 subagents) | backend-engineer | ✅ Complete |
| `langchain_agent/api/server.py` | FastAPI endpoints + SSE | backend-engineer | ✅ Complete |
| `langchain_agent/tools.py` | Action simulation tools | backend-engineer | ✅ Complete |
| `langchain_agent/schemas.py` | Output schemas (main) | backend-engineer | ✅ Complete |
| `langchain_agent/prediction_schemas.py` | Output schemas (prediction) | backend-engineer | ✅ Complete |
| `langchain_agent/llm.py` | LLM provider config | backend-engineer | ✅ Complete |
| `langchain_agent/data/active_shipments.json` | Live CRM database | orchestrator | Updated at runtime |
| `langchain_agent/data/notifications.json` | Notification log | notify_tool | Appended at runtime |
| `langchain_agent/data/predictions.json` | Risk predictions | write_predictions_tool | Overwritten at runtime |
| `langchain_agent/data/summary.md` | Session record | write_summary_tool | Overwritten at runtime |

### Frontend (TypeScript / React Native)

| Path | Purpose | Owner | Status |
|------|---------|-------|--------|
| `mobile/src/screens/HomeScreen.tsx` | News input + live agent stream | frontend-engineer | ✅ Complete |
| `mobile/src/screens/FleetScreen.tsx` | Shipment list + map | frontend-engineer | ✅ Complete |
| `mobile/src/screens/AgentScreen.tsx` | Agent timeline | frontend-engineer | ✅ Complete |
| `mobile/src/screens/OutcomeScreen.tsx` | Before/after visualization | frontend-engineer | ✅ Complete |
| `mobile/src/screens/RiskScreen.tsx` | Predictive risk dashboard | frontend-engineer | ✅ Complete |
| `mobile/src/screens/ReportScreen.tsx` | Driver field reports | frontend-engineer | ✅ Complete |
| `mobile/src/hooks/useAgentStream.ts` | SSE consumer hook | frontend-engineer | ✅ Complete |
| `mobile/src/services/ApiClient.ts` | REST + SSE client | frontend-engineer | ✅ Complete |
| `mobile/src/services/NotificationService.ts` | Push notifications | frontend-engineer | ✅ Complete |
| `mobile/.env` | Backend URL config | devops | User-configurable |

### Documentation

| Path | Purpose | Owner | Status |
|------|---------|-------|--------|
| `docs/context/context.md` | Project overview | orchestrator | ✅ Complete |
| `docs/context/progress.md` | Active task tracking | orchestrator | ✅ Complete |
| `docs/context/preferences.md` | Code style standards | orchestrator | ✅ Complete |
| `docs/context/conventions.md` | Tech decisions | orchestrator | ✅ Complete |
| `docs/context/paths.md` | Directory structure (this file) | orchestrator | ✅ Complete |
| `docs/ui/frontend-flow-map.md` | Route tracking | frontend-engineer | ✅ Complete |
| `docs/ui/wireframe-implementation-tracker.md` | Screen specs | frontend-engineer | ✅ Complete |
| `README.md` | Project overview + quick start | team | ✅ Complete |
| `PROJECT_SCOPE.md` | Business requirements | team | ✅ Complete |
| `instructions.md` | Run instructions | team | ✅ Complete |

---

## Data File Locations

All data files are in `langchain_agent/data/`:

| File | Type | Size | Update Policy | Purpose |
|------|------|------|----------------|---------|
| `active_shipments.json` | JSON | ~2 KB | In-place (agent writes) | Live CRM |
| `active_shipments_baseline.json` | JSON | ~2 KB | Static (reset) | Demo baseline |
| `notifications.json` | JSON | ~1 KB | Append (agent writes) | Notification log |
| `predictions.json` | JSON | ~1 KB | Overwrite (agent writes) | Latest predictions |
| `prediction_history.json` | JSON | ~5 KB | Append (rolling 20 entries) | Prediction history |
| `breach_patterns.json` | JSON | ~5 KB | Static (seeded) | Breach thresholds |
| `risk_context.json` | JSON | ~3 KB | Static (seeded) | Live environment |
| `summary.md` | Markdown | ~3 KB | Overwrite (agent writes) | Session record |
| `business_context.md` | Markdown | ~2 KB | Static (reference) | Agent grounding |

---

## Environment File Locations

| File | Purpose | Content | Location |
|------|---------|---------|----------|
| `.env` | Python backend config | `Pollinations=sk-...` | Root directory |
| `mobile/.env` | Mobile app config | `EXPO_PUBLIC_API_URL=http://...` | `mobile/` |

---

## Build & Runtime Paths

### Python

```bash
# Interpreter
~/.venv/bin/python

# Installed packages
~/.venv/lib/python3.13/site-packages/

# Virtual environment
.venv/
```

### Node (Mobile)

```bash
# Global npm
/usr/local/bin/npm

# Project dependencies
mobile/node_modules/

# Expo cache
mobile/.expo/

# Android build output
mobile/android/app/build/

# iOS build output
mobile/ios/
```

---

## Import Paths & Module Resolution

### Python

```python
# Backend imports (from project root)
from langchain_agent.agent import get_agent
from langchain_agent.tools import update_crm_tool
from langchain_agent.schemas import HazardExtraction
from langchain_agent.api.server import app
```

### TypeScript (Mobile)

```typescript
// Screen imports
import HomeScreen from "../screens/HomeScreen";

// Hook imports
import { useAgentStream } from "../hooks/useAgentStream";

// Service imports
import ApiClient from "../services/ApiClient";

// Type imports
import type { StreamEvent } from "../types";

// Relative imports
import { formatTime } from "../utils/formatters";
```

---

## Deployment Paths

### Local Development

- Backend: `http://localhost:8000`
- Mobile (web): `http://localhost:19006` (Expo)
- Mobile (physical phone): `http://192.168.x.x:8000` (depends on local IP)

### Testing & CI/CD

- Test runner: `pytest` (Python)
- Test runner: `npm test` / `jest` (Mobile)
- Linter: `ruff` (Python)
- Formatter: `black` (Python)

---

## .gitignore Patterns

```
# Python
.venv/
__pycache__/
*.pyc
.pytest_cache/
.coverage
*.egg-info/

# Node
node_modules/
npm-debug.log
dist/
build/

# Expo
.expo/
.expo-shared/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Secrets
.env
.env.local
*.key
*.pem

# OS
.DS_Store
Thumbs.db
```

---

## Quick Reference

### To run backend:
```bash
uv run uvicorn langchain_agent.api.server:app --reload --port 8000
```

### To run mobile:
```bash
cd mobile && npm start
```

### To check code:
```bash
# Python
ruff check langchain_agent/

# TypeScript
npx eslint mobile/src/
```

### To view logs:
- Backend: Console output (stdout)
- Mobile: Expo terminal + Chrome DevTools
- Notifications: `langchain_agent/data/notifications.json`


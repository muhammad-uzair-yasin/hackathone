# Hackathon Project

AI-powered logistics platform with a LangChain agent backend, a web dashboard, and a React Native mobile app.

---

## Project Structure

```
hackathone/
├── langchain_agent/       # Python backend (FastAPI + LangChain)
│   ├── api/server.py      # FastAPI SSE streaming server
│   ├── agent.py           # LangChain agent logic
│   ├── tools.py           # Agent tools
│   └── data/              # Shipment & news scenario data
├── webapp/                # Static web dashboard (HTML/JS/CSS)
│   ├── index.html
│   ├── app.js
│   └── map.js
└── mobile/                # React Native (Expo) mobile app
```

---

## Prerequisites

- Python 3.13+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Node.js + npm
- Expo CLI (`npm install -g expo-cli`)

---

## 1. Backend (FastAPI + LangChain Agent)

```bash
# From project root
uv run uvicorn langchain_agent.api.server:app --reload --port 8001
```

The API will be available at `http://localhost:8000`.

**Key endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analyze` | SSE stream — send `{"input": "..."}` |
| GET | `/api/stream?input=...` | SSE stream via query param (mobile) |
| GET | `/api/scenarios` | List test news scenarios |
| GET | `/api/db` | Current shipments state |
| POST | `/api/reset` | Reset demo data to baseline |
| GET | `/health` | Health check |

---

## 2. Web Frontend (Static)

No build step needed — open directly in a browser:

```bash
# Option A: open the file directly
xdg-open webapp/index.html

# Option B: serve with Python
python3 -m http.server 3000 --directory webapp
# then visit http://localhost:3000
```

Make sure the backend is running first so the dashboard can connect to `http://localhost:8000`.

---

## 3. Mobile App (React Native / Expo)

```bash
cd mobile

# Install dependencies (first time only)
npm install

# Start Expo dev server
npm start
```

Then press:
- `a` — open on Android emulator
- `i` — open on iOS simulator
- `w` — open in web browser
- Scan the QR code with the **Expo Go** app on your phone

### Mobile environment config

Copy `.env.example` to `.env` and set your backend URL:

```bash
cp mobile/.env.example mobile/.env
# Edit .env and set the API URL, e.g.:
# EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```

> Use your machine's local IP (not `localhost`) so the phone can reach the backend.

---

## Quick Start (all at once)

Open 2 terminals:

**Terminal 1 — Backend:**
```bash
uv run uvicorn langchain_agent.api.server:app --reload --port 8000
```

**Terminal 2 — Mobile:**
```bash
cd mobile && npm start
```

Then open `webapp/index.html` in your browser for the web dashboard.

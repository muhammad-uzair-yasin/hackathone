# Instructions — How to Run BioRoute Cold-Chain Agent

Follow these steps to get the full system running locally.

---

## Prerequisites

Install these before starting:

| Tool | Version | Install |
|---|---|---|
| Python | 3.13+ | [python.org](https://www.python.org) |
| `uv` (Python package manager) | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Expo Go (on your phone) | latest | App Store / Play Store |

---

## Step 1 — Clone & Enter the Project

```bash
git clone <your-repo-url>
cd hackathone
```

---

## Step 2 — Set Up Environment Variables

You need an Anthropic API key (the agents use Claude).

Create a `.env` file in the project root:

```bash
# hackathone/.env
Pollinations=sk-ant-...your-key-here...
```

> **Note:** The mobile app has its own `.env` in `mobile/` — see Step 5.

---

## Step 3 — Install Python Dependencies

```bash
# From the project root
uv sync
```

This reads `pyproject.toml` and installs everything into a virtual environment automatically.

---

## Step 4 — Start the Backend Server

```bash
# From the project root
uv run uvicorn langchain_agent.api.server:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Verify it's working:
```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

---

## Step 5 — Configure Mobile App Backend URL

The mobile app needs to know where your backend is running.

```bash
cd mobile
```

Edit `mobile/.env` (create it if it doesn't exist):

```bash
# If running on a physical phone, use your machine's local IP address
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000

# If using an Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000

# If using iOS simulator
EXPO_PUBLIC_API_URL=http://localhost:8000
```

> **Tip:** Find your local IP with `ip route get 1` (Linux) or `ipconfig` (Windows) or `ifconfig` (Mac).

---

## Step 6 — Install Mobile Dependencies & Start

```bash
cd mobile

# Install Node dependencies (first time only)
npm install

# Start the Expo dev server
npm start
```

You'll see a QR code in the terminal.

**To open the app:**
- **Physical phone:** Scan the QR code with the **Expo Go** app
- **Android emulator:** Press `a`
- **iOS simulator:** Press `i`
- **Web browser:** Press `w`

---

## Step 7 — Reset Demo Data (Optional)

To reset the shipment database to the baseline state before running a demo:

```bash
curl -X POST http://localhost:8000/api/reset
```

---

## Running a Full Demo

Once both the backend and mobile app are running:

1. Open the **BioRoute** app on your phone
2. Tap **"Analyze Alert"** on the home screen
3. Paste this test scenario:

```
Severe heatwave alert issued for District 4.
Temperatures expected to spike to 42°C in the next hour.
A multi-vehicle accident has completely blocked Highway 9 near the Thatta Bypass.
```

4. Tap **"Analyze & Protect Supply Chain"**
5. Watch the agent pipeline stream live — each subagent step appears in real time
6. A **push notification** will arrive on your phone when the alert is dispatched
7. Navigate to **Fleet** → tap a shipment to see the before/after map
8. Navigate to **Risk Forecast** → tap **Run Now** to run the Predictive Risk Agent

---

## Predictive Risk Agent (Standalone)

The predictive pipeline can also be triggered independently:

```bash
curl -X POST http://localhost:8000/api/predict
```

Or stream it:
```bash
curl -N "http://localhost:8000/api/predict/stream"
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `uv: command not found` | Install `uv`: `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `ANTHROPIC_API_KEY not set` | Add it to `hackathone/.env` |
| Mobile app can't reach backend | Use your machine's local IP in `mobile/.env`, not `localhost` |
| Port 8000 already in use | Change `--port 8000` to `--port 8001` and update `mobile/.env` |
| Expo QR code not scanning | Make sure phone and laptop are on the same Wi-Fi network |
| Agent times out | The LLM calls can take 30–60 seconds — this is normal |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `langchain_agent/api/server.py` | FastAPI server — all REST + SSE endpoints |
| `langchain_agent/agent.py` | Main agent — 4 subagents for disaster mitigation |
| `langchain_agent/prediction_agent.py` | Predictive risk agent — 3 subagents |
| `langchain_agent/tools.py` | `update_crm_tool`, `notify_tool`, `write_summary_tool` |
| `langchain_agent/data/active_shipments.json` | Shipment CRM — updated by agent at runtime |
| `langchain_agent/data/notifications.json` | Notification log — written by agent at runtime |
| `langchain_agent/data/predictions.json` | Latest risk predictions — written by prediction agent |
| `mobile/src/hooks/useAgentStream.ts` | SSE stream consumer — drives all UI updates |
| `mobile/src/services/NotificationService.ts` | Local push notification service |

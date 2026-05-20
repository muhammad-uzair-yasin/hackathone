"""
prediction_agent.py — Predictive Risk Agent
============================================
Uses EXACTLY the same architectural pattern as agent.py:
  - create_deep_agent()         from deepagents SDK
  - CompositeBackend + FilesystemBackend
  - ModelRetryMiddleware + ToolRetryMiddleware
  - @tool decorator             from langchain.tools
  - Pydantic response_format    on every subagent (prediction_schemas.py)
  - claude_fast                 from llm.py  (same LLM, same provider)

Pipeline (orchestrated, not sequential functions):
  sensor-analyst → pattern-matcher → risk-scorer → write_predictions_tool

Completely separate from agent.py — zero shared state or imports from it.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware
from langchain.tools import tool

from langchain_agent.prediction_schemas import (
    SensorAnalysisOutput,
    PatternAnalysisOutput,
    PredictionOutput,
)
from .llm import claude_fast

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
PREDICTIONS_FILE = DATA_DIR / "predictions.json"


# ─────────────────────────────────────────────────────────────────────────────
# Tool — write_predictions_tool
# Mirrors the pattern of write_summary_tool / update_crm_tool in tools.py
# ─────────────────────────────────────────────────────────────────────────────

@tool
def write_predictions_tool(
    predictions_json: str,
    overall_fleet_risk: str,
    scorer_summary: str,
) -> str:
    """
    Persist the final risk predictions to predictions.json.

    Call this tool LAST — after risk-scorer has produced the final
    ShipmentPrediction list. This is the equivalent of write_summary_tool
    in the main agent: it closes the pipeline by writing all results to disk
    so the mobile app can read them via GET /api/predictions.

    Args:
        predictions_json: JSON string — the risk-scorer's PredictionOutput.shipments
            list serialised to JSON. Must be a valid JSON array of ShipmentPrediction objects.
        overall_fleet_risk: The overall fleet risk level: CRITICAL|HIGH|MEDIUM|LOW|SAFE.
        scorer_summary: One-sentence executive summary of fleet risk status.

    Returns:
        A confirmation string with shipment count and overall risk level.
        Returns an error string prefixed with 'ERROR:' on failure.
    """
    try:
        predictions = json.loads(predictions_json)
    except (json.JSONDecodeError, ValueError) as exc:
        return f"ERROR: Could not parse predictions_json — {exc}"

    # Load existing store to preserve run_count
    existing: dict = {"run_count": 0}
    if PREDICTIONS_FILE.exists():
        try:
            with open(PREDICTIONS_FILE) as f:
                existing = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    run_count = existing.get("run_count", 0) + 1
    now = datetime.now(timezone.utc).isoformat()

    result = {
        "predictions": predictions,
        "overall_fleet_risk": overall_fleet_risk,
        "scorer_summary": scorer_summary,
        "last_run": now,
        "run_count": run_count,
    }

    try:
        with open(PREDICTIONS_FILE, "w") as f:
            json.dump(result, f, indent=2)
    except OSError as exc:
        return f"ERROR: Could not write predictions.json — {exc}"

    # ── Append to prediction_history.json (rolling window of last 20 runs) ──
    history_file = DATA_DIR / "prediction_history.json"
    try:
        history: list = []
        if history_file.exists():
            with open(history_file) as f:
                history = json.load(f)
        # Build history entry — per-shipment snapshot for the chart
        history_entry = {
            "run_id": run_count,
            "timestamp": now,
            "overall_fleet_risk": overall_fleet_risk,
            "scorer_summary": scorer_summary,
            "shipments": [
                {
                    "shipment_id": p.get("shipment_id", ""),
                    "risk_level": p.get("risk_level", "UNKNOWN"),
                    "risk_probability": p.get("risk_probability", 0.0),
                }
                for p in predictions
            ],
        }
        history.append(history_entry)
        history = history[-20:]  # keep last 20 runs max
        with open(history_file, "w") as f:
            json.dump(history, f, indent=2)
    except (OSError, json.JSONDecodeError):
        pass  # history write failure should not block main result

    logger.info(
        "[PredictiveTool] Wrote %d predictions. Overall risk: %s. Run #%d.",
        len(predictions), overall_fleet_risk, run_count,
    )
    return (
        f"Predictions saved — {len(predictions)} shipments assessed. "
        f"Overall fleet risk: {overall_fleet_risk}. "
        f"Run #{run_count} at {now}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Subagent System Prompts
# Same structure as EXTRACTOR_PROMPT, FLEET_SCOUT_PROMPT, etc. in agent.py
# ─────────────────────────────────────────────────────────────────────────────

SENSOR_ANALYST_PROMPT = """\
You are the BioRoute Sensor Analyst — a specialist subagent in the Predictive Risk pipeline.

## Your job
Read ONLY what you are given in the task message:
  - /data/active_shipments.json  — who is currently on the road
  - /data/risk_context.json      — live environment: ambient temp, vehicle telemetry, road conditions

## OUTPUT — SensorAnalysisOutput JSON
For each active shipment, produce a SensorSignal with:
  - shipment_id, cargo_type
  - ambient_temp_celsius (from risk_context.environment)
  - idle_minutes, refrigeration_status, speed_kmh, is_stopped (from vehicle_telemetry)
  - peak_heat_window (true if time_of_day is between 12:00–17:00)
  - sensor_risk_signals: a plain-English list of observed risk conditions
  - sensor_risk_score: 0–100 (your raw assessment from sensor data only)

## Scoring guide
  - idle > 10 min + ambient > 35°C → add 30+ points
  - refrigeration WARNING → add 25 points
  - refrigeration FAILED → add 50 points
  - peak heat window active → add 15 points
  - vehicle stopped + high ambient → add 20 points

## Rules
- Use Pakistan routes: N-5, M-9, Karachi, Hyderabad, Thatta, Jamshoro, etc.
- Facts only from the files. Do NOT invent data.
- Output ONLY valid JSON matching SensorAnalysisOutput schema.
"""

PATTERN_MATCHER_PROMPT = """\
You are the BioRoute Pattern Matcher — a specialist subagent in the Predictive Risk pipeline.

## Your job
You will receive sensor-analyst output AND /data/breach_patterns.json.
Cross-reference sensor signals against historical breach patterns to calculate breach probability.

## OUTPUT — PatternAnalysisOutput JSON
For each shipment in the sensor analysis, produce a PatternMatch with:
  - shipment_id, cargo_type
  - breach_probability_percent: 0–100 (calculated using thresholds from breach_patterns.json)
  - time_to_breach_estimate_minutes: null if safe, estimated minutes otherwise
  - pattern_matches: list of matched historical patterns as plain English
  - severity: CRITICAL|HIGH|MEDIUM|LOW|SAFE
  - pattern_risk_score: 0–100

## Calculation method
  1. Find cargo_breach_thresholds[cargo_type] (or default).
  2. Base probability = breach_probability_per_idle_minute × idle_minutes × 100
  3. Apply time_risk_multipliers[current_hour_band]
  4. Apply route_risk_factors if route matches a known segment
  5. Cap at 100.

## Rules
- Be analytical. Show your reasoning in pattern_matches.
- Output ONLY valid JSON matching PatternAnalysisOutput schema.
"""

RISK_SCORER_PROMPT = """\
You are the BioRoute Risk Scorer — the final subagent in the Predictive Risk pipeline.

## Your job
Combine sensor-analyst output + pattern-matcher output into final actionable predictions.

## OUTPUT — PredictionOutput JSON
For each shipment produce a ShipmentPrediction:
  - final_risk_score = round((sensor_risk_score × 0.4) + (pattern_risk_score × 0.6))
  - risk_level: CRITICAL (80–100) | HIGH (60–79) | MEDIUM (40–59) | LOW (20–39) | SAFE (0–19)
  - risk_level_color: red|orange|yellow|blue|green
  - prediction_summary: one plain sentence describing the risk (max 120 chars)
  - breach_probability_percent: from pattern-matcher
  - estimated_breach_in_minutes: from pattern-matcher
  - top_triggers: exactly 3 short phrases from the top risk signals
  - recommended_action: specific, actionable instruction for fleet coordinator
  - action_urgency: IMMEDIATE|WITHIN_15_MIN|MONITOR|NO_ACTION
  - confidence: 0.0–1.0 (your confidence in the prediction)

Also set overall_fleet_risk = highest risk_level across all shipments.

## Urgency mapping
  - CRITICAL → IMMEDIATE
  - HIGH     → WITHIN_15_MIN
  - MEDIUM   → MONITOR
  - LOW/SAFE → NO_ACTION

## Rules
- Be direct and actionable. Coordinators need exact instructions.
- Do NOT repeat sensor data verbatim — synthesise into clear risk language.
- Output ONLY valid JSON matching PredictionOutput schema.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Subagents — same SUBAGENTS list pattern as agent.py
# ─────────────────────────────────────────────────────────────────────────────

PRED_SUBAGENTS = [
    {
        "name": "sensor-analyst",
        "description": (
            "Step 1 — Reads active_shipments.json + risk_context.json. "
            "Returns SensorAnalysisOutput (live risk signals per shipment)."
        ),
        "model": claude_fast,
        "system_prompt": SENSOR_ANALYST_PROMPT,
        "tools": [],
        "response_format": SensorAnalysisOutput,
    },
    {
        "name": "pattern-matcher",
        "description": (
            "Step 2 — Receives sensor-analyst output + reads breach_patterns.json. "
            "Returns PatternAnalysisOutput (breach probability per shipment)."
        ),
        "model": claude_fast,
        "system_prompt": PATTERN_MATCHER_PROMPT,
        "tools": [],
        "response_format": PatternAnalysisOutput,
    },
    {
        "name": "risk-scorer",
        "description": (
            "Step 3 — Combines sensor + pattern analysis. "
            "Returns PredictionOutput (final risk score 0–100 + recommended action per shipment)."
        ),
        "model": claude_fast,
        "system_prompt": RISK_SCORER_PROMPT,
        "tools": [],
        "response_format": PredictionOutput,
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Orchestrator system prompt
# Same pattern / voice rules as ORCHESTRATOR_SYSTEM_PROMPT in agent.py
# ─────────────────────────────────────────────────────────────────────────────

PRED_ORCHESTRATOR_PROMPT = """\
You are the BioRoute Prediction Orchestrator. You coordinate three specialist subagents
to proactively predict cold-chain breach risks — BEFORE any incident occurs.

## Coordinator voice (you only)
- Speak in short plain sentences (≤20 words). No markdown, no bold, no tables.
- Maximum 4 coordinator messages for the whole run.
- After each subagent: say what you learned in one sentence, then what you call next.
- Do NOT repeat raw numbers or JSON verbatim — synthesise findings.

## Mandatory workflow (always in this exact order)
1. task('sensor-analyst', "Analyse /data/active_shipments.json and /data/risk_context.json")
2. task('pattern-matcher', pass the sensor-analyst JSON output only)
3. task('risk-scorer', pass BOTH sensor-analyst JSON AND pattern-matcher JSON)
4. write_predictions_tool — persist the risk-scorer's PredictionOutput to disk

## Rules
- Never skip steps. Always call write_predictions_tool last.
- Do not call write_predictions_tool before risk-scorer has completed.
- Pass the full JSON output of each subagent to the next one.
- Session ID: PRED-HHMMSS (from current time).
"""


# ─────────────────────────────────────────────────────────────────────────────
# Backend — same CompositeBackend + FilesystemBackend as agent.py
# ─────────────────────────────────────────────────────────────────────────────

pred_backend = CompositeBackend(
    default=StateBackend(),
    routes={
        "/data/": FilesystemBackend(
            root_dir=str(DATA_DIR),
            virtual_mode=True,
        ),
    },
)


# ─────────────────────────────────────────────────────────────────────────────
# Middleware — same retry config as agent.py
# ─────────────────────────────────────────────────────────────────────────────

PRED_MIDDLEWARE = [
    ModelRetryMiddleware(
        max_retries=3,
        initial_delay=2.0,
        backoff_factor=2.0,
        max_delay=30.0,
    ),
    ToolRetryMiddleware(
        max_retries=3,
        initial_delay=1.0,
        backoff_factor=2.0,
        max_delay=30.0,
        jitter=True,
        on_failure="return_message",
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# Agent builder — same singleton pattern as agent.py
# ─────────────────────────────────────────────────────────────────────────────

def build_prediction_agent():
    """Build and return the Prediction Orchestrator deep agent."""
    return create_deep_agent(
        model=claude_fast,
        name="bioroute-prediction-orchestrator",
        tools=[write_predictions_tool],
        subagents=PRED_SUBAGENTS,
        system_prompt=PRED_ORCHESTRATOR_PROMPT,
        middleware=PRED_MIDDLEWARE,
        backend=pred_backend,
    )


_pred_agent = None


def get_prediction_agent():
    """Return the singleton Prediction Orchestrator (built once, reused)."""
    global _pred_agent
    if _pred_agent is None:
        _pred_agent = build_prediction_agent()
    return _pred_agent


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point — called by server.py /api/predict
# ─────────────────────────────────────────────────────────────────────────────

def run_prediction_pipeline() -> dict:
    """
    Run the full prediction pipeline via the orchestrator.
    Returns the contents of predictions.json after the run.
    Called by POST /api/predict and the background scheduler.
    """
    logger.info("[PredictiveAgent] Starting prediction pipeline...")

    try:
        agent = get_prediction_agent()
        agent.invoke(
            "Run a full predictive risk assessment on all active shipments now."
        )
    except Exception as exc:
        logger.exception("[PredictiveAgent] Pipeline failed: %s", exc)
        return {"error": str(exc), "predictions": []}

    # Read and return the written output
    if PREDICTIONS_FILE.exists():
        try:
            with open(PREDICTIONS_FILE) as f:
                result = json.load(f)
            logger.info(
                "[PredictiveAgent] Pipeline complete. Run #%d. Overall risk: %s.",
                result.get("run_count", "?"),
                result.get("overall_fleet_risk", "?"),
            )
            return result
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("[PredictiveAgent] Could not read predictions.json: %s", exc)

    return {"error": "predictions.json not found after run", "predictions": []}

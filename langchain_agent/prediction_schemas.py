"""
prediction_schemas.py — Pydantic contracts for the Predictive Risk Agent pipeline.

Mirrors the exact pattern of schemas.py used by the main agent.
Each subagent has:
  - *Input model  — what the orchestrator passes via task()
  - *Output model — structured response_format (Pydantic, validated by the framework)
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Subagent 1 — sensor-analyst
# Reads: active_shipments.json + risk_context.json
# ─────────────────────────────────────────────────────────────────────────────

class SensorSignal(BaseModel):
    """Risk signals for a single shipment from live sensor data."""

    shipment_id: str = Field(description="Shipment identifier, e.g. 'SHP-882'.")
    cargo_type: str = Field(description="Type of medical cargo, e.g. 'Insulin'.")
    ambient_temp_celsius: float = Field(
        description="Current outdoor ambient temperature in Celsius."
    )
    idle_minutes: int = Field(
        description="How many minutes the vehicle has been stationary."
    )
    refrigeration_status: Literal["ACTIVE", "WARNING", "FAILED"] = Field(
        description="Current state of the vehicle's refrigeration unit."
    )
    speed_kmh: int = Field(description="Current vehicle speed in km/h.")
    is_stopped: bool = Field(description="True if vehicle is not moving.")
    peak_heat_window: bool = Field(
        description="True if current time falls in the peak heat window (12:00–17:00)."
    )
    sensor_risk_signals: List[str] = Field(
        default_factory=list,
        description="Plain-English list of detected risk signals from sensor data.",
    )
    sensor_risk_score: int = Field(
        description="Raw sensor risk score 0–100. 0=no risk, 100=critical failure imminent.",
        ge=0, le=100,
    )


class SensorAnalysisOutput(BaseModel):
    """OUTPUT from sensor-analyst — one SensorSignal per active shipment."""

    shipments: List[SensorSignal] = Field(
        description="Sensor analysis results for all active shipments."
    )
    analysis_summary: str = Field(
        description="One sentence summarising the overall sensor risk picture.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Subagent 2 — pattern-matcher
# Reads: sensor-analyst output + breach_patterns.json
# ─────────────────────────────────────────────────────────────────────────────

class PatternMatch(BaseModel):
    """Historical breach pattern match for a single shipment."""

    shipment_id: str = Field(description="Shipment identifier.")
    cargo_type: str = Field(description="Type of medical cargo.")
    breach_probability_percent: int = Field(
        description="Probability of cold-chain breach in the next 60 minutes, 0–100.",
        ge=0, le=100,
    )
    time_to_breach_estimate_minutes: Optional[int] = Field(
        default=None,
        description="Estimated minutes until breach occurs. Null if not at risk.",
    )
    pattern_matches: List[str] = Field(
        default_factory=list,
        description="Historical patterns that match this shipment's current conditions.",
    )
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"] = Field(
        description="Severity level based on pattern analysis."
    )
    pattern_risk_score: int = Field(
        description="Pattern-derived risk score 0–100.",
        ge=0, le=100,
    )


class PatternAnalysisOutput(BaseModel):
    """OUTPUT from pattern-matcher — one PatternMatch per active shipment."""

    shipments: List[PatternMatch] = Field(
        description="Pattern analysis results for all active shipments."
    )
    highest_risk_shipment_id: Optional[str] = Field(
        default=None,
        description="Shipment ID with the highest breach probability.",
    )
    pattern_summary: str = Field(
        description="One sentence summarising the pattern-matching results.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Subagent 3 — risk-scorer
# Combines sensor + pattern outputs into final actionable predictions
# ─────────────────────────────────────────────────────────────────────────────

class ShipmentPrediction(BaseModel):
    """Final risk prediction for a single shipment — written to predictions.json."""

    shipment_id: str = Field(description="Shipment identifier.")
    cargo_type: str = Field(description="Type of medical cargo.")
    final_risk_score: int = Field(
        description=(
            "Combined risk score 0–100. "
            "Formula: (sensor_risk_score × 0.4) + (pattern_risk_score × 0.6), rounded."
        ),
        ge=0, le=100,
    )
    risk_level: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"] = Field(
        description="Risk level derived from final_risk_score."
    )
    risk_level_color: Literal["red", "orange", "yellow", "blue", "green"] = Field(
        description="UI color indicator: red=CRITICAL, orange=HIGH, yellow=MEDIUM, blue=LOW, green=SAFE."
    )
    prediction_summary: str = Field(
        description="One human-readable sentence describing the predicted risk.",
    )
    breach_probability_percent: int = Field(
        description="Final breach probability 0–100.",
        ge=0, le=100,
    )
    estimated_breach_in_minutes: Optional[int] = Field(
        default=None,
        description="Estimated minutes to breach. Null if not at risk.",
    )
    top_triggers: List[str] = Field(
        description="Top 3 risk triggers as short phrases.",
        max_length=3,
    )
    recommended_action: str = Field(
        description="Specific, actionable recommendation for the fleet coordinator.",
    )
    action_urgency: Literal["IMMEDIATE", "WITHIN_15_MIN", "MONITOR", "NO_ACTION"] = Field(
        description="How urgently the recommended action should be taken."
    )
    confidence: float = Field(
        description="AI confidence in this prediction, 0.0–1.0.",
        ge=0.0, le=1.0,
    )


class PredictionOutput(BaseModel):
    """OUTPUT from risk-scorer — final predictions for all shipments."""

    shipments: List[ShipmentPrediction] = Field(
        description="Final risk predictions for all active shipments."
    )
    overall_fleet_risk: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE"] = Field(
        description="Highest risk level across all shipments."
    )
    scorer_summary: str = Field(
        description="One sentence executive summary of fleet risk status.",
    )

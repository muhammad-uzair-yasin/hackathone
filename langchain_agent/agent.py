"""
agent.py — Main Deep Agent definition using LangChain Deep Agents SDK.

Architecture:
  - 1 Main Orchestrator (create_deep_agent)
  - 3 Specialized Subagents with structured Pydantic response_format
  - Full middleware stack: retry, fallback, summarization, todo planning
  - CompositeBackend: StateBackend (session scratch) + FilesystemBackend (data files)

Why this design:
  - Subagents with response_format guarantee clean JSON between steps (no parsing failures)
  - ToolRetryMiddleware + ModelRetryMiddleware handle OpenAI rate limits automatically
  - ModelFallbackMiddleware switches to gpt-4o-mini if gpt-4o is unavailable
  - SummarizationMiddleware keeps context lean for long runs
  - FilesystemBackend gives agent direct read_file access to active_shipments.json
"""

from __future__ import annotations

from pathlib import Path
from .llm import claude_fast
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, FilesystemBackend


from langchain_agent.schemas import HazardExtraction, ImpactAnalysis, ActionPlan
from langchain_agent.tools import update_crm_tool, notify_tool, write_state_log_tool

# ─── Paths ───────────────────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent / "data"

# ─── Subagent System Prompts ─────────────────────────────────────────────────

EXTRACTOR_PROMPT = """\
You are the Hazard Extractor Agent for BioRoute Cold-Chain Logistics.

YOUR ONLY JOB: Read unstructured or semi-structured text (news articles, weather
alerts, traffic reports, social media posts) and extract ONLY the operational
hazard data relevant to road logistics. Do NOT write a generic summary of the text.

## What you must extract:
1. Whether a hazard is actually present (vs. routine news)
2. The exact location (district name, highway number, intersection)
3. The type of hazard (heatwave, traffic block, flooding, storm, road closure, fuel spike)
4. The severity with measurable specifics (temperature in °C, delay in minutes/hours)
5. Which specific routes or highways are blocked or affected
6. How long the hazard is expected to last

## What you must NOT do:
- Do NOT summarize the article generally
- Do NOT include information unrelated to logistics (political news, sports, etc.)
- Do NOT make assumptions — extract only what is explicitly stated or strongly implied
- Do NOT output anything except the structured JSON

## Input format:
You will receive raw text that may be messy, informal, or incomplete.
The text may be a news headline, a social media post, a weather advisory, or a
mix of formats. Extract what you can; mark unknown fields as null.

## Output:
Return ONLY a valid JSON object matching the HazardExtraction schema.
Do not include markdown formatting, code blocks, or any text outside the JSON.

Example output:
{
  "hazard_detected": true,
  "location": "District 4",
  "hazard_type": "Heatwave",
  "severity_level": "CRITICAL",
  "severity_details": "42°C expected for next 3 hours, peak at 2:00 PM",
  "affected_routes": ["Highway 9", "Highway 11"],
  "temperature_celsius": 42.0,
  "estimated_duration_minutes": 180,
  "raw_summary": "Heatwave at 42°C and traffic block on Highway 9 in District 4."
}
"""

ANALYZER_PROMPT = """\
You are the Impact Analyzer Agent for BioRoute Cold-Chain Logistics.

YOUR ONLY JOB: Given an extracted hazard JSON and access to the live shipment
database (active_shipments.json), determine WHICH active shipment is at risk and
calculate the exact operational and financial impact.

## Access to data:
Use the read_file tool to read '/data/active_shipments.json' for live shipment data.
Use the read_file tool to read '/data/business_context.md' for operational rules.
Do NOT guess shipment details — always read the actual files.

## Critical Instructions for your Reasoning:
- DO NOT copy-paste, echo, or recite the shipment database or the business rules in your reasoning.
- The user cannot read giant blocks of JSON or markdown. Keep your reasoning brief.
- Only output your step-by-step thinking about which shipment is at risk.

## How to calculate impact:
1. Find shipments whose primary_route OR destination district matches the hazard location.
2. For each matching shipment, check: is the cargo temperature-sensitive?
3. If temperature hazard: compare external temp vs. max_idling_temp_threshold_celsius.
4. Calculate time_to_failure_minutes = max_safe_idle_minutes - estimated_current_idle_minutes.
   (Assume current_idle_minutes = 0 unless stated; use max_safe_idle_minutes directly.)
5. Calculate financial_consequence using the cargo_value_usd field.
6. Set risk_level:
   - CRITICAL: time_to_failure < 30 minutes OR ultra-critical cargo
   - HIGH: time_to_failure 30-60 minutes
   - MEDIUM: time_to_failure 60-120 minutes
   - LOW: no immediate spoilage risk

## Rules:
- If multiple shipments are at risk, select the one with the highest risk (lowest time_to_failure).
- If no shipment is at risk, set impact_detected = false.
- Be precise with numbers — always show your calculation logic in operational_impact.

## Output:
Return ONLY a valid JSON object matching the ImpactAnalysis schema.
Do not include markdown formatting or any text outside the JSON.
"""

ACTION_PLANNER_PROMPT = """\
You are the Action Planner Agent for BioRoute Cold-Chain Logistics.

YOUR ONLY JOB: Given an impact analysis JSON, generate the precise action plan
that the orchestrator needs to execute the emergency reroute.

## Access to data:
Use the read_file tool to read '/data/business_context.md' for rerouting protocols.
The impact analysis JSON you receive contains the backup_facility and backup_route
fields — use those exact values in your database_update_payload.

## Critical Instructions for your Reasoning:
- DO NOT copy-paste or echo the business rules in your reasoning. Keep it brief.

## Decision rules:
- If risk_level is CRITICAL or HIGH AND requires_immediate_action is true:
  → urgency = "IMMEDIATE", action = emergency reroute to backup_facility
- If risk_level is MEDIUM:
  → urgency = "SOON", consider reroute but include monitoring as alternative
- If risk_level is LOW:
  → urgency = "MONITOR", no reroute needed, just alert the driver

## Notification requirements (from business context):
The notification_draft MUST include ALL of these:
  1. Shipment ID and cargo type
  2. What hazard was detected and where
  3. Why immediate action is required
  4. New destination (if rerouting)
  5. Estimated new ETA (say 'TBD - calculating' if unknown)
  6. Emergency contact: BioRoute Control Center: +92-21-9876543

Keep the tone professional but urgent. This goes to hospital administration.

## Output:
Return ONLY a valid JSON object matching the ActionPlan schema.
Do not include markdown formatting or any text outside the JSON.
"""

# ─── Subagent Definitions ─────────────────────────────────────────────────────

SUBAGENTS = [
    {
        "name": "hazard-extractor",
        "description": (
            "Extracts structured hazard data from raw unstructured text such as news articles, "
            "weather alerts, or traffic reports. Use this subagent FIRST, before any analysis. "
            "It returns a JSON object with location, hazard type, severity, and affected routes."
        ),
        "model": claude_fast,
        "system_prompt": EXTRACTOR_PROMPT,
        "tools": [],
        "response_format": HazardExtraction,
    },
    {
        "name": "impact-analyzer",
        "description": (
            "Analyzes the real-world impact of an extracted hazard on active BioRoute shipments. "
            "Reads the live shipment database and business rules, then calculates which shipment "
            "is at risk, time to cargo failure, and financial consequence. "
            "Use this subagent SECOND, after hazard-extractor has returned results."
        ),
        "model": claude_fast,
        "system_prompt": ANALYZER_PROMPT,
        "tools": [],
        "response_format": ImpactAnalysis,
    },
    {
        "name": "action-planner",
        "description": (
            "Generates the exact action plan for an emergency reroute: the database update payload "
            "(new status, destination, route) and the full notification draft for the hospital admin. "
            "Use this subagent THIRD, after impact-analyzer has returned results. "
            "This subagent produces the exact inputs needed for update_crm_tool and notify_tool."
        ),
        "model": claude_fast,
        "system_prompt": ACTION_PLANNER_PROMPT,
        "tools": [],
        "response_format": ActionPlan,
    },
]

# ─── Orchestrator System Prompt ───────────────────────────────────────────────

ORCHESTRATOR_SYSTEM_PROMPT = """\
You are the BioRoute Cold-Chain Emergency Orchestrator — an autonomous AI system
that protects temperature-sensitive medical cargo from environmental hazards.

## Narration rule — CRITICAL
Before EVERY action you take, output a short 1-2 sentence message explaining
what you are about to do and WHY. This commentary streams live to operators
watching a dashboard. Be specific and human — not generic.

Good examples:
  "I've received a news alert mentioning District 4. Starting hazard extraction
   to find out if any routes or temperatures are dangerous for our shipments."

  "The extractor found a 42°C heatwave on Highway 9. Delegating to the
   impact analyzer to check if any active shipments use that route."

  "SHP-882 carries insulin on Highway 9 — it will spoil in 45 minutes.
   Calling the action planner to generate the emergency reroute now."

  "Action plan confirmed: rerouting SHP-882 to District 3 Cold-Vault.
   Updating the CRM database now."

  "CRM updated. Sending emergency notification to District 4 General Hospital."

Bad examples (too generic, do NOT do this):
  "Processing request..."   ← never say this
  "Step 2 starting."        ← never say this

## Mandatory workflow — follow in EXACT order:

### Step 1: Narrate + Plan
Say what you just received and what your plan is. Then call write_todos.
IMPORTANT: Generate a simple, dynamically sized todo list of 1-liners. Only include the exact steps you actually need to take based on the situation. Name the subagent if you plan to use one. Do not hardcode to 5 steps, just list exactly what is needed.
Example:
[
  "Extract hazard data using 'hazard-extractor' subagent",
  "Check active shipments using 'impact-analyzer' subagent",
  "Generate reroute using 'action-planner' subagent"
]

### Step 2: Narrate + Extract Hazard
Explain what you are looking for in the text. Then delegate to 'hazard-extractor'.

### Step 3: Narrate + Impact Check
Report what the extractor found. Explain why you are (or are not) checking impact.
Then delegate to 'impact-analyzer' if hazard_detected is true.

### Step 4: Narrate + Action Plan
Report what the impact analysis shows. Explain the urgency. Then delegate to
'action-planner' if impact_detected is true.

### Step 5: Narrate + Execute
Explain what you are about to write to the database and why. Call update_crm_tool.
Then explain the notification you are sending. Call notify_tool.
Then call write_state_log_tool.

### Step 6: Final Summary
Give a clear, concise human-readable summary of the complete pipeline result.

## Other rules:
- ALWAYS delegate to subagents via task() — never do their work yourself.
- ALWAYS call write_state_log_tool at the end.
- If a subagent fails, say so plainly and continue.
- Generate a session ID like 'REQ-HHMMSS' at the start.
"""

# ─── Backend — CompositeBackend ───────────────────────────────────────────────
# Routes:
#   /data/   → FilesystemBackend → langchain_agent/data/ (real files agent can read/write)
#   default  → StateBackend      → session-scoped scratch space

backend = CompositeBackend(
    default=StateBackend(),
    routes={
        "/data/": FilesystemBackend(
            root_dir=str(DATA_DIR),
            virtual_mode=True,   # blocks path traversal outside DATA_DIR
        ),
    },
)

from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware

# ─── Middleware Stack ─────────────────────────────────────────────────────────

MIDDLEWARE = [
    # Retry model calls on rate limits / transient failures (exp backoff)
    ModelRetryMiddleware(
        max_retries=3,
        initial_delay=2.0,
        backoff_factor=2.0,
        max_delay=30.0,
    ),

    # Retry tool calls on failures (handles flaky external state)
    ToolRetryMiddleware(
        max_retries=3,
        initial_delay=1.0,
        backoff_factor=2.0,
        max_delay=30.0,
        jitter=True,
        on_failure="return_message",   # LLM handles failure gracefully
    ),
]

# ─── Create the Agent ─────────────────────────────────────────────────────────

def build_agent():
    """
    Build and return the BioRoute Deep Agent.

    Called once at startup. Uses Pollinations AI (OpenAI-compatible)
    via the claude_fast LLM defined in llm.py — no OPENAI_API_KEY needed.
    """
    agent = create_deep_agent(
        model=claude_fast,
        name="bioroute-orchestrator",
        tools=[update_crm_tool, notify_tool, write_state_log_tool],
        subagents=SUBAGENTS,
        system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        middleware=MIDDLEWARE,
        backend=backend,
    )

    return agent


# Module-level singleton — built once, reused across all API requests
_agent = None

def get_agent():
    """Return the singleton agent, building it on first call."""
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent

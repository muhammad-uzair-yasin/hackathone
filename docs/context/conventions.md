# Tech Decisions & Code Patterns — BioRoute Project

**Last Updated:** 2026-06-02

---

## Architecture Decisions

### 1. Multi-Agent Orchestration (LangChain Deep Agents)

**Decision:** Use LangChain Deep Agents SDK (Google Antigravity) for multi-agent orchestration.

**Rationale:**
- Native support for sequential + parallel subagent execution
- Built-in Pydantic schema validation on outputs
- Structured streaming (astream_events) for real-time SSE
- Middleware for retries + error handling

**Trade-offs:**
- Requires Pydantic models for every subagent output
- Less flexible than manual agentic loops, but more robust

**Related files:**
- `langchain_agent/agent.py` — Main orchestrator
- `langchain_agent/prediction_agent.py` — Prediction orchestrator
- `langchain_agent/schemas.py` — Output schemas

---

### 2. Intent Classification Before Pipeline

**Decision:** Classify user input as "alert" or "chat" before running the full agent pipeline.

**Rationale:**
- Avoids wasting LLM tokens on casual messages ("hi", "what can you do?")
- Routes to lightweight response for non-emergency inputs
- Improves user experience (fast chat responses vs. 30–60s agent runs)

**Implementation:**
- Single LLM call in `_classify_intent()` (server.py)
- If "chat" → return canned response, skip pipeline
- If "alert" → run full 4-subagent flow

**Related code:**
- `langchain_agent/api/server.py::_classify_intent()`

---

### 3. Action Simulation via JSON File Tools

**Decision:** Simulate CRM actions (database updates) + notifications as JSON file writes, not real API calls.

**Rationale:**
- Demo-safe: no risk of modifying real systems
- Fully testable: JSON files are Git-trackable
- Judge-visible: before/after state saved in `summary.md`
- Aligns with hackathon grading (traceable AI decisions)

**Implementation:**
- `update_crm_tool`: swaps route in `active_shipments.json`, logs before/after
- `notify_tool`: appends 4 email/SMS drafts to `notifications.json`
- `write_summary_tool`: embeds full pipeline JSON in HTML comment of `summary.md`

**Related files:**
- `langchain_agent/tools.py` (all three tools)

---

### 4. Real-Time SSE Streaming for Mobile

**Decision:** Stream every agent step (coordinator message, subagent start/done, tool call/result) as Server-Sent Events.

**Rationale:**
- Mobile app needs real-time feedback (agent steps appear as they happen)
- SSE simpler than WebSocket for one-way streaming
- Browser/React Native SSE support is native (no extra library)
- Fits use case: user watches agent run, app shows live timeline

**Implementation:**
- FastAPI `StreamingResponse` with `async def` generator
- `sse_event()` helper formats each event
- Client-side: `useAgentStream` hook consumes EventSource, parses events
- Filtering logic: drops noise, dedupes coordinator messages, limits output

**Related files:**
- `langchain_agent/api/server.py::_run_agent_stream()`
- `mobile/src/hooks/useAgentStream.ts`

---

### 5. Predictive Risk Pipeline (Separate Agent)

**Decision:** Implement prediction pipeline as a completely separate orchestrator (not shared state with main agent).

**Rationale:**
- Prediction runs on a schedule (background), independent of main pipeline
- No contention for resources
- Can be tested/debugged in isolation
- Cleaner code (no conditional logic in main orchestrator)

**Structure:**
- `prediction_agent.py` mirrors `agent.py` pattern
- 3 subagents: sensor-analyst → pattern-matcher → risk-scorer
- Same Deep Agents SDK, same retry/error middleware

**Related files:**
- `langchain_agent/prediction_agent.py`
- `langchain_agent/prediction_schemas.py`

---

### 6. Notification Bundling (4-Audience Pattern)

**Decision:** Bundle 4 separate notifications (hospital, driver, coordinator, owner) into one tool call.

**Rationale:**
- Action Planner decides all 4 messages in one pass
- Ensures consistency (all 4 get the same shipment ID, urgency)
- Reduces tool call overhead
- Easier to validate: one schema for all 4

**Implementation:**
- `ActionPlan.notification_simulation` contains `driver`, `hospital`, `coordinator` sub-objects
- `notify_tool` unpacks all 4, writes each as separate record to `notifications.json`
- Mobile app can filter by `recipient_type` to show relevant alerts

**Related files:**
- `langchain_agent/schemas.py::NotificationSimulation`
- `langchain_agent/tools.py::notify_tool()`

---

## Code Patterns

### Pattern 1: Subagent Output Validation

**Pattern:**
```python
# In agent.py:
{
    "name": "hazard-detector",
    "response_format": HazardExtraction,  # Pydantic model
}

# In schemas.py:
class HazardExtraction(BaseModel):
    hazard_detected: bool
    location: str
    severity_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    # ... more fields
```

**Why:** Deep Agents SDK validates every subagent response against the schema. Invalid JSON is rejected before reaching the orchestrator.

---

### Pattern 2: SSE Event Emission

**Pattern:**
```python
# Generic format:
def sse_event(event_type: str, data: dict) -> str:
    payload = json.dumps({
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        **data,
    })
    return f"data: {payload}\n\n"

# Usage:
yield sse_event("SUBAGENT_DONE", {
    "agent": "impact-analyzer",
    "status": "completed",
    "result": result_data,
})
```

**Why:** Consistent format, client-side parsing, timestamp + type for ordering.

---

### Pattern 3: Tool Return Format (JSON String)

**Pattern:**
```python
@tool
def update_crm_tool(...) -> str:
    # ... logic ...
    result = {
        "success": True,
        "before_state": {...},
        "after_state": {...},
        "message": "...",
    }
    return json.dumps(result, indent=2)
```

**Why:** Tools must return strings (not dicts). JSON serialization ensures LLM can parse results.

---

### Pattern 4: Mobile Hook for SSE Consumption

**Pattern:**
```typescript
// mobile/src/hooks/useAgentStream.ts
export const useAgentStream = (apiUrl: string) => {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  
  const stream = (input: string) => {
    const eventSource = new EventSource(`${apiUrl}/api/stream?input=${encodeURIComponent(input)}`);
    
    eventSource.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      setEvents(prev => [...prev, parsed]);
    };
  };
  
  return { events, stream };
};
```

**Why:** Reusable hook for all screens; decouples SSE logic from UI.

---

### Pattern 5: Mock Data Reset

**Pattern:**
```python
# In tools.py:
def reset_active_shipments_to_baseline() -> bool:
    with open(BASELINE_SHIPMENTS_FILE, "r") as f:
        data = json.load(f)
    data["last_updated"] = datetime.now().isoformat()
    with open(SHIPMENTS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    return True

# In server.py:
reset_active_shipments_to_baseline()  # Called before every agent run
```

**Why:** Ensures demo repeatability. Every run starts from a clean slate.

---

### Pattern 6: Nested Tool Call Chain

**Pattern:**
```
Orchestrator → write_todos (list steps)
            → task("hazard-detector", ...)
            → task("shipment-analyzer", ...)
            → task("impact-analyzer", ...)
            → task("action-planner", ...)
            → if impact_detected:
                  update_crm_tool(...)
                  notify_tool(...)
            → write_summary_tool(...)
```

**Why:** Ordered execution ensures dependencies are satisfied (e.g., impact analysis before action plan).

---

## Data Model Patterns

### Pattern 1: Shipment Record Structure

```json
{
  "shipment_id": "SHP-882",
  "cargo_type": "Insulin (Temp Critical)",
  "cargo_value_usd": 50000,
  "criticality_tier": "CRITICAL",
  "max_idling_temp_threshold_celsius": 38,
  "destination": "District 4 General Hospital",
  "current_status": "In Transit (On Time)",
  "route_name": "Primary Route",
  "route": [
    { "place": "Hub 1", "coordinates": [...] },
    { "place": "District 4 Junction", "coordinates": [...] }
  ],
  "eta_minutes": 45,
  "alternative_routes": [
    {
      "id": "A1",
      "name": "District 3 Bypass",
      "stops": [...],
      "eta_minutes": 60
    },
    ...
  ]
}
```

**Why:** Flat structure for easy JSON updates; alternative_routes pre-computed by orchestrator (action-planner picks best).

---

### Pattern 2: Notification Record Structure

```json
{
  "notification_id": "NOTIF-SHP-882-HOSP-143052",
  "timestamp": "2026-06-02T14:30:52Z",
  "shipment_id": "SHP-882",
  "recipient_type": "hospital",
  "recipient": "District 4 General Hospital, Pharmacy Admin",
  "urgency_level": "IMMEDIATE",
  "status": "SENT (simulated)",
  "channels": ["email"],
  "subject": "...",
  "message": "..."
}
```

**Why:** Flat, queryable records; timestamp allows app to filter recent notifications.

---

### Pattern 3: Session Record Embedding in Markdown

```markdown
# BioRoute Run Summary

_Session REQ-143052 · completed · 2026-06-02T14:30:52Z_

One plain-English summary paragraph here.

<!--BIOROUTE_PIPELINE
{
  "session_id": "REQ-143052",
  "timestamp": "2026-06-02T14:30:52Z",
  "status": "completed",
  "pipeline": {
    "step_1_hazard_extraction": { ... },
    "step_2_fleet_scout": { ... },
    ...
  }
}
-->
```

**Why:** Human-readable summary + machine-readable pipeline JSON in one file. HTML comment preserves structure for API parsing.

---

## Error Handling Patterns

### Pattern 1: Retry Logic (Middleware)

```python
MIDDLEWARE = [
    ModelRetryMiddleware(
        max_retries=3,
        initial_delay=2.0,
        backoff_factor=2.0,
    ),
]
```

**Why:** Handles transient LLM API errors. Exponential backoff: 2s → 4s → 8s.

---

### Pattern 2: Tool Error Returns

```python
if tool_name not in available_tools:
    return f"ERROR: Tool '{tool_name}' not found. Available: {list(available_tools.keys())}"
```

**Why:** Explicit error messages; orchestrator can decide to retry or fallback.

---

### Pattern 3: SSE Error Event

```python
yield sse_event("ERROR", {
    "message": "Agent pipeline failed at step 3",
    "error": str(exception),
    "step": 3,
})
```

**Why:** Mobile app sees error in real-time, can display graceful fallback UI.

---

## Performance Patterns

### Pattern 1: SSE Message Deduplication

```python
coord_seen: set[str] = set()
if key not in coord_seen:
    coord_seen.add(key)
    yield sse_event("COORDINATOR", {...})
```

**Why:** Prevents duplicate messages in the stream (same message from different parts of code).

---

### Pattern 2: JSON Parsing with Fallback

```python
def _parse_tool_payload(output) -> dict:
    if isinstance(output, dict):
        return output
    if isinstance(output, str):
        try:
            return json.loads(output)
        except json.JSONDecodeError:
            # Try to extract JSON substring
            start = output.find("{")
            end = output.rfind("}") + 1
            return json.loads(output[start:end])
    return {}
```

**Why:** Handles various tool return formats (dict, JSON string, raw text with embedded JSON).

---

## Testing Patterns

### Pattern 1: Pydantic Schema Validation

```python
# In test:
from langchain_agent.schemas import HazardExtraction

data = {"hazard_detected": True, "location": "District 4", ...}
result = HazardExtraction(**data)  # Raises ValidationError if invalid
```

**Why:** Ensures subagent outputs conform to contract before SSE emission.

---

### Pattern 2: Tool Output Verification

```python
# In test:
result = json.loads(update_crm_tool(...))
assert result["success"] is True
assert "before_state" in result
assert "after_state" in result
```

**Why:** Confirms tool side effects (database was actually updated).

---

## Documentation Patterns

### Pattern 1: Tool Docstring

```python
@tool
def update_crm_tool(...) -> str:
    """
    CRITICAL ACTION SIMULATION: Updates a shipment record in the live CRM database.
    
    This tool performs the actual system state change — it modifies the database
    record and returns a detailed before/after comparison to prove the action
    was executed.
    
    Args:
        shipment_id: The exact shipment ID, e.g. 'SHP-882'.
        new_status: The new operational status, e.g. 'Emergency Reroute'.
        ...
    
    Returns:
        A JSON string containing before_state and after_state.
    """
```

**Why:** LLM reads tool docstrings to decide when to call. Clear, detailed descriptions aid decision-making.

---

### Pattern 2: Subagent System Prompt

```python
EXTRACTOR_PROMPT = """\
You are the Hazard Detector for BioRoute Cold-Chain Logistics.

## Your job
Read ONLY the raw alert text in the task message.

## OUTPUT — HazardExtraction JSON
- ...

## Rules
- Facts only. Do NOT read files.
- Use Pakistan routes: N-5, M-3, M-9, ...
"""
```

**Why:** Clear role definition + constraints; prevents hallucinations.


# Task: Judge-friendly agent outputs (web UI only)

## Goal
Make agent pipeline outputs understandable for hackathon judges: short step summaries, filtered SSE stream, sidebar todo list, no raw JSON/file dumps. Mobile UI unchanged.

## Requirements
- Align Pydantic schemas with PROJECT_SCOPE fields + `display_summary` per subagent
- Rewrite orchestrator/subagent prompts: brief narration, no file echo, clear reroute rules
- Server: filter noisy SSE events; emit `STEP_SUMMARY`, `TODO_LIST`, `TODO_UPDATE`
- Web UI: 4-step pipeline stepper, enhanced streaming, todo sidebar from dedicated events

## Flow (Mermaid)

### Sequence
```mermaid
sequenceDiagram
    participant Web as webapp/index.html
    participant API as api/server.py
    participant Orch as bioroute-orchestrator
    participant Sub as subagents

    Web->>API: POST /api/analyze {input}
    API->>Orch: astream_events
    Orch-->>API: COORDINATOR (filtered)
    Orch-->>API: TODO_LIST via write_todos
    Orch->>Sub: task hazard-extractor
    Sub-->>API: SUBAGENT_DONE + STEP_SUMMARY
    Orch->>Sub: task impact-analyzer
    Sub-->>API: SUBAGENT_DONE + STEP_SUMMARY
    Orch->>Sub: task action-planner
    Sub-->>API: SUBAGENT_DONE + STEP_SUMMARY
    Orch-->>API: TOOL_CALL/RESULT (CRM, notify)
    API-->>Web: SSE STEP_SUMMARY, TODO_*, COMPLETE
```

### Per-route map
```mermaid
flowchart LR
    Web -->|POST| Analyze["/api/analyze"]
    Web -->|GET| Scenarios["/api/scenarios"]
    Web -->|GET| DB["/api/db"]
```

### End-to-end
```mermaid
flowchart TD
    A[User clicks Start] --> B[Random scenario]
    B --> C[SSE stream]
    C --> D{Event type}
    D -->|STEP_SUMMARY| E[Update 4-step stepper]
    D -->|TODO_LIST| F[Sidebar todos]
    D -->|SUBAGENT_DONE| G[Step card detail]
    D -->|TOOL_RESULT| H[Execution step]
    D -->|COMPLETE| I[Before/After panel]
```

## Acceptance Criteria
- [ ] No full `active_shipments.json` or `business_context.md` in web trace
- [ ] Each subagent shows one `display_summary` line on stepper
- [ ] Todo list appears in sidebar from `TODO_LIST` events
- [ ] Orchestrator emits ≤4 short reasoning lines (server filters duplicates/long text)
- [ ] Mobile files untouched

## Files to Change
- `langchain_agent/schemas.py`
- `langchain_agent/agent.py`
- `langchain_agent/api/server.py`
- `webapp/index.html`

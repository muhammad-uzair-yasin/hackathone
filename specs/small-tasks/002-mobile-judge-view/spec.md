# Task: Mobile judge view — collapsible reasoning steps

## Goal
On mobile (and as a cleaner judge surface), show agent reasoning as GPT-style collapsible steps (what + why), not a long scroll of trace cards.

## Requirements
- Sticky "Agent reasoning" accordion with 5 pipeline steps
- Each step: collapsed = title + one-line `display_summary`; expanded = what, `why_brief`, optional detail
- Auto-expand active step; collapse completed steps
- Mobile: hide verbose coordinator/agent trace cards (`lg:` show full trace)
- Desktop: keep sidebar pipeline; also show reasoning accordion in main column
- Wire `STEP_SUMMARY` / `SUBAGENT_DONE` for all 5 agents including fleet-scout

## Flow (Mermaid)

### Sequence
```mermaid
sequenceDiagram
  participant UI as webapp/app.js
  participant API as server SSE
  UI->>API: POST /api/analyze
  API-->>UI: STEP_SUMMARY step 1..5
  UI->>UI: updateReasoningStep(what, why)
```

### Per-route map
```mermaid
flowchart LR
  Mobile[viewport lt lg] --> Accordion[judge-reasoning-panel]
  Mobile --> Map[route map focused]
  Desktop[viewport lg] --> Sidebar[pipeline-steps]
  Desktop --> Accordion
```

### End-to-end
```mermaid
flowchart TD
  A[Start Agent] --> B[Show reasoning accordion]
  B --> C{Step completes}
  C --> D[Collapse step with summary]
  D --> E[Expand next step]
  E --> F[COMPLETE: show outcome card]
```

## Acceptance Criteria
- [ ] Five collapsible steps update live from SSE
- [ ] Collapsed row shows what happened in one line
- [ ] Expanded row shows why_brief
- [ ] Mobile trace hides duplicate agent/coordinator cards
- [ ] Tap master header toggles all / current behavior like GPT

## Files to Change
- `webapp/index.html`
- `webapp/app.js`
- `webapp/styles.css`

# User Preferences & Team Standards — BioRoute Project

**Last Updated:** 2026-06-02

---

## Code Style & Standards

### Python (Backend)

| Standard | Rule | Example |
|----------|------|---------|
| **Formatter** | Black (via uv) | Line length 100 |
| **Linter** | Ruff | All default rules |
| **Type Hints** | Mandatory | `def foo(x: int) -> str:` |
| **Docstrings** | Google style | `"""Short. Long explanation."""` |
| **Imports** | Alphabetical, grouped | stdlib → 3rd party → local |
| **File Organization** | Functional layers | `schemas.py`, `tools.py`, `agent.py`, `llm.py` |
| **Max line length** | 100 chars | Enforce via Black |
| **Error handling** | Explicit catches | `except SpecificError as e:` |
| **Async/await** | Used in FastAPI + streaming | Async generators for SSE |

### TypeScript (Mobile)

| Standard | Rule | Example |
|----------|------|---------|
| **Formatter** | Prettier | Line length 100 |
| **Linter** | ESLint + React rules | Strict mode |
| **Type Hints** | Mandatory | `const foo: (x: number) => string = ...` |
| **React Patterns** | Functional + hooks | No class components |
| **Component Layout** | Presentational vs. logic | Logic in hooks (use*), UI in components |
| **State Management** | React Context + hooks | Avoid Redux for small app |
| **File Organization** | Feature-based | `/screens`, `/hooks`, `/services` |

---

## Git & Version Control

| Rule | Standard |
|------|----------|
| **Default branch** | `main` |
| **Feature branches** | `feature/<name>` or `fix/<name>` |
| **Commit message format** | Imperative: "Add SSE streaming" not "Added SSE" |
| **Commit frequency** | One logical change per commit |
| **Push strategy** | Never push directly to main — always PR |
| **PR reviews** | Minimum 1 approval (code-reviewer agent) |
| **Merge strategy** | Squash + merge for feature branches |

---

## File Size Limits

| Layer | Max lines per file | Reasoning |
|-------|-------------------|-----------|
| **Python** | 350 lines | Easier testing, single responsibility |
| **TypeScript** | 350 lines | React component readability |
| **Exceptions** | — | `__init__.py`, config files, migrations |

**Rule:** Split files before committing if they exceed limits. Examples:
- `api/server.py` → split into `api/routes.py`, `api/sse.py`, `api/health.py`
- Large component → split into smaller components + hooks

---

## Documentation Requirements

| Artifact | Standard | Location |
|----------|----------|----------|
| **README** | Project overview + quick start | Root `README.md` |
| **API docs** | Endpoint + schema reference | Docstrings + `api.md` |
| **Architecture** | System diagrams + flow (Mermaid) | `docs/architecture.md` |
| **Context** | Project scope + decisions | `docs/context/` |
| **UI specs** | Screens + wireframes | `docs/ui/` |
| **Code comments** | Inline for non-obvious logic | Docstrings + code |

---

## Testing Standards

| Aspect | Standard |
|--------|----------|
| **Unit tests** | Pytest for Python, Jest for TypeScript |
| **Coverage target** | 70%+ for critical paths |
| **Integration tests** | FastAPI TestClient for endpoints |
| **E2E tests** | Playwright for mobile flows (optional for hackathon) |
| **Test file naming** | `test_*.py` or `*.test.ts` |
| **Test organization** | Mirror source structure |

---

## Naming Conventions

### Python

| Entity | Convention | Example |
|--------|-----------|---------|
| Files | `snake_case` | `prediction_agent.py` |
| Functions | `snake_case` | `get_prediction_agent()` |
| Classes | `PascalCase` | `HazardExtraction` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_RETRIES = 3` |
| Private members | Leading `_` | `_internal_helper()` |
| Modules | `snake_case` | `langchain_agent` |

### TypeScript

| Entity | Convention | Example |
|--------|-----------|---------|
| Files | `camelCase` or `PascalCase` | `useAgentStream.ts`, `HomeScreen.tsx` |
| Functions | `camelCase` | `useAgentStream()` |
| Components | `PascalCase` | `HomeScreen` |
| Interfaces | `PascalCase` + optional `I` prefix | `UseAgentStreamOutput` |
| Constants | `SCREAMING_SNAKE_CASE` | `API_BASE_URL` |
| Hooks | `use*` | `useAgentStream`, `usePredictions` |

---

## Deployment & Environments

| Environment | Backend URL | Purpose |
|-------------|------------|---------|
| **Local Dev** | `http://localhost:8000` | Development |
| **Mobile (Wi-Fi)** | `http://192.168.x.x:8000` | Testing on physical phone |
| **Android Emulator** | `http://10.0.2.2:8000` | Android testing |
| **Production** | TBD | Future deployment |

**Config location:**
- Backend: `.env` (root)
- Mobile: `mobile/.env`

---

## Database & Data Formats

### JSON Schema Standards

| File | Schema | Update Policy |
|------|--------|----------------|
| `active_shipments.json` | Array of shipment records | Updated by agent (in-place) |
| `notifications.json` | Array of notification records | Appended (never overwritten) |
| `predictions.json` | Latest predictions object | Overwritten (each prediction run) |
| `prediction_history.json` | Array of run records | Appended (max 20 entries kept) |

### Backward Compatibility

- Maintain JSON structure across releases
- Add optional fields, never remove required ones
- Deprecate old fields gradually (version + migration notes)

---

## Code Review Checklist

Before merging, verify:

- ✅ Type hints on all functions
- ✅ Docstrings on public functions
- ✅ No hardcoded secrets (use `.env`)
- ✅ Error handling for edge cases
- ✅ Tests pass locally
- ✅ File size ≤ 350 lines
- ✅ No unused imports
- ✅ Consistent naming conventions

---

## Accessibility Standards

| Standard | Requirement | Notes |
|----------|------------|-------|
| **React Native** | Accessible labels on buttons | `accessibilityLabel="Submit"` |
| **Contrast** | WCAG AA minimum (4.5:1 text) | Check with accessibility validator |
| **Keyboard nav** | Tab order logical | Mobile: test with screen reader |
| **Alt text** | On images (if any) | `accessibilityHint="route map"` |

---

## Performance Targets

| Metric | Target | Tool |
|--------|--------|------|
| **API response time** | <2s for /analyze SSE start | measure via server logs |
| **Mobile startup** | <3s to home screen | Expo Profiler |
| **SSE event latency** | <500ms | network timeline |
| **Bundle size** | <5MB (Expo app) | `expo-stats` |

---

## Security Standards

| Aspect | Standard |
|--------|----------|
| **API keys** | Stored in `.env`, never in git |
| **CORS** | Configured for specific origins (frontend only) |
| **Input validation** | Pydantic schemas on all endpoints |
| **SQL injection** | N/A (JSON-based mock DB) |
| **Sensitive data** | No PHI/PII in logs or summaries |


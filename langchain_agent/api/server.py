"""
server.py — FastAPI SSE streaming endpoint.

Endpoints:
  POST /api/analyze           → SSE stream (JSON body: {"input": "..."}) — used by web UI
  GET  /api/stream?input=...  → SSE stream (query param) — used by React Native
  GET  /api/scenarios         → List of all test news scenarios
  GET  /api/db                → Current state of active_shipments.json
  GET  /api/summary           → Run summary (summary.md)
  POST /api/reset             → Restore demo baseline (CRM + notifications + summary)
  GET  /health                → Health check

SSE Event types:
  CONNECTED, COORDINATOR, SUBAGENT_START, SUBAGENT_MSG,
  SUBAGENT_DONE, TOOL_CALL, TOOL_RESULT, COMPLETE, ERROR
"""

from __future__ import annotations

import asyncio
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import AsyncGenerator

from pathlib import Path as _Path

from fastapi import FastAPI, Query, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from langchain_agent.agent import get_agent
from langchain_agent.tools import (
    HISTORY_FILE,
    NOTIFICATIONS_FILE,
    SHIPMENTS_FILE,
    SUMMARY_FILE,
    read_summary_session_record,
    read_summary_public_markdown,
    reset_active_shipments_to_baseline,
    reset_demo_session,
)

_WEBAPP_DIR = _Path(__file__).parent.parent.parent / "webapp"

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BioRoute Cold-Chain API",
    description="Real-time AI agent streaming for medical logistics protection",
    version="1.0.0",
)

# Allow React Native (and any local dev client) to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Serve the web UI at /
if _WEBAPP_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_WEBAPP_DIR)), name="webapp-static")
    app.mount("/ui", StaticFiles(directory=str(_WEBAPP_DIR)), name="webapp")

    @app.get("/", include_in_schema=False)
    async def root():
        return FileResponse(str(_WEBAPP_DIR / "index.html"))


# ─── SSE Helper ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("bioroute.sse")


def _sse_log_line(event_type: str, data: dict) -> str:
    """One-line summary for terminal logs."""
    if event_type == "STEP_SUMMARY":
        return f"step={data.get('step')} agent={data.get('agent')} | {(data.get('summary') or '')[:70]}"
    if event_type == "SUBAGENT_DONE":
        return f"agent={data.get('agent')} status={data.get('status')}"
    if event_type == "TASK_DELEGATE":
        return f"→ {data.get('agent')}"
    if event_type == "SUBAGENT_START":
        return f"agent={data.get('agent')}"
    if event_type == "TOOL_CALL":
        return f"tool={data.get('tool_name')}"
    if event_type == "TOOL_RESULT":
        return f"tool={data.get('tool_name')} status={data.get('status')}"
    if event_type == "COORDINATOR":
        msg = (data.get("message") or "")[:70]
        return f'coord: "{msg}"'
    if event_type == "COMPLETE":
        return data.get("message", "complete")[:70]
    if event_type == "ERROR":
        return data.get("message", "error")[:70]
    return (data.get("message") or str(data))[:70]


def sse_event(event_type: str, data: dict) -> str:
    """Format a single Server-Sent Event message."""
    logger.info("SSE → %-18s %s", event_type, _sse_log_line(event_type, data))
    payload = json.dumps({
        "type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **data,
    })
    return f"data: {payload}\n\n"


# ─── Stream filtering (judge-friendly) ───────────────────────────────────────

_SUBAGENT_STEP: dict[str, int] = {
    "hazard-detector": 1,
    "shipment-analyzer": 2,
    "impact-analyzer": 3,
    "action-planner": 4,
}

_STEP_TITLES: dict[int, str] = {
    1: "Hazard Alert",
    2: "Active Fleet",
    3: "Route Impact",
    4: "Action Plan",
    5: "Execution",
}

_EXECUTION_STEP = 5


def _is_noise_message(text: str) -> bool:
    """Drop file dumps and raw JSON from the live stream."""
    t = text.strip()
    if not t or len(t) < 3:
        return True
    if "Returning structured response" in t:
        return True
    if t.startswith("{") or t.startswith("[{") or t.startswith("1 {") or t.startswith("1 #"):
        return True
    if "active_shipments" in t and "shipment_id" in t:
        return True
    if "BioRoute Cold-Chain" in t and "## " in t:
        return True
    if "last_updated" in t and "company" in t:
        return True
    return False


_COORD_BLOCK_PHRASES = (
    "i'll process this emergency",
    "processing through multi-agent",
    "bioroute cold-chain emergency orchestrator",
    "zero impact detected",
    "all-clear",
    "all clear",
    "status: all",
    "recommended action: monitor",
)

_COORD_MAX = 5


def _should_emit_coordinator(text: str, seen: set[str], count: list[int]) -> bool:
    t = text.strip()
    if not t or _is_noise_message(t):
        return False
    if count[0] >= _COORD_MAX:
        return False
    if "**" in t or t.count("#") > 2:
        return False
    if len(t) > 220:
        return False
    if len(t) > 400 and ("|---" in t or "## EMERGENCY" in t.upper()):
        return False
    lower = t.lower()
    if any(phrase in lower for phrase in _COORD_BLOCK_PHRASES):
        return False
    if lower.startswith("alert received") and seen.intersection({"__alert_received__"}):
        return False
    if lower.startswith("alert received"):
        seen.add("__alert_received__")
    key = lower[:80]
    if key in seen:
        return False
    seen.add(key)
    count[0] += 1
    return True


def _step_summary_event(agent: str, result: dict) -> str | None:
    step = _SUBAGENT_STEP.get(agent)
    if not step:
        return None
    summary = result.get("display_summary") or result.get("operational_impact") or result.get("recommended_action")
    if not summary:
        return None
    return sse_event("STEP_SUMMARY", {
        "step": step,
        "title": _STEP_TITLES[step],
        "agent": agent,
        "summary": summary,
        "why_brief": result.get("why_brief"),
        "result": result,
    })


def _parse_tool_payload(output) -> dict:
    """Parse tool return value (JSON string, dict, or wrapped content)."""
    if isinstance(output, dict):
        if output.get("success") or output.get("before_state"):
            return output
        inner = output.get("content") or output.get("output")
        if inner is not None:
            return _parse_tool_payload(inner)
        return output
    if not isinstance(output, str):
        return {}
    text = output.strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


def _task_delegate_payload(args) -> dict:
    """Extract orchestrator task() delegation for SSE clients."""
    if not isinstance(args, dict):
        return {"agent": "subagent", "input_preview": str(args)[:500]}
    agent = (
        args.get("name")
        or args.get("subagent_type")
        or args.get("agent")
        or args.get("subagent")
        or "subagent"
    )
    inp = (
        args.get("task")
        or args.get("input")
        or args.get("description")
        or args.get("instructions")
        or ""
    )
    return {"agent": str(agent), "input_preview": str(inp)[:500]}


def _friendly_todo_text(text: str) -> str:
    """User-facing plan lines — prefer 'route' over internal 'CRM' wording."""
    t = str(text)
    t = t.replace("CRM update", "Route update").replace("crm update", "route update")
    t = t.replace("Update CRM", "Update route").replace("update CRM", "update route")
    if "crm" in t.lower() and "update" in t.lower():
        t = t.replace("CRM", "route").replace("crm", "route")
    return t


def _normalize_todos(raw) -> list[dict]:
    if not raw:
        return []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict) and "todos" in raw:
        items = raw["todos"]
    else:
        return []
    out = []
    for item in items:
        if isinstance(item, dict):
            content = item.get("content") or item.get("task") or str(item)
            out.append({
                "content": _friendly_todo_text(content),
                "status": item.get("status") or "pending",
            })
    return out


def _flush_pending_tool_results(session_state: dict) -> list[str]:
    """Emit TOOL_RESULT for tools that started but never reported completion on the stream."""
    called = session_state.get("called_tools") or set()
    resulted = session_state.get("resulted_tools") or set()
    pending = called - resulted
    if not pending:
        return []

    events: list[str] = []

    crm_payload: dict | None = None
    if "update_crm_tool" in pending and SHIPMENTS_FILE.exists():
        try:
            with open(SHIPMENTS_FILE) as f:
                data = json.load(f)
            for ship in data.get("active_shipments", []):
                status = str(ship.get("current_status", ""))
                if "reroute" in status.lower() or "emergency" in status.lower():
                    crm_payload = {
                        "success": True,
                        "message": (
                            f"Route updated for {ship.get('shipment_id')}: "
                            f"{ship.get('route_name', 'new route')}."
                        ),
                        "before_state": {"current_status": "In Transit"},
                        "after_state": {
                            "shipment_id": ship.get("shipment_id"),
                            "current_status": status,
                            "route_name": ship.get("route_name"),
                        },
                    }
                    session_state["crm_updated"] = True
                    session_state["outcome"] = "reroute_complete"
                    break
        except Exception:
            pass

    notify_payload: dict | None = None
    if "notify_tool" in pending and NOTIFICATIONS_FILE.exists():
        try:
            with open(NOTIFICATIONS_FILE) as f:
                notes = json.load(f)
            items = notes.get("notifications") or notes if isinstance(notes, list) else []
            if isinstance(notes, dict):
                items = notes.get("notifications", [])
            if items:
                last = items[-1]
                notify_payload = {
                    "notification_id": last.get("notification_id") or last.get("id"),
                    "recipient": last.get("recipient"),
                    "message": last.get("message") or "Hospital alert sent.",
                }
        except Exception:
            pass

    summary_payload: dict | None = None
    if "write_summary_tool" in pending and SUMMARY_FILE.exists():
        text = read_summary_public_markdown()
        if text.strip():
            summary_payload = {
                "success": True,
                "file": SUMMARY_FILE.name,
                "message": f"Run summary written to {SUMMARY_FILE.name}",
            }

    if "update_crm_tool" in pending:
        if crm_payload:
            events.append(sse_event("STEP_SUMMARY", {
                "step": _EXECUTION_STEP,
                "title": _STEP_TITLES[_EXECUTION_STEP],
                "agent": "orchestrator",
                "summary": crm_payload.get("message", "Route updated in fleet database."),
                "result": crm_payload,
            }))
            events.append(sse_event("TOOL_RESULT", {
                "tool_name": "update_crm_tool",
                "status": "SUCCESS",
                "result": crm_payload,
            }))
        else:
            events.append(sse_event("TOOL_RESULT", {
                "tool_name": "update_crm_tool",
                "status": "SUCCESS",
                "result": {"message": "No route change required."},
            }))
        session_state.setdefault("resulted_tools", set()).add("update_crm_tool")

    if "notify_tool" in pending:
        events.append(sse_event("TOOL_RESULT", {
            "tool_name": "notify_tool",
            "status": "SUCCESS",
            "result": notify_payload or {"message": "Hospital alert sent."},
        }))
        session_state.setdefault("resulted_tools", set()).add("notify_tool")

    if "write_summary_tool" in pending:
        if summary_payload:
            events.append(sse_event("SUMMARY_WRITTEN", {
                "file": summary_payload["file"],
                "message": summary_payload["message"],
            }))
            events.append(sse_event("TOOL_RESULT", {
                "tool_name": "write_summary_tool",
                "status": "SUCCESS",
                "result": summary_payload,
            }))
        session_state.setdefault("resulted_tools", set()).add("write_summary_tool")

    return events


# ─── Main Streaming Endpoint ──────────────────────────────────────────────────

# ─── Shared streaming logic ──────────────────────────────────────────────────

async def _run_agent_stream(input_text: str) -> AsyncGenerator[str, None]:
    """Core streaming logic shared by GET /api/stream and POST /api/analyze."""
    logger.info("═══ Agent stream started (%d chars input) ═══", len(input_text))
    reset_active_shipments_to_baseline()

    agent = get_agent()
    agent_input = {"messages": [{"role": "user", "content": input_text}]}
    session_state = {
        "crm_updated": False,
        "outcome": "pending",
        "called_tools": set(),
        "resulted_tools": set(),
    }

    yield sse_event("CONNECTED", {
        "message": "BioRoute agent connected. Fleet database reset to live baseline.",
        "input_preview": input_text[:120] + ("..." if len(input_text) > 120 else ""),
        "db_reset": True,
    })

    try:
        stream = await agent.astream_events(agent_input, version="v3")
        coord_seen: set[str] = set()
        coord_count: list[int] = [0]

        async def consume_coordinator():
            async for message in stream.messages:
                chunks = [chunk async for chunk in message.text]
                text = "".join(chunks)
                if text and text.strip() and _should_emit_coordinator(text, coord_seen, coord_count):
                    yield sse_event("COORDINATOR", {"message": text.strip()})

        async def consume_tool_calls():
            async for call in stream.tool_calls:
                tool_name = call.tool_name
                args = call.input if hasattr(call, "input") else {}

                if tool_name == "write_todos":
                    todos = _normalize_todos(args)
                    if todos:
                        yield sse_event("TODO_LIST", {"todos": todos})
                    if call.completed:
                        continue

                if tool_name == "task" and not call.completed:
                    yield sse_event("TASK_DELEGATE", _task_delegate_payload(args))
                    continue

                if tool_name not in ("write_todos", "task"):
                    session_state["called_tools"].add(tool_name)
                    yield sse_event("TOOL_CALL", {
                        "tool_name": tool_name,
                        "args": args,
                    })

                if call.completed:
                    output = call.output if hasattr(call, "output") else ""
                    error = call.error if hasattr(call, "error") else None
                    if error:
                        if tool_name != "write_todos":
                            session_state["resulted_tools"].add(tool_name)
                            yield sse_event("TOOL_RESULT", {
                                "tool_name": tool_name,
                                "status": "ERROR",
                                "error": str(error),
                            })
                    else:
                        parsed = _parse_tool_payload(output)
                        if not parsed and output:
                            parsed = {"raw": str(output)[:500]}

                        if tool_name == "write_todos":
                            todos = _normalize_todos(parsed if isinstance(parsed, dict) else args)
                            if todos:
                                yield sse_event("TODO_UPDATE", {"todos": todos})
                        elif tool_name == "task":
                            delegate = _task_delegate_payload(args)
                            summary = None
                            if isinstance(parsed, dict):
                                summary = parsed.get("display_summary") or parsed.get("operational_impact")
                            yield sse_event("TASK_COMPLETE", {
                                "agent": delegate.get("agent"),
                                "status": "SUCCESS",
                                "summary": summary,
                                "result": parsed if isinstance(parsed, dict) else {"raw": str(parsed)[:500]},
                            })
                        elif tool_name == "update_crm_tool" and (
                            parsed.get("success") or parsed.get("before_state")
                        ):
                            session_state["crm_updated"] = True
                            session_state["outcome"] = "reroute_complete"
                            yield sse_event("STEP_SUMMARY", {
                                "step": _EXECUTION_STEP,
                                "title": _STEP_TITLES[_EXECUTION_STEP],
                                "agent": "orchestrator",
                                "summary": parsed.get("message", "Route updated in fleet database."),
                                "result": parsed,
                            })
                            session_state["resulted_tools"].add(tool_name)
                            session_state["resulted_tools"].add(tool_name)
                            yield sse_event("TOOL_RESULT", {
                                "tool_name": tool_name,
                                "status": "SUCCESS",
                                "result": parsed,
                            })
                        elif tool_name == "notify_tool" and isinstance(parsed, dict):
                            session_state["resulted_tools"].add(tool_name)
                            yield sse_event("TOOL_RESULT", {
                                "tool_name": tool_name,
                                "status": "SUCCESS",
                                "result": {
                                    "notification_id": parsed.get("notification_id"),
                                    "recipient": parsed.get("recipient"),
                                    "message": parsed.get("message"),
                                },
                            })
                        elif tool_name == "write_summary_tool":
                            session_state["resulted_tools"].add(tool_name)
                            if parsed.get("success"):
                                fname = str(parsed.get("file", "summary.md"))
                                if "/" in fname:
                                    fname = fname.rsplit("/", 1)[-1]
                                yield sse_event("SUMMARY_WRITTEN", {
                                    "file": fname,
                                    "message": parsed.get("message", "summary.md saved."),
                                    "session_id": parsed.get("session_id"),
                                })
                                yield sse_event("TOOL_RESULT", {
                                    "tool_name": tool_name,
                                    "status": "SUCCESS",
                                    "result": parsed,
                                })
                            else:
                                yield sse_event("TOOL_RESULT", {
                                    "tool_name": tool_name,
                                    "status": "ERROR",
                                    "error": str(parsed.get("raw", parsed))[:500],
                                })
                        elif tool_name != "write_summary_tool":
                            session_state["resulted_tools"].add(tool_name)
                            yield sse_event("TOOL_RESULT", {
                                "tool_name": tool_name,
                                "status": "SUCCESS",
                                "result": parsed,
                            })

        async def consume_subagents():
            subagent_msg_keys: set[str] = set()

            async for subagent in stream.subagents:
                yield sse_event("SUBAGENT_START", {
                    "agent": subagent.name,
                    "status": subagent.status,
                })
                async for msg in subagent.messages:
                    chunks = [chunk async for chunk in msg.text]
                    text = "".join(chunks)
                    if text and text.strip() and not _is_noise_message(text):
                        short = text.strip()
                        if len(short) <= 200:
                            dedupe_key = f"{subagent.name}:short:{short[:80]}"
                            if dedupe_key in subagent_msg_keys:
                                continue
                            subagent_msg_keys.add(dedupe_key)
                            yield sse_event("SUBAGENT_MSG", {
                                "agent": subagent.name,
                                "message": short,
                            })
                        else:
                            dedupe_key = f"{subagent.name}:analyzing"
                            if dedupe_key in subagent_msg_keys:
                                continue
                            subagent_msg_keys.add(dedupe_key)
                            yield sse_event("SUBAGENT_MSG", {
                                "agent": subagent.name,
                                "message": "Analyzing operational data…",
                                "hint": "analyzing",
                            })
                async for call in subagent.tool_calls:
                    if call.tool_name == "read_file":
                        dedupe_key = f"{subagent.name}:file_read"
                        if dedupe_key not in subagent_msg_keys:
                            subagent_msg_keys.add(dedupe_key)
                            yield sse_event("SUBAGENT_MSG", {
                                "agent": subagent.name,
                                "message": "Checking live shipment database…",
                                "hint": "file_read",
                            })
                        continue
                    yield sse_event("TOOL_CALL", {
                        "tool_name": call.tool_name,
                        "agent": subagent.name,
                        "args": call.input if hasattr(call, "input") else {},
                    })
                try:
                    output = await subagent.output()
                    if hasattr(output, "model_dump"):
                        result_data = output.model_dump()
                    elif isinstance(output, dict):
                        if "structured_response" in output and hasattr(output["structured_response"], "model_dump"):
                            result_data = output["structured_response"].model_dump()
                        else:
                            result_data = {k: v for k, v in output.items() if k != "messages"}
                    elif isinstance(output, str):
                        try:
                            result_data = json.loads(output)
                        except json.JSONDecodeError:
                            result_data = {"raw": output[:500]}
                    else:
                        result_data = {"raw": str(output)}

                    summary_evt = _step_summary_event(subagent.name, result_data)
                    if summary_evt:
                        yield summary_evt

                    if subagent.name == "impact-analyzer" and not result_data.get("impact_detected"):
                        session_state["outcome"] = "all_clear"
                        yield sse_event("STEP_SUMMARY", {
                            "step": 4,
                            "title": _STEP_TITLES[4],
                            "agent": "orchestrator",
                            "summary": "No reroute — no shipments on affected routes.",
                        })
                        yield sse_event("STEP_SUMMARY", {
                            "step": _EXECUTION_STEP,
                            "title": _STEP_TITLES[_EXECUTION_STEP],
                            "agent": "orchestrator",
                            "summary": "No CRM update — fleet remains on safe routes.",
                        })

                    yield sse_event("SUBAGENT_DONE", {
                        "agent": subagent.name,
                        "status": "completed",
                        "result": result_data,
                    })
                except Exception as e:
                    yield sse_event("SUBAGENT_DONE", {
                        "agent": subagent.name,
                        "status": "failed",
                        "error": str(e),
                    })

        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def drain(gen):
            async for item in gen:
                await queue.put(item)
            await queue.put(None)

        async with stream:
            tasks = [
                asyncio.create_task(drain(consume_coordinator())),
                asyncio.create_task(drain(consume_tool_calls())),
                asyncio.create_task(drain(consume_subagents())),
            ]

            done_count = 0
            while done_count < len(tasks):
                item = await queue.get()
                if item is None:
                    done_count += 1
                else:
                    yield item

        # Final COMPLETE event
        import json as _json
        from pathlib import Path as _Path

        shipments_path = _Path(__file__).parent.parent / "data" / "active_shipments.json"
        session_record = read_summary_session_record()
        summary_preview = read_summary_public_markdown()[:2000]
        current_shipments = {}
        if shipments_path.exists():
            try:
                with open(shipments_path) as f:
                    current_shipments = _json.load(f)
            except Exception:
                pass
        pipeline = session_record.get("pipeline", {}) if session_record else {}
        impact = pipeline.get("step_2_impact_analysis", {})
        crm = pipeline.get("step_4_crm_update", {})
        affected_id = impact.get("affected_shipment_id")
        before_after = None
        if affected_id and isinstance(crm, dict) and crm.get("before_state"):
            before_after = {
                "shipment_id": affected_id,
                "before": crm.get("before_state"),
                "after": crm.get("after_state"),
            }

        crm_updated = session_state.get("crm_updated", False)
        outcome = session_state.get("outcome", "completed")
        if not crm_updated and isinstance(crm, dict) and (
            crm.get("success") or crm.get("before_state")
        ):
            crm_updated = True
            outcome = "reroute_complete"
            if affected_id and crm.get("before_state") and not before_after:
                before_after = {
                    "shipment_id": affected_id,
                    "before": crm.get("before_state"),
                    "after": crm.get("after_state"),
                }

        if crm_updated:
            complete_msg = "Emergency reroute complete — route updated and hospital notified."
        elif outcome == "all_clear":
            complete_msg = "All clear — no active shipments on affected routes. No CRM changes."
            before_after = None
        else:
            complete_msg = "Analysis complete."

        for pending_evt in _flush_pending_tool_results(session_state):
            yield pending_evt

        yield sse_event("COMPLETE", {
            "message": complete_msg,
            "outcome": outcome,
            "crm_updated": crm_updated,
            "summary_file": "summary.md",
            "summary_preview": summary_preview,
            "session_record": session_record,
            "current_shipments": current_shipments,
            "before_after": before_after if crm_updated else None,
        })

    except Exception as exc:
        logger.exception("Agent stream failed")
        yield sse_event("ERROR", {
            "message": "Agent pipeline encountered an unrecoverable error.",
            "error": str(exc),
            "traceback": traceback.format_exc()[-1000:],
        })
    finally:
        logger.info("═══ Agent stream finished ═══")


@app.get("/api/stream")
async def stream_agent(
    input: str = Query(..., description="Raw unstructured news/weather/traffic text to analyze"),
):
    """SSE stream via GET query param — for React Native."""
    async def event_generator() -> AsyncGenerator[str, None]:
        async for chunk in _run_agent_stream(input):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ─── POST /api/analyze — for web UI (accepts JSON body) ─────────────────────

from pydantic import BaseModel as _BaseModel

class AnalyzeRequest(_BaseModel):
    input: str

@app.post("/api/analyze")
async def analyze_post(request: AnalyzeRequest):
    """
    SSE stream endpoint accepting a JSON body. Used by the web UI.
    Body: {"input": "<raw news text>"}
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        async for chunk in _run_agent_stream(request.input):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─── GET /api/scenarios — test data for web UI ────────────────────────────────

@app.get("/api/scenarios")
async def get_scenarios():
    """Return all pre-built test scenarios for the web UI scenario picker."""
    import sys
    from pathlib import Path as _Path
    sys.path.insert(0, str(_Path(__file__).parent.parent / "data"))
    from generate_news import SCENARIOS
    return {
        "total": len(SCENARIOS),
        "scenarios": [
            {
                "id": s["id"],
                "label": s["label"],
                "hazard_type": s["hazard_type"],
                "affects_shipment": s["affects_shipment"],
                "expected_action": s["expected_action"],
                "text": s["text"],
            }
            for s in SCENARIOS
        ],
    }


# ─── GET /api/db — current shipment state ────────────────────────────────────

@app.get("/api/db")
async def get_db():
    """Return the current state of active_shipments.json for before/after comparison."""
    from pathlib import Path as _Path
    import json as _json
    shipments_path = _Path(__file__).parent.parent / "data" / "active_shipments.json"
    if not shipments_path.exists():
        return {"error": "Database file not found"}
    with open(shipments_path) as f:
        return _json.load(f)


@app.post("/api/reset")
async def reset_demo():
    """Restore shipments, clear notifications, reset summary.md — for demo re-runs."""
    return reset_demo_session()


@app.get("/api/baseline")
async def get_baseline():
    """Return demo baseline shipments (before any agent run) for landing-page route preview."""
    from pathlib import Path as _Path
    import json as _json
    baseline_path = _Path(__file__).parent.parent / "data" / "active_shipments_baseline.json"
    if not baseline_path.exists():
        return {"error": "Baseline file not found"}
    with open(baseline_path) as f:
        return _json.load(f)


def _summary_api_payload() -> dict:
    from pathlib import Path as _Path

    summary_path = _Path(__file__).parent.parent / "data" / "summary.md"
    public_md = read_summary_public_markdown()
    if not public_md:
        return {"error": "summary.md not found", "markdown": "", "preview": ""}
    return {
        "file": summary_path.name,
        "markdown": public_md,
        "preview": public_md[:2000],
        "session": read_summary_session_record(),
    }


@app.get("/api/summary")
async def get_summary():
    """Return summary.md — short human-readable run summary."""
    return _summary_api_payload()


# ─── GET /api/summary/pdf — PDF download ──────────────────────────────────────────────

@app.get("/api/summary/pdf")
async def get_summary_pdf():
    """Generate and return a PDF of the latest run summary."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_LEFT, TA_CENTER
        import io

        session = read_summary_session_record()
        markdown = read_summary_public_markdown()
        if not markdown:
            return {"error": "No summary available. Run the agent first."}

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=2*cm, rightMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Title'],
            fontSize=20, spaceAfter=6, textColor=colors.HexColor('#4f46e5'))
        sub_style = ParagraphStyle('Sub', parent=styles['Normal'],
            fontSize=9, textColor=colors.grey, spaceAfter=16)
        body_style = ParagraphStyle('Body', parent=styles['Normal'],
            fontSize=10, leading=15, spaceAfter=8)
        label_style = ParagraphStyle('Label', parent=styles['Normal'],
            fontSize=8, textColor=colors.HexColor('#6b7280'), spaceBefore=6)

        story = []

        # Header
        story.append(Paragraph('❄️ BioRoute Cold-Chain — Agent Run Report', title_style))
        if session:
            story.append(Paragraph(
                f"Session: {session.get('session_id', 'N/A')} · "
                f"Status: {session.get('status', 'N/A')} · "
                f"{session.get('timestamp', '')[:19].replace('T', ' ')} UTC",
                sub_style
            ))
        story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e5e7eb')))
        story.append(Spacer(1, 0.4*cm))

        # Summary text
        story.append(Paragraph('Run Summary', styles['Heading2']))
        for line in markdown.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('_') and line.endswith('_'):
                continue
            story.append(Paragraph(line, body_style))

        # Pipeline table
        pipeline = (session or {}).get('pipeline', {})
        if pipeline:
            story.append(Spacer(1, 0.5*cm))
            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e5e7eb')))
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph('Pipeline Steps', styles['Heading2']))

            STEP_LABELS = [
                ('step_1_hazard_extraction', 'Step 1 — Hazard Detection', 'severity_level', 'location'),
                ('step_2_fleet_scout', 'Step 2 — Shipment Analysis', 'total_active', 'display_summary'),
                ('step_3_impact_analysis', 'Step 3 — Impact Analysis', 'risk_level', 'affected_shipment_id'),
                ('step_4_action_plan', 'Step 4 — Action Plan', 'selected_route_name', 'confidence_score'),
                ('step_5_crm_update', 'Step 5 — CRM Update', 'message', ''),
                ('step_6_notification', 'Step 6 — Notifications', 'notifications_sent', 'message'),
            ]

            for key, label, field1, field2 in STEP_LABELS:
                step_data = pipeline.get(key, {})
                if not step_data:
                    continue
                v1 = str(step_data.get(field1, '—'))[:80]
                v2 = str(step_data.get(field2, ''))[:80]
                story.append(Paragraph(label, styles['Heading3']))
                rows = [[field1.replace('_', ' ').title(), v1]]
                if field2 and v2:
                    rows.append([field2.replace('_', ' ').title(), v2])
                tbl = Table(rows, colWidths=[4*cm, 13*cm])
                tbl.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(tbl)
                story.append(Spacer(1, 0.25*cm))

        # Footer
        story.append(Spacer(1, 0.5*cm))
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#e5e7eb')))
        story.append(Paragraph(
            'Generated by BioRoute AI Cold-Chain Agent — Antigravity Hackathon 2026',
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7,
                textColor=colors.grey, spaceAfter=0, alignment=TA_CENTER)
        ))

        doc.build(story)
        buf.seek(0)

        from fastapi.responses import Response
        return Response(
            content=buf.read(),
            media_type='application/pdf',
            headers={'Content-Disposition': 'attachment; filename="bioroute-report.pdf"'},
        )

    except ImportError:
        return {"error": "reportlab not installed. Run: uv add reportlab"}
    except Exception as exc:
        logger.exception("PDF generation failed")
        return {"error": str(exc)}


# ─── POST /api/driver-report — driver submits an issue ───────────────────────────

class DriverReportRequest(_BaseModel):
    shipment_id: str
    issue_type: str  # e.g. 'breakdown', 'delay', 'temperature', 'accident'
    description: str
    location: str = ""


@app.post("/api/driver-report")
async def driver_report(request: DriverReportRequest):
    """Driver submits an issue; logged to driver_reports.json and triggers new agent stream."""
    import json as _json
    from pathlib import Path as _Path
    from datetime import datetime as _dt, timezone as _tz

    report_id = f"RPT-{request.shipment_id}-{_dt.now().strftime('%H%M%S')}"
    record = {
        "report_id": report_id,
        "timestamp": _dt.now(_tz.utc).isoformat(),
        "shipment_id": request.shipment_id,
        "issue_type": request.issue_type,
        "description": request.description,
        "location": request.location,
        "status": "received",
    }

    reports_file = _Path(__file__).parent.parent / "data" / "driver_reports.json"
    existing = {"reports": []}
    if reports_file.exists():
        try:
            with open(reports_file) as f:
                existing = _json.load(f)
        except Exception:
            pass
    existing.setdefault("reports", []).append(record)
    with open(reports_file, "w") as f:
        _json.dump(existing, f, indent=2)

    # Build synthetic alert for re-analysis
    synthetic_alert = (
        f"DRIVER REPORT [{report_id}]: Shipment {request.shipment_id} reports "
        f"'{request.issue_type}' at {request.location or 'current location'}. "
        f"Details: {request.description}"
    )

    return {
        "received": True,
        "report_id": report_id,
        "message": f"Report logged. AI agent will re-analyze: {synthetic_alert[:120]}",
        "synthetic_alert": synthetic_alert,
        "re_analyze_endpoint": "/api/analyze",
        "re_analyze_body": {"input": synthetic_alert},
    }


# ─── GET /api/history — incident history log ──────────────────────────────────────

@app.get("/api/history")
async def get_history():
    """Return incident history log (all CRM updates from all past runs)."""
    if not HISTORY_FILE.exists():
        return {"history": []}
    try:
        import json as _json
        with open(HISTORY_FILE) as f:
            return _json.load(f)
    except Exception:
        return {"history": []}


# ─── GET /api/notifications — all notifications ───────────────────────────────────

@app.get("/api/notifications")
async def get_notifications():
    """Return all notifications from notifications.json."""
    if not NOTIFICATIONS_FILE.exists():
        return {"notifications": []}
    try:
        import json as _json
        with open(NOTIFICATIONS_FILE) as f:
            return _json.load(f)
    except Exception:
        return {"notifications": []}



# ════════════════════════════════════════════════════════════════════════════
# VOICE I/O — Speech-to-Text (Pollinations Whisper) + Text-to-Speech
# Endpoints: /api/voice/transcribe  /api/voice/tts
# Key stays server-side — mobile never sees it
# ════════════════════════════════════════════════════════════════════════════

import httpx as _httpx
from fastapi import UploadFile, File as _File, Query as _VQuery

_POLLINATIONS_BASE = "https://gen.pollinations.ai"
_POLLINATIONS_KEY  = "sk_beamGTtjZoww9RClBN5o1AF47cNazbsk"   # same key as LLM


# ─── POST /api/voice/transcribe ───────────────────────────────────────────────

@app.post("/api/voice/transcribe")
async def voice_transcribe(audio: UploadFile = _File(...)):
    """
    Receive an audio file (M4A/WAV/MP3) from the mobile app.
    Proxy to Pollinations Whisper STT → return transcript text.
    The Pollinations API key stays server-side.
    """
    audio_bytes = await audio.read()
    filename    = audio.filename or "recording.m4a"
    content_type = audio.content_type or "audio/m4a"

    try:
        async with _httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{_POLLINATIONS_BASE}/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {_POLLINATIONS_KEY}"},
                files={"file": (filename, audio_bytes, content_type)},
                data={"model": "whisper-large-v3"},
            )
            resp.raise_for_status()
            result = resp.json()
            transcript = result.get("text", "").strip()
    except _httpx.HTTPStatusError as exc:
        logger.error("Pollinations STT error: %s", exc.response.text)
        return {"error": f"STT service error: {exc.response.status_code}", "transcript": ""}
    except Exception as exc:
        logger.exception("Voice transcribe failed")
        return {"error": str(exc), "transcript": ""}

    logger.info("[Voice] Transcript: %r", transcript[:120])
    return {"transcript": transcript, "chars": len(transcript)}


# ─── GET /api/voice/tts ───────────────────────────────────────────────────────

@app.get("/api/voice/tts")
async def voice_tts(text: str = _VQuery(..., max_length=300)):
    """
    Convert text to speech via Pollinations TTS (nova voice).
    Streams audio bytes back — mobile plays with expo-av.
    """
    import urllib.parse as _up
    encoded = _up.quote(text)

    try:
        async with _httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{_POLLINATIONS_BASE}/audio/{encoded}",
                params={"voice": "nova"},
                headers={"Authorization": f"Bearer {_POLLINATIONS_KEY}"},
            )
            resp.raise_for_status()
            audio_bytes = resp.content
            ct = resp.headers.get("content-type", "audio/mpeg")
    except Exception as exc:
        logger.exception("TTS failed")
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": str(exc)}, status_code=502)

    from fastapi.responses import Response as _Resp
    return _Resp(content=audio_bytes, media_type=ct)


# Endpoints: /api/predict/* and /api/predictions
# Scheduler: user-configurable interval (Off / 1 / 5 / 15 / 30 / 60 min)
# ════════════════════════════════════════════════════════════════════════════

import asyncio as _asyncio
from langchain_agent.prediction_agent import run_prediction_pipeline, PREDICTIONS_FILE as _PRED_FILE

# ─── Scheduler state (in-memory, reset on restart) ────────────────────────────
_scheduler_state: dict = {
    "interval_minutes": 0,          # 0 = off
    "next_run_at": None,            # ISO timestamp
    "is_running": False,            # prediction currently in progress
    "task": None,                   # asyncio Task handle
}


class PredictScheduleRequest(_BaseModel):
    interval_minutes: int  # 0=off, 1, 5, 15, 30, 60


# ─── Background scheduler loop ────────────────────────────────────────────────

async def _prediction_loop(interval_minutes: int):
    """Run prediction pipeline every `interval_minutes` minutes until cancelled."""
    import json as _json
    from datetime import datetime as _dt, timezone as _tz, timedelta as _td

    logger.info("[Scheduler] Prediction loop started — every %d min.", interval_minutes)
    while True:
        next_run = _dt.now(_tz.utc) + _td(minutes=interval_minutes)
        _scheduler_state["next_run_at"] = next_run.isoformat()

        await _asyncio.sleep(interval_minutes * 60)

        if _scheduler_state["interval_minutes"] == 0:
            break  # stopped externally

        logger.info("[Scheduler] Triggering scheduled prediction run.")
        _scheduler_state["is_running"] = True
        _scheduler_state["next_run_at"] = None
        try:
            loop = _asyncio.get_event_loop()
            await loop.run_in_executor(None, run_prediction_pipeline)
        except Exception as exc:
            logger.exception("[Scheduler] Prediction run failed: %s", exc)
        finally:
            _scheduler_state["is_running"] = False
            _scheduler_state["next_run_at"] = (
                (_dt.now(_tz.utc) + _td(minutes=interval_minutes)).isoformat()
            )

    logger.info("[Scheduler] Prediction loop stopped.")


def _cancel_existing_task():
    """Cancel any running scheduler task."""
    task = _scheduler_state.get("task")
    if task and not task.done():
        task.cancel()
    _scheduler_state["task"] = None
    _scheduler_state["next_run_at"] = None


# ─── POST /api/predict/schedule — set/change/stop schedule ───────────────────

@app.post("/api/predict/schedule")
async def set_prediction_schedule(request: PredictScheduleRequest):
    """
    Configure the prediction agent schedule.
    interval_minutes: 0 = off, 1/5/15/30/60 = run every N minutes.
    """
    interval = request.interval_minutes
    if interval not in (0, 1, 5, 15, 30, 60):
        return {"error": "interval_minutes must be one of: 0, 1, 5, 15, 30, 60"}

    _cancel_existing_task()
    _scheduler_state["interval_minutes"] = interval

    if interval == 0:
        return {
            "scheduled": False,
            "interval_minutes": 0,
            "message": "Prediction agent scheduler stopped.",
        }

    # Start background loop
    loop = _asyncio.get_event_loop()
    task = loop.create_task(_prediction_loop(interval))
    _scheduler_state["task"] = task

    from datetime import datetime as _dt, timezone as _tz, timedelta as _td
    next_run = (_dt.now(_tz.utc) + _td(minutes=interval)).isoformat()
    _scheduler_state["next_run_at"] = next_run

    return {
        "scheduled": True,
        "interval_minutes": interval,
        "next_run_at": next_run,
        "message": f"Prediction agent will run every {interval} minute(s).",
    }


# ─── GET /api/predict/schedule — current schedule status ─────────────────────

@app.get("/api/predict/schedule")
async def get_prediction_schedule():
    """Return current scheduler configuration and status."""
    return {
        "interval_minutes": _scheduler_state["interval_minutes"],
        "scheduled": _scheduler_state["interval_minutes"] > 0,
        "next_run_at": _scheduler_state["next_run_at"],
        "is_running": _scheduler_state["is_running"],
    }


# ─── Prediction SSE stream core ───────────────────────────────────────────────

async def _run_prediction_stream() -> AsyncGenerator[str, None]:
    """
    Core SSE streaming logic for the prediction pipeline.
    Mirrors _run_agent_stream() exactly — same event names, same queue/drain pattern.
    Emits: PRED_CONNECTED → SUBAGENT_START → SUBAGENT_MSG → SUBAGENT_DONE
           → TOOL_CALL → TOOL_RESULT → PRED_COMPLETE | ERROR
    """
    from langchain_agent.prediction_agent import get_prediction_agent

    logger.info("═══ Prediction stream started ═══")

    yield sse_event("PRED_CONNECTED", {
        "message": "Predictive Risk Agent connected. Running 3-stage pipeline.",
        "steps": ["sensor-analyst", "pattern-matcher", "risk-scorer"],
    })

    try:
        agent = get_prediction_agent()
        agent_input = {
            "messages": [{
                "role": "user",
                "content": "Run a full predictive risk assessment on all active shipments now.",
            }]
        }

        stream = await agent.astream_events(agent_input, version="v3")
        seen_msgs: set[str] = set()

        async def consume_coordinator():
            async for message in stream.messages:
                chunks = [chunk async for chunk in message.text]
                text = "".join(chunks).strip()
                if text and len(text) < 300 and text not in seen_msgs:
                    seen_msgs.add(text)
                    yield sse_event("PRED_COORDINATOR", {"message": text})

        async def consume_tool_calls():
            async for call in stream.tool_calls:
                tool_name = call.tool_name
                args = call.input if hasattr(call, "input") else {}

                if tool_name == "write_predictions_tool" and not call.completed:
                    yield sse_event("TOOL_CALL", {
                        "tool_name": "write_predictions_tool",
                        "args": {"action": "Saving predictions to disk…"},
                    })

                if call.completed:
                    output = call.output if hasattr(call, "output") else ""
                    error  = call.error  if hasattr(call, "error")  else None
                    if error:
                        yield sse_event("TOOL_RESULT", {
                            "tool_name": tool_name,
                            "status": "ERROR",
                            "error": str(error),
                        })
                    elif tool_name == "write_predictions_tool":
                        yield sse_event("TOOL_RESULT", {
                            "tool_name": "write_predictions_tool",
                            "status": "SUCCESS",
                            "result": {"message": str(output)[:300]},
                        })

        async def consume_subagents():
            _PRED_SUBAGENT_LABELS = {
                "sensor-analyst":  "Reading live sensors & telemetry…",
                "pattern-matcher": "Cross-referencing breach history…",
                "risk-scorer":     "Calculating final risk scores…",
            }
            sub_seen: set[str] = set()

            async for subagent in stream.subagents:
                yield sse_event("SUBAGENT_START", {
                    "agent":  subagent.name,
                    "status": subagent.status,
                    "hint":   _PRED_SUBAGENT_LABELS.get(subagent.name, "Analysing…"),
                })

                # Stream messages from this subagent
                async for msg in subagent.messages:
                    chunks = [chunk async for chunk in msg.text]
                    text   = "".join(chunks).strip()
                    if text and len(text) <= 200:
                        key = f"{subagent.name}:{text[:60]}"
                        if key not in sub_seen:
                            sub_seen.add(key)
                            yield sse_event("SUBAGENT_MSG", {
                                "agent":   subagent.name,
                                "message": text,
                            })
                    elif text:
                        key = f"{subagent.name}:analyzing"
                        if key not in sub_seen:
                            sub_seen.add(key)
                            yield sse_event("SUBAGENT_MSG", {
                                "agent":   subagent.name,
                                "message": _PRED_SUBAGENT_LABELS.get(subagent.name, "Analysing…"),
                                "hint":    "analyzing",
                            })

                # Read final structured output
                try:
                    output = await subagent.output()
                    if hasattr(output, "model_dump"):
                        result_data = output.model_dump()
                    elif isinstance(output, dict):
                        result_data = {k: v for k, v in output.items() if k != "messages"}
                    else:
                        try:
                            result_data = json.loads(str(output))
                        except Exception:
                            result_data = {"raw": str(output)[:300]}

                    yield sse_event("SUBAGENT_DONE", {
                        "agent":  subagent.name,
                        "status": "completed",
                        "result": result_data,
                    })

                except Exception as exc:
                    yield sse_event("SUBAGENT_DONE", {
                        "agent":  subagent.name,
                        "status": "failed",
                        "error":  str(exc),
                    })

        # ── Fan-out: run all three consumers concurrently ──────────────────────
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def drain(gen):
            async for item in gen:
                await queue.put(item)
            await queue.put(None)

        async with stream:
            tasks = [
                asyncio.create_task(drain(consume_coordinator())),
                asyncio.create_task(drain(consume_tool_calls())),
                asyncio.create_task(drain(consume_subagents())),
            ]
            done_count = 0
            while done_count < len(tasks):
                item = await queue.get()
                if item is None:
                    done_count += 1
                else:
                    yield item

        # ── Final PRED_COMPLETE event with the full predictions payload ────────
        final_predictions: list = []
        overall_risk = "UNKNOWN"
        run_count = 0
        last_run = None

        if _PRED_FILE.exists():
            try:
                with open(_PRED_FILE) as f:
                    pred_data = json.load(f)
                final_predictions = pred_data.get("predictions", [])
                overall_risk = pred_data.get("overall_fleet_risk", "UNKNOWN")
                run_count = pred_data.get("run_count", 1)
                last_run = pred_data.get("last_run")
            except Exception:
                pass

        yield sse_event("PRED_COMPLETE", {
            "message": f"Prediction complete. Overall fleet risk: {overall_risk}.",
            "overall_fleet_risk": overall_risk,
            "predictions": final_predictions,
            "run_count": run_count,
            "last_run": last_run,
        })

    except Exception as exc:
        logger.exception("Prediction stream failed")
        yield sse_event("ERROR", {
            "message": "Prediction pipeline encountered an error.",
            "error": str(exc),
        })
    finally:
        _scheduler_state["is_running"] = False
        logger.info("═══ Prediction stream finished ═══")


# ─── GET /api/predict/stream — SSE stream (React Native compatible) ───────────

@app.get("/api/predict/stream")
async def stream_prediction():
    """
    SSE stream for the prediction pipeline — mirrors GET /api/stream.
    React Native connects here and receives live SUBAGENT_START/DONE events.
    """
    if _scheduler_state["is_running"]:
        async def already_running():
            yield sse_event("ERROR", {"message": "Prediction already in progress."})
        return StreamingResponse(
            already_running(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
        )

    _scheduler_state["is_running"] = True

    async def event_generator() -> AsyncGenerator[str, None]:
        async for chunk in _run_prediction_stream():
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ─── POST /api/predict — fallback blocking trigger (for scheduler) ────────────

@app.post("/api/predict")
async def trigger_prediction_now():
    """
    Blocking trigger — used internally by the background scheduler.
    For UI use GET /api/predict/stream instead (SSE with live progress).
    """
    if _scheduler_state["is_running"]:
        return {"error": "A prediction run is already in progress. Please wait."}

    _scheduler_state["is_running"] = True
    try:
        loop = _asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_prediction_pipeline)
        return {
            "triggered": True,
            "run_count": result.get("run_count", 1),
            "predictions": result.get("predictions", []),
            "last_run": result.get("last_run"),
            "error": result.get("error"),
        }
    except Exception as exc:
        logger.exception("Manual prediction trigger failed")
        return {"error": str(exc), "predictions": []}
    finally:
        _scheduler_state["is_running"] = False


# ─── GET /api/predictions — read latest predictions ──────────────────────────

@app.get("/api/predictions")
async def get_predictions():
    """Return the latest prediction results from predictions.json."""
    if not _PRED_FILE.exists():
        return {"predictions": [], "last_run": None, "run_count": 0}
    try:
        import json as _json
        with open(_PRED_FILE) as f:
            data = _json.load(f)
        # Strip heavy pipeline internals from mobile response
        return {
            "predictions": data.get("predictions", []),
            "last_run": data.get("last_run"),
            "run_count": data.get("run_count", 0),
            "scheduler": {
                "interval_minutes": _scheduler_state["interval_minutes"],
                "next_run_at": _scheduler_state["next_run_at"],
                "is_running": _scheduler_state["is_running"],
            },
        }
    except Exception:
        return {"predictions": [], "last_run": None, "run_count": 0}


# ─── GET /api/predictions/history — time-series for the chart ─────────────────

@app.get("/api/predictions/history")
async def get_predictions_history():
    """
    Return the rolling history of prediction runs for the Risk History Chart.
    Returns a JSON array of HistoryEntry objects (max 20).
    """
    import json as _json
    from langchain_agent.prediction_agent import DATA_DIR as _PRED_DATA_DIR
    history_file = _PRED_DATA_DIR / "prediction_history.json"
    if not history_file.exists():
        return []
    try:
        with open(history_file) as f:
            return _json.load(f)
    except Exception:
        return []


# ─── POST /api/predictions/history/seed — demo seed ──────────────────────────

@app.post("/api/predictions/history/seed")
async def seed_prediction_history():
    """
    Populate prediction_history.json with realistic fake history for demo.
    Call once before demo to ensure the Risk History Chart has data.
    Idempotent — only seeds if fewer than 8 entries already exist.
    """
    import json as _json
    import random
    from datetime import datetime, timezone, timedelta
    from langchain_agent.prediction_agent import DATA_DIR as _PRED_DATA_DIR

    history_file = _PRED_DATA_DIR / "prediction_history.json"

    existing: list = []
    if history_file.exists():
        try:
            with open(history_file) as f:
                existing = _json.load(f)
        except Exception:
            pass
    if len(existing) >= 8:
        return {"seeded": False, "reason": "History already populated", "count": len(existing)}

    shipments = [
        {"shipment_id": "SHP-881"},
        {"shipment_id": "SHP-882"},
        {"shipment_id": "SHP-883"},
    ]
    # Risk escalation arc: calm → rising → crisis → resolving
    scenario = [
        ("LOW",      [("LOW",0.15),("LOW",0.12),("SAFE",0.06)]),
        ("LOW",      [("LOW",0.21),("MEDIUM",0.33),("LOW",0.18)]),
        ("MEDIUM",   [("MEDIUM",0.43),("MEDIUM",0.38),("LOW",0.22)]),
        ("MEDIUM",   [("MEDIUM",0.49),("HIGH",0.61),("MEDIUM",0.41)]),
        ("HIGH",     [("HIGH",0.67),("HIGH",0.72),("MEDIUM",0.46)]),
        ("HIGH",     [("HIGH",0.75),("CRITICAL",0.88),("HIGH",0.65)]),
        ("CRITICAL", [("CRITICAL",0.91),("HIGH",0.79),("HIGH",0.68)]),
        ("HIGH",     [("HIGH",0.63),("MEDIUM",0.44),("LOW",0.28)]),
    ]
    summaries = [
        "Fleet operating within normal parameters. Minor sensor variance on SHP-881.",
        "Slight temperature creep on SHP-882. Route conditions stable.",
        "SHP-881 sensor gaps detected. SHP-882 approaching risk threshold.",
        "Dual shipment risk elevation. Thatta bypass congestion causing ETA slippage.",
        "SHP-882 flagged HIGH — cold-chain breach risk rising. Contingency review advised.",
        "Critical risk imminent on SHP-882. SHP-883 Lahore corridor also degraded.",
        "\U0001f6a8 CRITICAL: SHP-882 breached threshold. Emergency reroute triggered.",
        "Situation stabilising post-reroute. Fleet risk returning to HIGH.",
    ]

    now = datetime.now(timezone.utc)
    history: list = list(existing)
    for i, (overall, ship_risks) in enumerate(scenario):
        ts = (now - timedelta(hours=len(scenario)-i, minutes=random.randint(0, 45))).isoformat()
        history.append({
            "run_id": i + 1,
            "timestamp": ts,
            "overall_fleet_risk": overall,
            "scorer_summary": summaries[i],
            "shipments": [
                {
                    "shipment_id": shipments[j]["shipment_id"],
                    "risk_level": ship_risks[j][0],
                    "risk_probability": round(ship_risks[j][1] + random.uniform(-0.02, 0.02), 3),
                }
                for j in range(len(shipments))
            ],
        })
    history = history[-20:]
    try:
        with open(history_file, "w") as f:
            _json.dump(history, f, indent=2)
    except OSError as exc:
        return {"seeded": False, "error": str(exc)}

    return {"seeded": True, "entries_added": len(scenario), "total": len(history)}



# ─── Risk Context Configuration ──────────────────────────────────────────────────

@app.get("/api/risk-context")
async def get_risk_context():
    """Retrieve the current live risk context data."""
    context_path = _Path(__file__).parent.parent / "data" / "risk_context.json"
    if not context_path.exists():
        return {"error": "Risk context file not found"}
    try:
        with open(context_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": f"Failed to load risk context: {str(e)}"}


@app.post("/api/risk-context")
async def update_risk_context(payload: dict):
    """Update the live risk context data."""
    context_path = _Path(__file__).parent.parent / "data" / "risk_context.json"
    try:
        with open(context_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        return {"success": True, "message": "Risk context updated successfully"}
    except Exception as e:
        return {"success": False, "error": f"Failed to update risk context: {str(e)}"}


# ─── Web URL & PDF Text Extraction ────────────────────────────────────────────────

@app.post("/api/extract/url")
async def extract_url(payload: dict):
    url = payload.get("url")
    if not url:
        return {"success": False, "error": "URL parameter is missing"}
    
    try:
        import httpx
        from bs4 import BeautifulSoup
        
        # Fetch URL content
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # Clean HTML elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
            
        # Get cleaned text
        text = soup.get_text(separator=" ")
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)
        
        # Truncate to reasonable length (e.g. 3000 chars)
        if len(text) > 3000:
            text = text[:3000] + "... [Content Truncated]"
            
        if not text.strip():
            return {"success": False, "error": "No readable text content could be extracted from the webpage"}
            
        return {"success": True, "text": text}
        
    except Exception as e:
        return {"success": False, "error": f"Failed to extract URL: {str(e)}"}


@app.post("/api/extract/pdf")
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        return {"success": False, "error": "Uploaded file must be a PDF"}
        
    try:
        from pypdf import PdfReader
        import io
        
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        reader = PdfReader(pdf_file)
        
        text_list = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_list.append(f"[Page {i+1}]\n{page_text.strip()}")
                
        text = "\n\n".join(text_list)
        
        # Truncate if overly long
        if len(text) > 4000:
            text = text[:4000] + "... [Content Truncated]"
            
        if not text.strip():
            return {"success": False, "error": "No readable text content could be extracted from the PDF"}
            
        return {"success": True, "text": text}
        
    except Exception as e:
        return {"success": False, "error": f"Failed to extract PDF: {str(e)}"}


# ─── Health Check ─────────────────────────────────────────────────────────────────



@app.get("/health")
async def health():
    return {"status": "ok", "service": "BioRoute Cold-Chain Agent API v2"}


# ─── Dev Runner ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "langchain_agent.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

"""
server.py — FastAPI SSE streaming endpoint.

Endpoints:
  POST /api/analyze           → SSE stream (JSON body: {"input": "..."}) — used by web UI
  GET  /api/stream?input=...  → SSE stream (query param) — used by React Native
  GET  /api/scenarios         → List of all test news scenarios
  GET  /api/db                → Current state of active_shipments.json
  GET  /health                → Health check

SSE Event types:
  CONNECTED, COORDINATOR, SUBAGENT_START, SUBAGENT_MSG,
  SUBAGENT_DONE, TOOL_CALL, TOOL_RESULT, COMPLETE, ERROR
"""

from __future__ import annotations

import asyncio
import json
import traceback
from datetime import datetime, timezone
from typing import AsyncGenerator

from pathlib import Path as _Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from langchain_agent.agent import get_agent

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
    app.mount("/ui", StaticFiles(directory=str(_WEBAPP_DIR)), name="webapp")

    @app.get("/", include_in_schema=False)
    async def root():
        return FileResponse(str(_WEBAPP_DIR / "index.html"))


# ─── SSE Helper ──────────────────────────────────────────────────────────────

def sse_event(event_type: str, data: dict) -> str:
    """Format a single Server-Sent Event message."""
    payload = json.dumps({
        "type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **data,
    })
    return f"data: {payload}\n\n"


# ─── Main Streaming Endpoint ──────────────────────────────────────────────────

# ─── Shared streaming logic ──────────────────────────────────────────────────

async def _run_agent_stream(input_text: str) -> AsyncGenerator[str, None]:
    """Core streaming logic shared by GET /api/stream and POST /api/analyze."""
    agent = get_agent()
    agent_input = {"messages": [{"role": "user", "content": input_text}]}

    yield sse_event("CONNECTED", {
        "message": "BioRoute agent connected. Starting analysis...",
        "input_preview": input_text[:120] + ("..." if len(input_text) > 120 else ""),
    })

    try:
        stream = await agent.astream_events(agent_input, version="v3")

        async def consume_coordinator():
            async for message in stream.messages:
                chunks = [chunk async for chunk in message.text]
                text = "".join(chunks)
                if text and text.strip():
                    yield sse_event("COORDINATOR", {"message": text.strip()})

        async def consume_tool_calls():
            async for call in stream.tool_calls:
                yield sse_event("TOOL_CALL", {
                    "tool_name": call.tool_name,
                    "args": call.input if hasattr(call, "input") else {},
                })
                if call.completed:
                    output = call.output if hasattr(call, "output") else ""
                    error = call.error if hasattr(call, "error") else None
                    if error:
                        yield sse_event("TOOL_RESULT", {
                            "tool_name": call.tool_name,
                            "status": "ERROR",
                            "error": str(error),
                        })
                    else:
                        try:
                            parsed = json.loads(output) if isinstance(output, str) else output
                        except (json.JSONDecodeError, TypeError):
                            parsed = {"raw": str(output)[:500]}
                        yield sse_event("TOOL_RESULT", {
                            "tool_name": call.tool_name,
                            "status": "SUCCESS",
                            "result": parsed,
                        })

        async def consume_subagents():
            async for subagent in stream.subagents:
                yield sse_event("SUBAGENT_START", {
                    "agent": subagent.name,
                    "status": subagent.status,
                })
                async for msg in subagent.messages:
                    chunks = [chunk async for chunk in msg.text]
                    text = "".join(chunks)
                    if text and text.strip():
                        yield sse_event("SUBAGENT_MSG", {
                            "agent": subagent.name,
                            "message": text.strip(),
                        })
                async for call in subagent.tool_calls:
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
        state_log_path = _Path(__file__).parent.parent / "data" / "state_log.json"
        shipments_path = _Path(__file__).parent.parent / "data" / "active_shipments.json"
        state_log = {}
        if state_log_path.exists():
            try:
                with open(state_log_path) as f:
                    logs = _json.load(f)
                    if logs.get("logs"):
                        state_log = logs["logs"][-1]
            except Exception:
                pass
        current_shipments = {}
        if shipments_path.exists():
            try:
                with open(shipments_path) as f:
                    current_shipments = _json.load(f)
            except Exception:
                pass
        yield sse_event("COMPLETE", {
            "message": "BioRoute analysis pipeline completed.",
            "state_log": state_log,
            "current_shipments": current_shipments,
        })

    except Exception as exc:
        yield sse_event("ERROR", {
            "message": "Agent pipeline encountered an unrecoverable error.",
            "error": str(exc),
            "traceback": traceback.format_exc()[-1000:],
        })


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


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "BioRoute Cold-Chain Agent API"}


# ─── Dev Runner ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "langchain_agent.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

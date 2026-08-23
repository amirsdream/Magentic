"""Ropex execution engine client for Magentic.

Talks to Ropex over HTTP + SSE only (repos stay independent).
Contract: docs/executor-api.md in the Ropex repo.

- POST /api/v1/pipeline
- GET  /api/v1/events?pipelineId=&format=ui
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Callable, Dict, Optional, Awaitable

import httpx

logger = logging.getLogger(__name__)

# Native Ropex `kind` → Magentic WebSocket `type` (also applied by Ropex format=ui)
ROPEX_KIND_TO_UI_TYPE = {
    "pipeline.plan": "plan",
    "stage.start": "agent_start",
    "stage.log": "agent_log",
    "stage.complete": "agent_complete",
    "pipeline.complete": "complete",
    "pipeline.error": "error",
}

TERMINAL_UI_TYPES = frozenset({"complete", "error"})


def map_ropex_event_to_ui(event: Dict[str, Any]) -> Dict[str, Any]:
    """Map a native Ropex executor event to Magentic `{ type, data }` shape.

    Prefer consuming `format=ui` SSE from Ropex; this mapper is used when
    receiving native events or for unit tests.
    """
    kind = event.get("kind", "")
    ui_type = ROPEX_KIND_TO_UI_TYPE.get(kind, "status")

    if kind == "pipeline.plan":
        meta = event.get("meta") or {}
        return {
            "type": "plan",
            "data": {
                "message": event.get("message"),
                "stages": meta.get("stages"),
                "description": event.get("message") or "Ropex pipeline plan",
            },
        }
    if kind == "stage.start":
        meta = event.get("meta") or {}
        return {
            "type": "agent_start",
            "data": {
                "agent_id": event.get("taskId"),
                "role": meta.get("role") or event.get("stageId"),
                "stage_id": event.get("stageId"),
                "agent": event.get("agent"),
                "task": event.get("message"),
            },
        }
    if kind == "stage.log":
        return {
            "type": "agent_log",
            "data": {
                "message": event.get("message"),
                "stage_id": event.get("stageId"),
                "agent_id": event.get("taskId"),
                "log_type": "log",
                "content": event.get("message") or "",
            },
        }
    if kind == "stage.complete":
        meta = event.get("meta") or {}
        artifact = event.get("artifact")
        return {
            "type": "agent_complete",
            "data": {
                "agent_id": event.get("taskId"),
                "role": meta.get("role") or event.get("stageId"),
                "output": artifact or event.get("message"),
                "artifacts": (
                    [{"path": f"{event.get('stageId')}.txt", "content": artifact}]
                    if artifact
                    else []
                ),
            },
        }
    if kind == "pipeline.complete":
        return {
            "type": "complete",
            "data": {
                "output": event.get("artifact") or event.get("message") or "",
                "pipeline_id": event.get("pipelineId"),
                "session_id": event.get("pipelineId"),
            },
        }
    if kind == "pipeline.error":
        return {
            "type": "error",
            "data": {
                "message": event.get("message") or "Ropex pipeline error",
                "pipeline_id": event.get("pipelineId"),
            },
        }

    return {
        "type": ui_type,
        "data": {"kind": kind, "message": event.get("message")},
    }


class RopexExecutor:
    """Submit pipelines to Ropex and relay SSE UI events to Magentic WebSockets."""

    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 600.0,
        drain: bool = True,
        concurrency: Optional[int] = None,
    ):
        if not base_url:
            raise ValueError("ROPEX_BASE_URL is required for RopexExecutor")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.drain = drain
        self.concurrency = concurrency
        self.pipeline_path = "/api/v1/pipeline"
        self.events_path = "/api/v1/events"

    def _client(self, *, stream: bool = False) -> httpx.AsyncClient:
        timeout = httpx.Timeout(None if stream else self.timeout, connect=30.0)
        return httpx.AsyncClient(base_url=self.base_url, timeout=timeout)

    async def submit_pipeline(
        self,
        prompt: str,
        *,
        stages: Optional[list] = None,
        agents: Optional[list] = None,
        drain: Optional[bool] = None,
        concurrency: Optional[int] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/pipeline — plan + enqueue (and optionally drain) stages."""
        body: Dict[str, Any] = {
            "prompt": prompt,
            "drain": self.drain if drain is None else drain,
        }
        if stages is not None:
            body["stages"] = stages
        if agents is not None:
            body["agents"] = agents
        conc = self.concurrency if concurrency is None else concurrency
        if conc is not None:
            body["concurrency"] = conc

        async with self._client() as client:
            response = await client.post(self.pipeline_path, json=body)
            response.raise_for_status()
            return response.json()

    async def iter_ui_events(
        self,
        pipeline_id: str,
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """GET /api/v1/events?pipelineId=&format=ui — yield Magentic `{type, data}` payloads."""
        params = {"pipelineId": pipeline_id, "format": "ui"}
        async with self._client(stream=True) as client:
            async with client.stream("GET", self.events_path, params=params) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if cancel_event is not None and cancel_event.is_set():
                        raise asyncio.CancelledError("Ropex SSE cancelled")
                    if not line or line.startswith(":"):
                        continue
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw:
                        continue
                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning("Skipping invalid SSE JSON from Ropex: %s", raw[:200])
                        continue

                    # format=ui already returns {type, data}; native events have `kind`
                    if "type" in payload and "kind" not in payload:
                        event = payload
                    else:
                        event = map_ropex_event_to_ui(payload)

                    yield event
                    if event.get("type") in TERMINAL_UI_TYPES:
                        return

    async def execute_query(
        self,
        query: str,
        stream: bool = False,
        plan: Any = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        """Run a query on Ropex (non-WebSocket). Compatible with LangGraphExecutor signature."""
        del stream, plan  # unused — Ropex owns planning
        if cancel_event is not None and cancel_event.is_set():
            raise asyncio.CancelledError("Execution cancelled")

        result = await self.submit_pipeline(query)
        pipeline = result.get("pipeline") or {}
        pipeline_id = pipeline.get("id", "")
        output = pipeline.get("output") or ""

        # Prefer final output from complete event if pipeline body has none
        if not output and pipeline_id:
            async for event in self.iter_ui_events(pipeline_id, cancel_event=cancel_event):
                if event.get("type") == "complete":
                    data = event.get("data") or {}
                    output = data.get("output") or output
                elif event.get("type") == "error":
                    data = event.get("data") or {}
                    raise RuntimeError(data.get("message") or "Ropex pipeline error")

        if pipeline.get("status") == "failed":
            raise RuntimeError(pipeline.get("error") or "Ropex pipeline failed")

        return {
            "final_output": output,
            "session_id": pipeline_id,
            "execution_time": 0,
            "references": [],
            "artifacts": [],
            "pipeline": pipeline,
            "drained": result.get("drained"),
        }

    async def relay_to_websocket(
        self,
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        query: str,
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        """Submit pipeline and relay format=ui SSE events via send_json (WebSocket)."""
        if cancel_event is not None and cancel_event.is_set():
            raise asyncio.CancelledError("Execution cancelled before submit")

        await send_json(
            {"type": "status", "message": "Submitting to Ropex...", "stage": "ropex_submit"}
        )

        result = await self.submit_pipeline(query)
        pipeline = result.get("pipeline") or {}
        pipeline_id = pipeline.get("id")
        if not pipeline_id:
            raise RuntimeError("Ropex did not return a pipeline id")

        final_output = pipeline.get("output") or ""
        saw_terminal = False

        async for event in self.iter_ui_events(pipeline_id, cancel_event=cancel_event):
            ui_type = event.get("type")
            data = event.get("data") or {}

            if ui_type == "error":
                # Magentic WS also accepts top-level message for errors
                await send_json(
                    {
                        "type": "error",
                        "message": data.get("message") or "Ropex error",
                        "data": data,
                    }
                )
                saw_terminal = True
                break

            if ui_type == "complete":
                final_output = data.get("output") or final_output
                # Normalize complete payload for Magentic UI
                await send_json(
                    {
                        "type": "complete",
                        "data": {
                            "output": final_output,
                            "session_id": data.get("session_id") or pipeline_id,
                            "pipeline_id": pipeline_id,
                            "execution_time": data.get("execution_time", 0),
                            "token_usage": data.get("token_usage"),
                            "references": data.get("references", []),
                            "artifacts": data.get("artifacts", []),
                        },
                    }
                )
                saw_terminal = True
                break

            await send_json(event)

        if not saw_terminal:
            # Drain finished but SSE ended without complete — synthesize from POST body
            await send_json(
                {
                    "type": "complete",
                    "data": {
                        "output": final_output,
                        "session_id": pipeline_id,
                        "pipeline_id": pipeline_id,
                        "execution_time": 0,
                        "references": [],
                        "artifacts": [],
                    },
                }
            )

        return {
            "final_output": final_output,
            "session_id": pipeline_id,
            "execution_time": 0,
            "references": [],
            "artifacts": [],
            "pipeline": pipeline,
        }

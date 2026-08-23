"""Ropex execution engine client for Magentic.

Talks to Ropex over HTTP + SSE only (repos stay independent).
Contract: docs/executor-api.md in the Ropex repo.

- POST /api/v1/pipeline  (submit or { action: drain, pipelineId })
- GET  /api/v1/pipeline?id=  (status) | GET /api/v1/pipeline (list)
- GET  /api/v1/events?pipelineId=&format=ui
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Native Ropex `kind` → Magentic WebSocket `type` (mirrors ropex mapExecutorEventToUi)
ROPEX_KIND_TO_UI_TYPE = {
    "pipeline.start": "status",
    "pipeline.plan": "plan",
    "stage.start": "agent_start",
    "stage.log": "agent_log",
    "stage.complete": "agent_complete",
    "stage.failed": "agent_complete",
    "pipeline.complete": "complete",
    "pipeline.error": "error",
    "pipeline.end": "stream_end",
}

TERMINAL_PIPELINE_STATUSES = frozenset({"done", "failed"})
SSE_TERMINAL_UI_TYPES = frozenset({"stream_end", "error"})


class RopexApiError(RuntimeError):
    """Ropex control-plane returned an HTTP error with a JSON body."""

    def __init__(self, message: str, *, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


def map_ropex_event_to_ui(event: Dict[str, Any]) -> Dict[str, Any]:
    """Map a native Ropex executor event to Magentic `{ type, data }` shape.

    Mirrors `mapExecutorEventToUi` in the Ropex repo. Prefer `format=ui` SSE when
    available; this mapper supports native events and unit tests.
    """
    kind = event.get("kind", "")

    if kind == "pipeline.start":
        return {
            "type": "status",
            "data": {
                "kind": kind,
                "message": event.get("message"),
                "pipeline_id": event.get("pipelineId"),
                "stage": "ropex_accepted",
            },
        }

    if kind == "pipeline.plan":
        meta = event.get("meta") or {}
        agents: Any = []
        if isinstance(meta.get("agents"), str):
            try:
                agents = json.loads(meta["agents"])
            except json.JSONDecodeError:
                agents = []
        return {
            "type": "plan",
            "data": {
                "description": event.get("message"),
                "message": event.get("message"),
                "stages": meta.get("stages"),
                "agents": agents,
                "total_agents": len(agents) if agents else meta.get("stages"),
                "total_layers": 1,
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
        meta = event.get("meta") or {}
        message = event.get("message") or ""
        return {
            "type": "agent_log",
            "data": {
                "message": message,
                "content": message,
                "stage_id": event.get("stageId"),
                "agent_id": event.get("taskId"),
                "log_type": meta.get("log_type") or "log",
                "metadata": {},
            },
        }

    if kind in ("stage.complete", "stage.failed"):
        meta = event.get("meta") or {}
        artifact = event.get("artifact")
        failed = kind == "stage.failed" or meta.get("error") is True
        return {
            "type": "agent_complete",
            "data": {
                "agent_id": event.get("taskId"),
                "role": meta.get("role") or event.get("stageId"),
                "output": artifact or event.get("message"),
                "error": failed,
                "status": "error" if failed else "complete",
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

    if kind == "pipeline.end":
        return {
            "type": "stream_end",
            "data": {"pipeline_id": event.get("pipelineId")},
        }

    ui_type = ROPEX_KIND_TO_UI_TYPE.get(kind, "status")
    return {
        "type": ui_type,
        "data": {"kind": kind, "message": event.get("message")},
    }


def normalize_ui_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Adapt Ropex `format=ui` payloads for Magentic frontend field expectations."""
    ui_type = event.get("type")
    data = dict(event.get("data") or {})

    if ui_type == "agent_log":
        if "content" not in data and "message" in data:
            data["content"] = data["message"]
        data.setdefault("metadata", {})

    if ui_type == "agent_complete" and data.get("error"):
        data.setdefault("status", "error")

    if ui_type == "plan":
        agents = data.get("agents")
        if isinstance(agents, list):
            data["agents"] = [
                {**agent, "status": agent.get("status", "pending")} for agent in agents
            ]

    if ui_type == "complete":
        data.setdefault("session_id", data.get("pipeline_id"))

    return {"type": ui_type, "data": data}


def _parse_sse_payload(line: str, sse_event: Optional[str]) -> Optional[Dict[str, Any]]:
    """Parse one SSE `data:` line (and optional preceding `event:` name)."""
    if sse_event == "end":
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            payload = {}
        if isinstance(payload, dict) and payload.get("type") == "stream_end":
            return normalize_ui_event(payload)
        pipeline_id = payload.get("pipelineId") or payload.get("pipeline_id")
        return {"type": "stream_end", "data": {"pipeline_id": pipeline_id}}

    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        logger.warning("Skipping invalid SSE JSON from Ropex: %s", line[:200])
        return None

    if "type" in payload and "kind" not in payload:
        return normalize_ui_event(payload)
    return normalize_ui_event(map_ropex_event_to_ui(payload))


def _extract_ropex_error(response: httpx.Response) -> str:
    try:
        body = response.json()
        if isinstance(body, dict) and body.get("error"):
            return str(body["error"])
    except Exception:
        pass
    return response.text or f"HTTP {response.status_code}"


class RopexExecutor:
    """Submit pipelines to Ropex and relay SSE UI events to Magentic WebSockets."""

    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 600.0,
        async_drain: bool = True,
        concurrency: Optional[int] = None,
    ):
        if not base_url:
            raise ValueError("ROPEX_BASE_URL is required for RopexExecutor")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.async_drain = async_drain
        self.concurrency = concurrency
        self.pipeline_path = "/api/v1/pipeline"
        self.events_path = "/api/v1/events"

    def _client(self, *, stream: bool = False) -> httpx.AsyncClient:
        timeout = httpx.Timeout(None if stream else self.timeout, connect=30.0)
        return httpx.AsyncClient(base_url=self.base_url, timeout=timeout)

    async def _post_pipeline(self, body: Dict[str, Any]) -> Dict[str, Any]:
        async with self._client() as client:
            response = await client.post(self.pipeline_path, json=body)
            if response.status_code >= 400:
                raise RopexApiError(
                    _extract_ropex_error(response),
                    status_code=response.status_code,
                )
            return response.json()

    async def submit_pipeline(
        self,
        prompt: str,
        *,
        stages: Optional[list] = None,
        agents: Optional[list] = None,
        drain: Optional[bool] = None,
        concurrency: Optional[int] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/pipeline — plan + enqueue (optionally drain) stages."""
        body: Dict[str, Any] = {
            "prompt": prompt,
            "drain": False if drain is None and self.async_drain else (True if drain is None else drain),
        }
        if stages is not None:
            body["stages"] = stages
        if agents is not None:
            body["agents"] = agents
        conc = self.concurrency if concurrency is None else concurrency
        if conc is not None:
            body["concurrency"] = conc
        return await self._post_pipeline(body)

    async def drain_pipeline(
        self,
        pipeline_id: str,
        *,
        concurrency: Optional[int] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/pipeline { action: drain, pipelineId } — scoped sequential drain."""
        body: Dict[str, Any] = {"action": "drain", "pipelineId": pipeline_id}
        conc = self.concurrency if concurrency is None else concurrency
        if conc is not None:
            body["concurrency"] = conc
        return await self._post_pipeline(body)

    async def get_pipeline(self, pipeline_id: str) -> Dict[str, Any]:
        """GET /api/v1/pipeline?id= — status, stages, persisted events."""
        async with self._client() as client:
            response = await client.get(self.pipeline_path, params={"id": pipeline_id})
            if response.status_code >= 400:
                raise RopexApiError(
                    _extract_ropex_error(response),
                    status_code=response.status_code,
                )
            return response.json()

    async def list_pipelines(self) -> Dict[str, Any]:
        """GET /api/v1/pipeline — recent pipeline runs."""
        async with self._client() as client:
            response = await client.get(self.pipeline_path)
            if response.status_code >= 400:
                raise RopexApiError(
                    _extract_ropex_error(response),
                    status_code=response.status_code,
                )
            return response.json()

    async def health_check(self) -> Dict[str, Any]:
        """Lightweight Ropex reachability check via pipeline list."""
        listed = await self.list_pipelines()
        return {"status": "healthy", "pipelines_total": listed.get("total", 0)}

    async def iter_ui_events(
        self,
        pipeline_id: str,
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """GET /api/v1/events?pipelineId=&format=ui — yield Magentic `{type, data}` payloads."""
        params = {"pipelineId": pipeline_id, "format": "ui"}
        sse_event: Optional[str] = None

        async with self._client(stream=True) as client:
            async with client.stream("GET", self.events_path, params=params) as response:
                if response.status_code >= 400:
                    raise RopexApiError(
                        _extract_ropex_error(response),
                        status_code=response.status_code,
                    )
                async for line in response.aiter_lines():
                    if cancel_event is not None and cancel_event.is_set():
                        raise asyncio.CancelledError("Ropex SSE cancelled")
                    if not line or line.startswith(":"):
                        continue
                    if line.startswith("event:"):
                        sse_event = line[6:].strip()
                        continue
                    if not line.startswith("data:"):
                        continue

                    raw = line[5:].strip()
                    if not raw:
                        continue

                    event = _parse_sse_payload(raw, sse_event)
                    sse_event = None
                    if event is None:
                        continue

                    yield event
                    if event.get("type") in SSE_TERMINAL_UI_TYPES:
                        return

    async def execute_query(
        self,
        query: str,
        stream: bool = False,
        plan: Any = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        """Run a query on Ropex (non-WebSocket). Uses synchronous drain."""
        del stream, plan
        if cancel_event is not None and cancel_event.is_set():
            raise asyncio.CancelledError("Execution cancelled")

        result = await self.submit_pipeline(query, drain=True)
        pipeline = result.get("pipeline") or {}
        pipeline_id = pipeline.get("id", "")
        output = pipeline.get("output") or ""

        if pipeline_id:
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

    async def _forward_ui_event(
        self,
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        event: Dict[str, Any],
    ) -> tuple[Optional[str], bool, bool]:
        """Forward one UI event. Returns (output, saw_complete, stop)."""
        event = normalize_ui_event(event)
        ui_type = event.get("type")
        data = event.get("data") or {}
        final_output: Optional[str] = None
        saw_complete = False
        stop = False

        if ui_type == "error":
            await send_json(
                {
                    "type": "error",
                    "message": data.get("message") or "Ropex error",
                    "data": data,
                }
            )
            return None, False, True

        if ui_type == "complete":
            final_output = data.get("output") or ""
            await send_json(
                {
                    "type": "complete",
                    "data": {
                        "output": final_output,
                        "session_id": data.get("session_id") or data.get("pipeline_id"),
                        "pipeline_id": data.get("pipeline_id"),
                        "execution_time": data.get("execution_time", 0),
                        "token_usage": data.get("token_usage"),
                        "references": data.get("references", []),
                        "artifacts": data.get("artifacts", []),
                    },
                }
            )
            return final_output, True, False

        if ui_type == "stream_end":
            await send_json(event)
            return None, False, True

        await send_json(event)
        return None, False, False

    async def _finalize_terminal(
        self,
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        pipeline_id: str,
        *,
        saw_complete: bool,
        saw_stream_end: bool,
        final_output: str,
    ) -> tuple[str, bool]:
        """Emit terminal events from persisted pipeline state when SSE gating missed them."""
        if saw_complete and saw_stream_end:
            return final_output, True

        pipeline_state = await self.get_pipeline(pipeline_id)
        status = pipeline_state.get("status", "")
        output = pipeline_state.get("output") or final_output

        if status == "failed":
            message = pipeline_state.get("error") or "Ropex pipeline failed"
            if not saw_complete:
                await send_json({"type": "error", "message": message, "data": {"pipeline_id": pipeline_id}})
            elif not saw_stream_end:
                await send_json({"type": "stream_end", "data": {"pipeline_id": pipeline_id}})
            raise RuntimeError(message)

        if status not in TERMINAL_PIPELINE_STATUSES:
            raise RuntimeError(
                f"Ropex pipeline {pipeline_id} did not reach a terminal state (status={status})"
            )

        if not saw_complete:
            await send_json(
                {
                    "type": "complete",
                    "data": {
                        "output": output,
                        "session_id": pipeline_id,
                        "pipeline_id": pipeline_id,
                        "execution_time": 0,
                        "references": [],
                        "artifacts": [],
                    },
                }
            )

        if not saw_stream_end:
            await send_json({"type": "stream_end", "data": {"pipeline_id": pipeline_id}})

        return output, True

    async def _consume_sse_lines(
        self,
        lines: AsyncIterator[str],
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> tuple[str, bool, bool]:
        final_output = ""
        saw_complete = False
        saw_stream_end = False
        sse_event: Optional[str] = None

        async for line in lines:
            if cancel_event is not None and cancel_event.is_set():
                raise asyncio.CancelledError("Ropex relay cancelled")
            if not line or line.startswith(":"):
                continue
            if line.startswith("event:"):
                sse_event = line[6:].strip()
                continue
            if not line.startswith("data:"):
                continue

            raw = line[5:].strip()
            if not raw:
                continue

            event = _parse_sse_payload(raw, sse_event)
            sse_event = None
            if event is None:
                continue

            out, complete, stop = await self._forward_ui_event(send_json, event)
            if out is not None:
                final_output = out
            if complete:
                saw_complete = True
            if event.get("type") == "stream_end":
                saw_stream_end = True
            if stop:
                break

        return final_output, saw_complete, saw_stream_end

    async def relay_to_websocket(
        self,
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        query: str,
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        """Submit to Ropex and relay format=ui SSE events via send_json (WebSocket).

        Default (async_drain=True): submit with drain=false, open SSE, then scoped drain
        so events stream live while stages run sequentially (Ropex Magentic adapter flow).
        """
        if cancel_event is not None and cancel_event.is_set():
            raise asyncio.CancelledError("Execution cancelled before submit")

        await send_json(
            {"type": "status", "message": "Submitting to Ropex...", "stage": "ropex_submit"}
        )

        if self.async_drain:
            return await self._relay_async_drain(send_json, query, cancel_event=cancel_event)
        return await self._relay_sync_drain(send_json, query, cancel_event=cancel_event)

    async def _relay_async_drain(
        self,
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        query: str,
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        submit = await self.submit_pipeline(query, drain=False)
        pipeline = submit.get("pipeline") or {}
        pipeline_id = pipeline.get("id")
        if not pipeline_id:
            raise RuntimeError("Ropex did not return a pipeline id")

        final_output = ""
        saw_complete = False
        saw_stream_end = False
        drain_task: Optional[asyncio.Task] = None

        try:
            params = {"pipelineId": pipeline_id, "format": "ui"}

            async with self._client(stream=True) as client:
                async with client.stream("GET", self.events_path, params=params) as response:
                    if response.status_code >= 400:
                        raise RopexApiError(
                            _extract_ropex_error(response),
                            status_code=response.status_code,
                        )
                    drain_task = asyncio.create_task(self.drain_pipeline(pipeline_id))
                    final_output, saw_complete, saw_stream_end = await self._consume_sse_lines(
                        response.aiter_lines(),
                        send_json,
                        cancel_event=cancel_event,
                    )
        finally:
            if drain_task is not None:
                try:
                    await drain_task
                except Exception as exc:
                    logger.warning("Ropex drain task failed: %s", exc)
                    if not saw_complete:
                        raise

        final_output, _ = await self._finalize_terminal(
            send_json,
            pipeline_id,
            saw_complete=saw_complete,
            saw_stream_end=saw_stream_end,
            final_output=final_output,
        )

        return {
            "final_output": final_output,
            "session_id": pipeline_id,
            "execution_time": 0,
            "references": [],
            "artifacts": [],
            "pipeline": pipeline,
        }

    async def _relay_sync_drain(
        self,
        send_json: Callable[[Dict[str, Any]], Awaitable[None]],
        query: str,
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        result = await self.submit_pipeline(query, drain=True)
        pipeline = result.get("pipeline") or {}
        pipeline_id = pipeline.get("id")
        if not pipeline_id:
            raise RuntimeError("Ropex did not return a pipeline id")

        final_output = pipeline.get("output") or ""
        saw_complete = False
        saw_stream_end = False

        async for event in self.iter_ui_events(pipeline_id, cancel_event=cancel_event):
            out, complete, stop = await self._forward_ui_event(send_json, event)
            if out is not None:
                final_output = out
            if complete:
                saw_complete = True
            if event.get("type") == "stream_end":
                saw_stream_end = True
            if stop:
                break

        final_output, _ = await self._finalize_terminal(
            send_json,
            pipeline_id,
            saw_complete=saw_complete,
            saw_stream_end=saw_stream_end,
            final_output=final_output,
        )

        return {
            "final_output": final_output,
            "session_id": pipeline_id,
            "execution_time": 0,
            "references": [],
            "artifacts": [],
            "pipeline": pipeline,
        }

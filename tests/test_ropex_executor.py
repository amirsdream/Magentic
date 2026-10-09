"""Tests for Ropex execution engine config and client."""

import json

import pytest

from src.config import Config
from src.engines.ropex_executor import (
    ROPEX_KIND_TO_UI_TYPE,
    RopexApiError,
    RopexExecutor,
    agents_to_workflow_yaml,
    map_ropex_event_to_ui,
    normalize_ui_event,
)


class TestExecutionEngineConfig:
    """EXECUTION_ENGINE / ROPEX_BASE_URL configuration."""

    def test_default_engine_is_langgraph(self, monkeypatch):
        monkeypatch.delenv("EXECUTION_ENGINE", raising=False)
        monkeypatch.delenv("ROPEX_BASE_URL", raising=False)
        config = Config()
        assert config.execution_engine == "langgraph"
        assert config.ropex_base_url == ""

    def test_ropex_auto_selected_when_base_url_set(self, monkeypatch):
        monkeypatch.delenv("EXECUTION_ENGINE", raising=False)
        monkeypatch.setenv("ROPEX_BASE_URL", "http://127.0.0.1:7780")
        config = Config()
        assert config.execution_engine == "ropex"
        assert config.ropex_base_url == "http://127.0.0.1:7780"

    def test_ropex_engine_env(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://127.0.0.1:7780/")
        config = Config()
        assert config.execution_engine == "ropex"
        assert config.ropex_base_url == "http://127.0.0.1:7780"

    def test_ropex_async_drain_default(self, monkeypatch):
        monkeypatch.delenv("ROPEX_ASYNC_DRAIN", raising=False)
        config = Config()
        assert config.ropex_async_drain is True

    def test_require_approval_defaults_on_for_ropex(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.delenv("ROPEX_REQUIRE_APPROVAL", raising=False)
        config = Config()
        assert config.ropex_require_approval is True

    def test_require_approval_defaults_off_for_langgraph(self, monkeypatch):
        monkeypatch.delenv("EXECUTION_ENGINE", raising=False)
        monkeypatch.delenv("ROPEX_BASE_URL", raising=False)
        monkeypatch.delenv("ROPEX_REQUIRE_APPROVAL", raising=False)
        config = Config()
        assert config.execution_engine == "langgraph"
        assert config.ropex_require_approval is False

    def test_require_approval_env_override(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_REQUIRE_APPROVAL", "false")
        config = Config()
        assert config.ropex_require_approval is False

    def test_ropex_defaults_local_base_url(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.delenv("ROPEX_BASE_URL", raising=False)
        config = Config()
        assert config.ropex_base_url == "http://127.0.0.1:7780"
        is_valid, error = config.validate()
        assert is_valid is True
        assert error is None

    def test_ropex_valid_with_base_url(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://127.0.0.1:7780")
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        config = Config()
        is_valid, error = config.validate()
        assert is_valid is True
        assert error is None

    def test_invalid_engine(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "unknown")
        config = Config()
        is_valid, error = config.validate()
        assert is_valid is False
        assert error is not None and "EXECUTION_ENGINE" in error


class TestRopexEventMapping:
    """Map Ropex kinds → Magentic WebSocket types (aligned with ropex mapExecutorEventToUi)."""

    def test_kind_map_covers_required_types(self):
        assert set(ROPEX_KIND_TO_UI_TYPE.values()) == {
            "status",
            "plan",
            "agent_start",
            "agent_log",
            "agent_complete",
            "complete",
            "error",
            "stream_end",
        }

    def test_map_pipeline_start(self):
        mapped = map_ropex_event_to_ui(
            {"pipelineId": "p1", "kind": "pipeline.start", "message": "do work"}
        )
        assert mapped["type"] == "status"
        assert mapped["data"]["pipeline_id"] == "p1"

    def test_map_plan_with_agents_json(self):
        agents = [
            {
                "agent_id": "p1:research",
                "role": "researcher",
                "layer": 1,
                "task": "Gather sources",
            }
        ]
        mapped = map_ropex_event_to_ui(
            {
                "pipelineId": "p1",
                "kind": "pipeline.plan",
                "message": "research→researcher",
                "meta": {"stages": 1, "agents": json.dumps(agents)},
            }
        )
        assert mapped["type"] == "plan"
        assert mapped["data"]["agents"] == agents
        assert mapped["data"]["total_agents"] == 1

    def test_map_agent_start(self):
        mapped = map_ropex_event_to_ui(
            {
                "pipelineId": "p1",
                "kind": "stage.start",
                "stageId": "research",
                "taskId": "p1:research",
                "agent": "researcher",
                "meta": {"role": "researcher"},
            }
        )
        assert mapped["type"] == "agent_start"
        assert mapped["data"]["role"] == "researcher"

    def test_map_agent_log_with_log_type(self):
        mapped = map_ropex_event_to_ui(
            {
                "pipelineId": "p1",
                "kind": "stage.log",
                "stageId": "research",
                "taskId": "p1:research",
                "message": "thinking…",
                "meta": {"log_type": "thought"},
            }
        )
        assert mapped["type"] == "agent_log"
        assert mapped["data"]["log_type"] == "thought"
        assert mapped["data"]["content"] == "thinking…"

    def test_map_stage_failed_as_agent_complete_with_error(self):
        mapped = map_ropex_event_to_ui(
            {
                "pipelineId": "p1",
                "kind": "stage.failed",
                "stageId": "research",
                "taskId": "p1:research",
                "message": "boom",
                "meta": {"role": "researcher", "error": True},
            }
        )
        assert mapped["type"] == "agent_complete"
        assert mapped["data"]["error"] is True
        assert mapped["data"]["status"] == "error"

    def test_map_pipeline_end_as_stream_end(self):
        mapped = map_ropex_event_to_ui(
            {"pipelineId": "p1", "kind": "pipeline.end", "message": "closed"}
        )
        assert mapped["type"] == "stream_end"

    def test_normalize_agent_log_message_to_content(self):
        normalized = normalize_ui_event(
            {
                "type": "agent_log",
                "data": {"message": "hello", "log_type": "thought", "agent_id": "a1"},
            }
        )
        assert normalized["data"]["content"] == "hello"


class TestRopexExecutorInit:
    """Engine construction — no LangGraph fallback."""

    def test_requires_base_url(self):
        with pytest.raises(ValueError, match="ROPEX_BASE_URL"):
            RopexExecutor("")

    def test_init_from_config(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://127.0.0.1:7780")
        config = Config()
        executor = RopexExecutor(config.ropex_base_url, async_drain=config.ropex_async_drain)
        assert executor.base_url == "http://127.0.0.1:7780"
        assert executor.async_drain is True

    def test_startup_selects_ropex_not_langgraph(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://ropex:7780")
        config = Config()
        is_valid, _ = config.validate()
        assert is_valid

        if config.execution_engine == "ropex":
            executor = RopexExecutor(
                base_url=config.ropex_base_url,
                async_drain=config.ropex_async_drain,
            )
        else:
            pytest.fail("Must not fall back to LangGraph when EXECUTION_ENGINE=ropex")

        assert isinstance(executor, RopexExecutor)
        assert not hasattr(executor, "graph_builder")


class TestRopexExecutorHttp:
    """Submit + async drain + SSE relay with mocked httpx."""

    @pytest.mark.asyncio
    async def test_async_drain_relay(self, monkeypatch):
        httpx = pytest.importorskip("httpx")

        pipeline_id = "pipe-123"
        ui_events = [
            {
                "type": "plan",
                "data": {
                    "message": "only→researcher",
                    "agents": [{"agent_id": f"{pipeline_id}:only", "role": "researcher", "layer": 1}],
                },
            },
            {"type": "agent_start", "data": {"agent_id": f"{pipeline_id}:only", "role": "researcher"}},
            {"type": "agent_log", "data": {"agent_id": f"{pipeline_id}:only", "log_type": "thought", "message": "planning"}},
            {"type": "agent_complete", "data": {"agent_id": f"{pipeline_id}:only", "output": "ok"}},
            {"type": "complete", "data": {"output": "final answer", "pipeline_id": pipeline_id}},
            {"type": "stream_end", "data": {"pipeline_id": pipeline_id}},
        ]

        posts = []

        class FakeResponse:
            def __init__(self, status_code=200, json_data=None, lines=None):
                self.status_code = status_code
                self._json = json_data or {}
                self._lines = lines or []

            def raise_for_status(self):
                if self.status_code >= 400:
                    raise httpx.HTTPStatusError(
                        "err", request=httpx.Request("GET", "http://x"), response=self
                    )

            def json(self):
                return self._json

            async def aiter_lines(self):
                for line in self._lines:
                    yield line

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, path, json=None):
                posts.append(json)
                assert path == "/api/v1/pipeline"
                if json.get("action") == "drain":
                    return FakeResponse(
                        json_data={
                            "ok": True,
                            "action": "drain",
                            "pipeline": {
                                "id": pipeline_id,
                                "status": "done",
                                "output": "final answer",
                            },
                            "drained": 1,
                        }
                    )
                assert json["prompt"] == "hello"
                assert json["drain"] is False
                return FakeResponse(
                    json_data={
                        "ok": True,
                        "pipeline": {"id": pipeline_id, "status": "running"},
                    }
                )

            async def get(self, path, params=None):
                return FakeResponse(json_data={"id": pipeline_id, "status": "done", "output": "final answer"})

            def stream(self, method, path, params=None):
                assert method == "GET"
                assert path == "/api/v1/events"
                assert params["pipelineId"] == pipeline_id
                assert params["format"] == "ui"
                lines = [f"data: {json.dumps(e)}" for e in ui_events]
                lines.append(f"event: end\ndata: {json.dumps({'pipelineId': pipeline_id})}")
                return FakeResponse(lines=lines)

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

        executor = RopexExecutor("http://127.0.0.1:7780", async_drain=True)
        sent = []

        async def send_json(payload):
            sent.append(payload)

        result = await executor.relay_to_websocket(send_json, "hello")
        assert result["final_output"] == "final answer"
        assert posts[0]["drain"] is False
        assert posts[1]["action"] == "drain"
        assert posts[1]["pipelineId"] == pipeline_id

        types = [e["type"] for e in sent if e["type"] != "status"]
        assert "plan" in types
        assert "agent_log" in types
        assert sent[-1]["type"] in ("stream_end", "complete")

        log_event = next(e for e in sent if e["type"] == "agent_log")
        assert log_event["data"]["content"] == "planning"

    @pytest.mark.asyncio
    async def test_sync_drain_relay(self, monkeypatch):
        httpx = pytest.importorskip("httpx")

        pipeline_id = "pipe-456"
        ui_events = [
            {"type": "complete", "data": {"output": "sync out", "pipeline_id": pipeline_id}},
            {"type": "stream_end", "data": {"pipeline_id": pipeline_id}},
        ]

        class FakeResponse:
            def __init__(self, status_code=200, json_data=None, lines=None):
                self.status_code = status_code
                self._json = json_data or {}
                self._lines = lines or []

            def raise_for_status(self):
                pass

            def json(self):
                return self._json

            async def aiter_lines(self):
                for line in self._lines:
                    yield line

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, path, json=None):
                assert json["drain"] is True
                return FakeResponse(
                    json_data={
                        "ok": True,
                        "pipeline": {
                            "id": pipeline_id,
                            "status": "done",
                            "output": "sync out",
                        },
                    }
                )

            def stream(self, method, path, params=None):
                lines = [f"data: {json.dumps(e)}" for e in ui_events]
                return FakeResponse(lines=lines)

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

        executor = RopexExecutor("http://127.0.0.1:7780", async_drain=False)
        sent = []

        async def send_json(payload):
            sent.append(payload)

        result = await executor.relay_to_websocket(send_json, "sync query")
        assert result["final_output"] == "sync out"

    @pytest.mark.asyncio
    async def test_submit_unknown_agent_raises_ropex_api_error(self, monkeypatch):
        httpx = pytest.importorskip("httpx")

        class FakeResponse:
            status_code = 400

            def json(self):
                return {"error": "unknown agent(s): ghost — apply fleet manifests first"}

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, path, json=None):
                return FakeResponse()

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        executor = RopexExecutor("http://127.0.0.1:7780")

        with pytest.raises(RopexApiError, match="unknown agent"):
            await executor.submit_pipeline("bad prompt", drain=False)

    @pytest.mark.asyncio
    async def test_finalize_rejects_non_terminal_pipeline(self, monkeypatch):
        httpx = pytest.importorskip("httpx")

        pipeline_id = "pipe-partial"

        class FakeResponse:
            def __init__(self, status_code=200, json_data=None, lines=None):
                self.status_code = status_code
                self._json = json_data or {}
                self._lines = lines or []

            def json(self):
                return self._json

            async def aiter_lines(self):
                for line in self._lines:
                    yield line

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, path, json=None):
                if json.get("action") == "drain":
                    return FakeResponse(json_data={"ok": True, "pipeline": {"id": pipeline_id, "status": "running"}})
                return FakeResponse(json_data={"ok": True, "pipeline": {"id": pipeline_id, "status": "running"}})

            async def get(self, path, params=None):
                return FakeResponse(json_data={"id": pipeline_id, "status": "running", "output": ""})

            def stream(self, method, path, params=None):
                return FakeResponse(lines=[f"data: {json.dumps({'type': 'plan', 'data': {'agents': []}})}"])

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        executor = RopexExecutor("http://127.0.0.1:7780", async_drain=True)

        async def send_json(_payload):
            return None

        with pytest.raises(RuntimeError, match="terminal state"):
            await executor.relay_to_websocket(send_json, "partial")


class TestWorkflowYaml:
    def test_agents_to_workflow_yaml(self):
        yaml_text = agents_to_workflow_yaml(
            "pipe-1",
            {
                "description": "Research then write",
                "stages": 2,
                "agents": [
                    {
                        "agent_id": "pipe-1:research",
                        "role": "researcher",
                        "task": "Gather sources",
                        "layer": 1,
                        "status": "pending",
                    }
                ],
            },
            prompt="What is Ropex?",
        )
        assert "pipeline:" in yaml_text
        assert "stages:" in yaml_text
        assert "pipe-1" in yaml_text
        assert "researcher" in yaml_text
        assert "Gather sources" in yaml_text
        assert "What is Ropex?" in yaml_text


class TestHitlApprovalGate:
    @pytest.mark.asyncio
    async def test_approve_then_drain(self, monkeypatch):
        httpx = pytest.importorskip("httpx")
        asyncio = pytest.importorskip("asyncio")

        pipeline_id = "pipe-hitl"
        drain_calls = []
        agents = [
            {
                "agent_id": f"{pipeline_id}:research",
                "role": "researcher",
                "task": "Gather",
                "status": "pending",
            }
        ]

        class FakeResponse:
            def __init__(self, status_code=200, json_data=None, lines=None):
                self.status_code = status_code
                self._json = json_data or {}
                self._lines = lines or []

            def json(self):
                return self._json

            async def aiter_lines(self):
                for line in self._lines:
                    yield line
                    await asyncio.sleep(0)

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, path, json=None):
                if json and json.get("action") == "drain":
                    drain_calls.append(json.get("pipelineId"))
                    return FakeResponse(
                        json_data={"ok": True, "pipeline": {"id": pipeline_id, "status": "done"}}
                    )
                return FakeResponse(
                    json_data={"ok": True, "pipeline": {"id": pipeline_id, "status": "planned"}}
                )

            async def get(self, path, params=None):
                return FakeResponse(
                    json_data={"id": pipeline_id, "status": "done", "output": "final answer"}
                )

            def stream(self, method, path, params=None):
                return FakeResponse(
                    lines=[
                        f"data: {json.dumps({'type': 'plan', 'data': {'agents': agents, 'description': 'Plan'}})}",
                        f"data: {json.dumps({'type': 'complete', 'data': {'output': 'final answer', 'pipeline_id': pipeline_id}})}",
                        f"data: {json.dumps({'type': 'stream_end', 'data': {'pipeline_id': pipeline_id}})}",
                    ]
                )

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        executor = RopexExecutor(
            "http://127.0.0.1:7780", async_drain=True, require_approval=True
        )

        events = []

        async def send_json(payload):
            events.append(payload)

        async def approval_gate(info):
            assert info["pipeline_id"] == pipeline_id
            assert info["workflow_yaml"]
            assert "researcher" in info["workflow_yaml"]
            return True

        result = await executor.relay_to_websocket(
            send_json, "hitl query", approval_gate=approval_gate
        )
        assert result["final_output"] == "final answer"
        assert drain_calls == [pipeline_id]
        assert any(e.get("type") == "plan" for e in events)
        assert any(
            e.get("stage") == "awaiting_approval" or e.get("type") == "status"
            for e in events
        )

    @pytest.mark.asyncio
    async def test_reject_skips_drain(self, monkeypatch):
        httpx = pytest.importorskip("httpx")
        asyncio = pytest.importorskip("asyncio")

        pipeline_id = "pipe-reject"
        drain_calls = []

        class FakeResponse:
            def __init__(self, status_code=200, json_data=None, lines=None):
                self.status_code = status_code
                self._json = json_data or {}
                self._lines = lines or []

            def json(self):
                return self._json

            async def aiter_lines(self):
                for line in self._lines:
                    yield line
                    await asyncio.sleep(0)

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

        class FakeClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, path, json=None):
                if json and json.get("action") == "drain":
                    drain_calls.append(json.get("pipelineId"))
                    return FakeResponse(json_data={"ok": True})
                return FakeResponse(
                    json_data={"ok": True, "pipeline": {"id": pipeline_id, "status": "planned"}}
                )

            async def get(self, path, params=None):
                return FakeResponse(
                    json_data={"id": pipeline_id, "status": "planned", "output": ""}
                )

            def stream(self, method, path, params=None):
                return FakeResponse(
                    lines=[
                        f"data: {json.dumps({'type': 'plan', 'data': {'agents': [{'agent_id': 'a', 'role': 'r'}]}})}",
                    ]
                )

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        executor = RopexExecutor(
            "http://127.0.0.1:7780", async_drain=True, require_approval=True
        )

        events = []

        async def send_json(payload):
            events.append(payload)

        async def approval_gate(_info):
            return False

        result = await executor.relay_to_websocket(
            send_json, "reject me", approval_gate=approval_gate
        )
        assert result.get("rejected") is True
        assert drain_calls == []
        assert any(e.get("type") == "stopped" for e in events)

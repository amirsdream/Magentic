"""Tests for Ropex execution engine config and client."""

import json

import pytest

from src.config import Config
from src.engines.ropex_executor import (
    ROPEX_KIND_TO_UI_TYPE,
    RopexExecutor,
    map_ropex_event_to_ui,
)


class TestExecutionEngineConfig:
    """EXECUTION_ENGINE / ROPEX_BASE_URL configuration."""

    def test_default_engine_is_langgraph(self, monkeypatch):
        monkeypatch.delenv("EXECUTION_ENGINE", raising=False)
        monkeypatch.delenv("ROPEX_BASE_URL", raising=False)
        config = Config()
        assert config.execution_engine == "langgraph"
        assert config.ropex_base_url == ""

    def test_ropex_engine_env(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://127.0.0.1:7780/")
        config = Config()
        assert config.execution_engine == "ropex"
        assert config.ropex_base_url == "http://127.0.0.1:7780"

    def test_ropex_requires_base_url(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.delenv("ROPEX_BASE_URL", raising=False)
        config = Config()
        is_valid, error = config.validate()
        assert is_valid is False
        assert error is not None and "ROPEX_BASE_URL" in error

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
    """Map Ropex kinds → Magentic WebSocket types."""

    def test_kind_map_covers_required_types(self):
        assert set(ROPEX_KIND_TO_UI_TYPE.values()) == {
            "plan",
            "agent_start",
            "agent_log",
            "agent_complete",
            "complete",
            "error",
        }

    def test_map_plan(self):
        mapped = map_ropex_event_to_ui(
            {
                "pipelineId": "p1",
                "kind": "pipeline.plan",
                "message": "research→researcher",
                "meta": {"stages": 2},
            }
        )
        assert mapped["type"] == "plan"
        assert mapped["data"]["stages"] == 2

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
        assert mapped["data"]["agent_id"] == "p1:research"

    def test_map_agent_log(self):
        mapped = map_ropex_event_to_ui(
            {"pipelineId": "p1", "kind": "stage.log", "stageId": "research", "message": "working"}
        )
        assert mapped["type"] == "agent_log"
        assert mapped["data"]["message"] == "working"

    def test_map_agent_complete(self):
        mapped = map_ropex_event_to_ui(
            {
                "pipelineId": "p1",
                "kind": "stage.complete",
                "stageId": "research",
                "taskId": "p1:research",
                "artifact": "findings",
                "meta": {"role": "researcher"},
            }
        )
        assert mapped["type"] == "agent_complete"
        assert mapped["data"]["output"] == "findings"

    def test_map_complete_and_error(self):
        complete = map_ropex_event_to_ui(
            {"pipelineId": "p1", "kind": "pipeline.complete", "artifact": "done"}
        )
        error = map_ropex_event_to_ui(
            {"pipelineId": "p1", "kind": "pipeline.error", "message": "boom"}
        )
        assert complete["type"] == "complete"
        assert complete["data"]["output"] == "done"
        assert error["type"] == "error"
        assert error["data"]["message"] == "boom"


class TestRopexExecutorInit:
    """Engine construction — no LangGraph fallback."""

    def test_requires_base_url(self):
        with pytest.raises(ValueError, match="ROPEX_BASE_URL"):
            RopexExecutor("")

    def test_init_from_config(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://127.0.0.1:7780")
        config = Config()
        assert config.execution_engine == "ropex"
        executor = RopexExecutor(config.ropex_base_url)
        assert executor.base_url == "http://127.0.0.1:7780"
        assert isinstance(executor, RopexExecutor)

    def test_startup_selects_ropex_not_langgraph(self, monkeypatch):
        """Mirror api.py startup branch: ropex → RopexExecutor only."""
        monkeypatch.setenv("EXECUTION_ENGINE", "ropex")
        monkeypatch.setenv("ROPEX_BASE_URL", "http://ropex:7780")
        config = Config()
        is_valid, _ = config.validate()
        assert is_valid

        if config.execution_engine == "ropex":
            executor = RopexExecutor(base_url=config.ropex_base_url)
        else:
            pytest.fail("Must not fall back to LangGraph when EXECUTION_ENGINE=ropex")

        assert isinstance(executor, RopexExecutor)
        assert not hasattr(executor, "graph_builder")


class TestRopexExecutorHttp:
    """Submit + SSE relay with mocked httpx."""

    @pytest.mark.asyncio
    async def test_submit_and_relay(self, monkeypatch):
        httpx = pytest.importorskip("httpx")

        pipeline_id = "pipe-123"
        ui_events = [
            {"type": "plan", "data": {"message": "a→b", "stages": 1}},
            {
                "type": "agent_start",
                "data": {"agent_id": "pipe-123:research", "role": "researcher"},
            },
            {
                "type": "agent_complete",
                "data": {"agent_id": "pipe-123:research", "output": "ok"},
            },
            {"type": "complete", "data": {"output": "final answer", "pipeline_id": pipeline_id}},
        ]

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
                assert path == "/api/v1/pipeline"
                assert json["prompt"] == "hello"
                return FakeResponse(
                    json_data={
                        "ok": True,
                        "pipeline": {
                            "id": pipeline_id,
                            "status": "done",
                            "output": "final answer",
                        },
                        "drained": 1,
                    }
                )

            def stream(self, method, path, params=None):
                assert method == "GET"
                assert path == "/api/v1/events"
                assert params["pipelineId"] == pipeline_id
                assert params["format"] == "ui"
                lines = [f"data: {json.dumps(e)}" for e in ui_events]
                return FakeResponse(lines=lines)

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

        executor = RopexExecutor("http://127.0.0.1:7780")
        sent = []

        async def send_json(payload):
            sent.append(payload)

        result = await executor.relay_to_websocket(send_json, "hello")
        assert result["final_output"] == "final answer"
        assert result["session_id"] == pipeline_id
        types = [e["type"] for e in sent if e["type"] != "status"]
        assert "plan" in types
        assert "agent_start" in types
        assert "agent_complete" in types
        assert types[-1] == "complete"

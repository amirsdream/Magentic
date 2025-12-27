"""Pytest configuration and fixtures."""

import pytest
import os


@pytest.fixture(autouse=True)
def test_env(monkeypatch):
    """Set test environment variables."""
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("ENABLE_RAG", "false")
    monkeypatch.setenv("ENABLE_MCP", "false")
    monkeypatch.setenv("ENABLE_OBSERVABILITY", "false")


@pytest.fixture
def config():
    """Create a test configuration."""
    from src.config import Config
    return Config()

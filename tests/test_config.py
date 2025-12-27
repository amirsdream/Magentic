"""Tests for configuration module."""

import os
import pytest
from src.config import Config


class TestConfig:
    """Test configuration loading."""

    def test_default_values(self):
        """Test default configuration values."""
        config = Config()
        assert config.llm_provider in ["ollama", "openai", "claude"]
        assert config.max_parallel_agents >= 1
        assert config.ui_display_limit >= 50

    def test_agent_context_limits(self, monkeypatch):
        """Test agent context limit defaults."""
        # Clear any existing env vars to test defaults
        monkeypatch.delenv("AGENT_CONTEXT_LIMIT", raising=False)
        monkeypatch.delenv("AGENT_HISTORY_LIMIT", raising=False)
        config = Config()
        assert config.agent_context_limit == 4000
        assert config.agent_history_limit == 500

    def test_validation_valid(self):
        """Test validation with valid config."""
        config = Config()
        config.llm_provider = "ollama"
        is_valid, error = config.validate()
        assert is_valid is True
        assert error is None

    def test_validation_invalid_provider(self):
        """Test validation with invalid provider."""
        config = Config()
        config.llm_provider = "invalid"
        is_valid, error = config.validate()
        assert is_valid is False
        assert error is not None and "LLM_PROVIDER" in error


class TestConfigEnvOverrides:
    """Test environment variable overrides."""

    def test_context_limit_override(self, monkeypatch):
        """Test AGENT_CONTEXT_LIMIT override."""
        monkeypatch.setenv("AGENT_CONTEXT_LIMIT", "8000")
        config = Config()
        assert config.agent_context_limit == 8000

    def test_history_limit_override(self, monkeypatch):
        """Test AGENT_HISTORY_LIMIT override."""
        monkeypatch.setenv("AGENT_HISTORY_LIMIT", "1000")
        config = Config()
        assert config.agent_history_limit == 1000

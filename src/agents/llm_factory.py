"""LLM factory for creating language model instances."""

import logging
from langchain_core.language_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

try:
    from langchain_anthropic import ChatAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    ChatAnthropic = None  # type: ignore[assignment,misc]

from ..config import Config

logger = logging.getLogger(__name__)


def create_llm(config: Config) -> BaseChatModel:
    """Create LLM instance based on configuration.
    
    Args:
        config: Application configuration
        
    Returns:
        Initialized LLM instance
        
    Raises:
        ValueError: If provider is unsupported or API key is missing
        ImportError: If required provider package is not installed
    """
    logger.info(f"🔧 Initializing LLM with provider: {config.llm_provider}")
    
    if config.llm_provider == "ollama":
        logger.info(f"   Using Ollama model: {config.ollama_model} at {config.ollama_base_url}")
        return ChatOllama(
            model=config.ollama_model,
            base_url=config.ollama_base_url,
            temperature=config.llm_temperature
        )
        
    elif config.llm_provider == "openai":
        logger.info(f"   Using OpenAI model: {config.openai_model}")
        if not config.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when using OpenAI provider")
        return ChatOpenAI(
            model=config.openai_model,
            api_key=config.openai_api_key if config.openai_api_key else None,  # type: ignore
            temperature=config.llm_temperature
        )
        
    elif config.llm_provider == "claude":
        logger.info(f"   Using Claude model: {config.anthropic_model}")
        if not config.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required when using Claude provider")
        if not HAS_ANTHROPIC or ChatAnthropic is None:
            raise ImportError(
                "langchain-anthropic is not installed. "
                "Install it with: pip install langchain-anthropic"
            )
        return ChatAnthropic(
            model_name=config.anthropic_model,
            anthropic_api_key=config.anthropic_api_key,  # type: ignore
            temperature=config.llm_temperature
        )
        
    else:
        raise ValueError(f"Unsupported LLM provider: {config.llm_provider}")

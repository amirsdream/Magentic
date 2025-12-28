# Changelog

## [1.2.0] - 2024-12-28

### Added
- **Real-time Usage Stats** — Profile modal now shows actual usage data:
  - Total Queries (calculated from conversations table)
  - Agents Run (calculated from conversations table)  
  - Total Tokens (accumulated from each query execution)
  - Total Cost (accumulated with cost calculation per LLM provider)
- **FastAPI-Users Integration** — Modern JWT-based authentication system
- **Theme Toggle** — Dark/light mode toggle in sidebar with proper persistence
- **Database Migrations** — Auto-migration system for schema updates on startup

### Changed
- Stats endpoint `/auth/me/stats` now calculates queries/agents from actual data
- `save_conversation()` now accumulates token usage and cost per user
- `get_or_create_user()` upgrades guest users to registered when they log in
- Theme stored per-user in profile, syncs on login

### Fixed
- Profile stats showing 0 — now calculated from real database data
- Theme toggle not persisting — fixed state sync between UI and user profile
- JWT secret mismatch between auth modules — now shared properly
- Guest users not upgrading — `is_guest` flag now updated on login

### Technical
- Token tracking extracts from nested `{"total": {"total_tokens": N}}` structure
- Removed redundant `total_queries` and `total_agents_executed` increments (now calculated)
- Added `total_tokens_used` and `total_cost` columns to user_profiles

## [1.1.0] - 2024-12-25

### Added
- **Token Usage Tracking** — Track prompt/completion tokens per agent and total
- **Layer Barrier Synchronization** — Ensures agents complete before next layer starts
- **Conversation History** — Agents receive context from previous steps
- **Debug State Visualization** — Set `DEBUG_STATE=true` to see execution flow

### Fixed
- Multi-agent context passing when 2-3 agents feed into next layer
- Chat persistence not loading on page refresh
- WebSocket event ordering for agent completion

### Configuration
```bash
DEBUG_STATE=true         # Enable state visualization
UI_DISPLAY_LIMIT=200     # Character limit for output display
```

## [1.0.0] - 2024-12-20

### Initial Release
- Dynamic meta-agent system with LangGraph
- Parallel agent execution in layers
- Web UI with real-time WebSocket updates
- User authentication with conversation history
- RAG support with Qdrant vector store
- MCP tool integration
- Support for Ollama, OpenAI, and Claude

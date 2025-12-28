# Changelog

All notable changes to Magentic are documented here.

## [1.3.0] - 2024-12-28

### Added
- **GitHub Pages Documentation** — Sphinx docs auto-deployed to GitHub Pages
- **Swagger/OpenAPI Documentation** — Interactive API docs at `/docs` and `/redoc`
- **Streaming Agent Logs** — Real-time activity logs in agent detail panel
- **Retry Execution** — Retry stopped/completed executions from UI
- **Agent Detail Modal** — Popup modal with Overview, Output, Activity, Tools tabs
- **Enhanced GitHub Actions** — Comprehensive CI/CD with security scanning, multi-arch Docker builds
- **Issue Templates** — Bug report and feature request templates
- **CODEOWNERS** — Automated code review assignment

### Changed
- Running agents now display blue color (indicator, progress bar, connections)
- View History button moved to right side with `ml-auto`
- Theme persistence uses localStorage with backend sync
- Simplified CI to test only Python 3.11 (application, not library)

### Fixed
- Modal freezing by removing framer-motion animations
- History not loading on first sidebar click
- Theme not persisting between sessions
- Token display for completed/stopped agents

### Technical
- Thread-safe log queue for streaming from executor to WebSocket
- WebSocket `AGENT_LOG` event type for real-time logs
- Portal-based modal rendering to `document.body`

## [1.2.0] - 2024-12-28

### Added
- **Real-time Usage Stats** — Profile shows queries, agents, tokens, cost
- **FastAPI-Users Integration** — Modern JWT-based authentication
- **Theme Toggle** — Dark/light mode with per-user persistence
- **Database Migrations** — Auto-migration on startup

### Changed
- Stats calculated from actual database data
- `save_conversation()` accumulates token usage per user
- Guest users upgrade to registered on login

### Fixed
- Profile stats showing 0
- Theme toggle not persisting
- JWT secret mismatch between auth modules

## [1.1.0] - 2024-12-25

### Added
- **Token Usage Tracking** — Per-agent and total token counts
- **Layer Barrier Synchronization** — Ensures layer completion order
- **Conversation History** — Context passing between agents
- **Debug State Visualization** — `DEBUG_STATE=true` shows execution flow

### Fixed
- Multi-agent context passing
- Chat persistence on page refresh
- WebSocket event ordering

## [1.0.0] - 2024-12-20

### Initial Release
- Dynamic meta-agent system with LangGraph
- Parallel agent execution in layers
- Web UI with real-time WebSocket updates
- User authentication with conversation history
- RAG support with Qdrant/ChromaDB
- MCP tool integration
- Support for Ollama, OpenAI, and Claude

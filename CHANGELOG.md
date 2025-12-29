# Changelog

All notable changes to Magentic are documented here.

## [1.5.0] - 2024-12-29

### Added
- **YAML Role Configuration** — Define agent roles in `config/roles.yaml` for easy customization
- **Role API Endpoints** — `/roles` and `/roles/reload` for dynamic role management
- **Cross-Agent Artifact Flow** — Artifacts created by early agents automatically available to later agents
- **Cross-Agent Reference Flow** — Citations from early agents passed to dependent agents with source attribution
- **Beautiful Artifact Preview** — Redesigned slide-in panel with:
  - Language-specific gradient accent bars
  - Animated file icons with sparkle effects
  - Line numbers with hover highlighting
  - Stats footer (line count, character count)
  - Blur backdrop and rounded corners
- **Enhanced Artifact Cards** — In message bubbles with:
  - Staggered entrance animations
  - Language-specific gradient icons
  - Pulse "new" indicator dots
  - Path preview and hover effects

### Changed
- **Filesystem Default for All Roles** — All agents now have filesystem access by default
- **Role Library from YAML** — Roles loaded from `config/roles.yaml` instead of hardcoded Python
- **Stable Message IDs** — Fixed UI flash/blink by using stable unique keys for messages

### Technical
- `available_references` state field with `operator.add` reducer for accumulating citations
- `DEFAULT_SERVERS = ["filesystem"]` in MCP client for universal file access
- `useRoles` hook fetches role config from backend API
- `RolesContext` provider for dynamic role icons/labels in workflow visualization
- Spring physics animations (stiffness: 260-400, damping: 15-25)

## [1.4.0] - 2024-12-29

### Added
- **Inline Citations** — Wikipedia-style numbered references `[1]`, `[2]` from RAG and web search
- **Citation Popovers** — Click citation badges to see source title, snippet, and relevance
- **Artifacts System** — Track files created by agents during execution
- **Artifact Preview Panel** — Claude-style slide-in panel for viewing created files
- **Syntax Highlighting** — Code preview with language-aware highlighting
- **HTML Preview Mode** — Preview HTML artifacts in iframe sandbox
- **Real Upload Progress** — XMLHttpRequest-based progress bar for KB uploads

### Changed
- Writer role no longer automatically saves files to filesystem
- Artifacts deduplicated by path (only latest version shown)
- KB badge always visible when documents exist
- References limited to top 8 most relevant with content previews

### Technical
- `_extract_artifacts_from_tool_output()` method in AgentExecutor
- Artifact deduplication using path-keyed dictionary
- MCP gateway `/execute` endpoint for artifact file retrieval
- `ArtifactPreviewPanel.jsx` component with copy/download actions

## [1.3.0] - 2024-12-28

### Added
- **Document Upload for RAG** — Upload documents to knowledge base via UI or API
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

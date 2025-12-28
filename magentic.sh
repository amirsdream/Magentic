#!/usr/bin/env bash
#
# Magentic - Unified Management Script
# Start, stop, and manage all services (MCP, Database, Application)
#
# This is a slim entrypoint that routes commands to modular CLI scripts.
#
# Modes:
#   dev  (default) - Local Python backend, local Node frontend, Docker MCP
#   prod           - Everything in Docker containers
#
# Usage:
#   ./magentic.sh [--dev|--prod] <command> [options]
#

set -e

# ============================================
# Paths
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$SCRIPT_DIR/cli"

# Source common utilities
source "$CLI_DIR/common.sh"

# ============================================
# Mode Banner
# ============================================

show_mode_banner() {
    if is_prod_mode; then
        echo -e "${MAGENTA}┌────────────────────────────────────┐${NC}"
        echo -e "${MAGENTA}│  🐳 PRODUCTION MODE (Docker)       │${NC}"
        echo -e "${MAGENTA}└────────────────────────────────────┘${NC}"
    else
        echo -e "${CYAN}┌────────────────────────────────────┐${NC}"
        echo -e "${CYAN}│  🔧 DEVELOPMENT MODE (Local)       │${NC}"
        echo -e "${CYAN}└────────────────────────────────────┘${NC}"
    fi
    echo
}

# ============================================
# Full Stack Management
# ============================================

start_all() {
    print_banner
    show_mode_banner
    
    # Load .env to check settings
    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        source "$SCRIPT_DIR/.env" 2>/dev/null || true
    fi
    
    if is_prod_mode; then
        start_prod
    else
        start_dev
    fi
}

# Development mode: Local processes + Docker MCP
start_dev() {
    log_info "Starting Magentic in DEVELOPMENT mode..."
    echo
    
    # 1. Initialize database
    source "$CLI_DIR/database.sh"
    db_init
    echo
    
    # 2. Start MCP (optional, continues if fails)
    source "$CLI_DIR/mcp.sh"
    mcp_start || true
    echo
    
    # 3. Start Observability stack if ENABLE_METRICS=true and Docker available
    if [[ "${ENABLE_METRICS:-false}" == "true" ]] && check_docker_silent; then
        log_info "Starting observability stack (ENABLE_METRICS=true)..."
        source "$CLI_DIR/observability.sh"
        observability_start || true
        echo
    fi
    
    # 4. Start API (local Python)
    source "$CLI_DIR/api.sh"
    api_start
    echo
    
    # 5. Start Frontend (local Node)
    if [[ -d "$SCRIPT_DIR/frontend" ]]; then
        source "$CLI_DIR/frontend.sh"
        frontend_start
        echo
    fi
    
    show_status
    
    echo
    log_success "Magentic is ready! (Development Mode)"
    echo
    echo -e "  ${CYAN}API:${NC}      http://localhost:$API_PORT"
    echo -e "  ${CYAN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    if is_mcp_running; then
        echo -e "  ${CYAN}MCP:${NC}      http://localhost:$MCP_GATEWAY_PORT"
    fi
    echo
    echo -e "  Run ${YELLOW}./magentic.sh cli${NC} for interactive mode"
    echo -e "  Run ${YELLOW}./magentic.sh stop${NC} to stop all services"
    echo -e "  Run ${YELLOW}./magentic.sh --prod start${NC} for production mode"
    echo
}

# Production mode: Everything in Docker
start_prod() {
    if ! check_docker; then
        log_error "Docker is required for production mode"
        exit 1
    fi
    
    log_info "Starting Magentic in PRODUCTION mode (Docker)..."
    echo
    
    use_docker_compose
    local compose_cmd=$(get_compose_cmd)
    
    # Setup MCP workspace
    source "$CLI_DIR/mcp.sh"
    setup_mcp_workspace
    
    # Create backend data directory
    mkdir -p "data/backend"
    if is_selinux_enabled; then
        set_selinux_context "data/backend"
    fi
    chmod 777 "data/backend" 2>/dev/null || true
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Building Production Images${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    # Build all images including app profile
    $compose_cmd --profile prod build
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Starting All Containers${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    # Start all services with prod profile
    $compose_cmd --profile prod up -d
    
    # Wait for backend
    echo
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=60
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -sf "http://localhost:8000/health" > /dev/null 2>&1; then
            break
        fi
        ((attempt++))
        printf "\r  ${BLUE}⋯${NC} Backend: %d/%ds" "$attempt" "$max_attempts"
        sleep 1
    done
    echo
    
    if [[ $attempt -ge $max_attempts ]]; then
        log_error "Backend failed to start"
        $compose_cmd logs --tail=20 magentic-backend
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    log_success "Backend is healthy"
    
    # Wait for frontend
    attempt=0
    while [[ $attempt -lt 30 ]]; do
        if curl -sf "http://localhost:8081/health" > /dev/null 2>&1; then
            break
        fi
        ((attempt++))
        printf "\r  ${BLUE}⋯${NC} Frontend: %d/30s" "$attempt"
        sleep 1
    done
    echo
    
    log_success "Frontend is healthy"
    
    # Show container status
    echo
    echo -e "${BLUE}Container Status:${NC}"
    $compose_cmd --profile prod ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -15
    
    cd "$SCRIPT_DIR"
    
    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log_success "Magentic is ready! (Production Mode)"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "  ${CYAN}Frontend:${NC}     http://localhost:8081"
    echo -e "  ${CYAN}API:${NC}          http://localhost:8000"
    echo -e "  ${CYAN}MCP Gateway:${NC}  http://localhost:9000"
    echo
    echo -e "  All services running in Docker containers"
    echo -e "  Run ${YELLOW}./magentic.sh --prod stop${NC} to stop"
    echo -e "  Run ${YELLOW}./magentic.sh --prod logs${NC} to view logs"
    echo
}

stop_all() {
    show_mode_banner
    
    if is_prod_mode; then
        stop_prod
    else
        stop_dev
    fi
}

stop_dev() {
    log_info "Stopping Magentic services (Development)..."
    echo
    
    # Stop local processes
    source "$CLI_DIR/frontend.sh"
    frontend_stop
    
    source "$CLI_DIR/api.sh"
    api_stop
    
    # Stop Docker containers if Docker is available
    if check_docker_silent; then
        # Stop observability stack
        source "$CLI_DIR/observability.sh"
        observability_stop 2>/dev/null || true
        
        # Stop MCP services
        source "$CLI_DIR/mcp.sh"
        mcp_stop
        
        # Clean up any stray containers from root docker-compose.yml
        # (in case they were started accidentally)
        log_info "Cleaning up any stray containers..."
        use_root_compose
        local compose_cmd=$(get_compose_cmd)
        $compose_cmd down --remove-orphans 2>/dev/null || true
        
        # Stop specific known containers by name (belt and suspenders)
        for container in magentic-app magentic-ollama magentic-phoenix magentic-qdrant; do
            if docker ps -q -f name="$container" 2>/dev/null | grep -q .; then
                log_info "Stopping leftover container: $container"
                docker stop "$container" 2>/dev/null || true
                docker rm "$container" 2>/dev/null || true
            fi
        done
    fi
    
    echo
    log_success "All services stopped"
}

stop_prod() {
    if ! check_docker_silent; then
        log_error "Docker not available"
        return 1
    fi
    
    log_info "Stopping Magentic containers (Production)..."
    echo
    
    # Stop docker/docker-compose.yml services
    use_docker_compose
    local compose_cmd=$(get_compose_cmd)
    
    # Stop all profiles
    $compose_cmd --profile prod down --remove-orphans 2>/dev/null || true
    $compose_cmd --profile observability down --remove-orphans 2>/dev/null || true
    $compose_cmd down --remove-orphans 2>/dev/null || true
    
    # Also stop root docker-compose.yml if it exists
    use_root_compose
    if [[ -f "docker-compose.yml" ]]; then
        $compose_cmd down --remove-orphans 2>/dev/null || true
    fi
    
    # Stop specific known containers by name (belt and suspenders)
    for container in magentic-app magentic-ollama magentic-phoenix magentic-qdrant magentic-backend magentic-frontend; do
        if docker ps -q -f name="$container" 2>/dev/null | grep -q .; then
            log_info "Stopping container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        fi
    done
    
    cd "$SCRIPT_DIR"
    
    echo
    log_success "All containers stopped"
}

remove_all() {
    log_warning "This will remove ALL Magentic data and resources!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Stop everything first
        source "$CLI_DIR/frontend.sh"
        frontend_stop 2>/dev/null || true
        
        source "$CLI_DIR/api.sh"
        api_stop 2>/dev/null || true
        
        # Remove all Docker resources
        if check_docker_silent; then
            local compose_cmd=$(get_compose_cmd)
            
            # Remove docker/docker-compose.yml services with volumes
            use_docker_compose
            $compose_cmd --profile prod down -v --remove-orphans 2>/dev/null || true
            $compose_cmd --profile observability down -v --remove-orphans 2>/dev/null || true
            $compose_cmd down -v --remove-orphans 2>/dev/null || true
            rm -rf data/* 2>/dev/null || true
            
            # Remove root docker-compose.yml services with volumes
            use_root_compose
            if [[ -f "docker-compose.yml" ]]; then
                $compose_cmd down -v --remove-orphans 2>/dev/null || true
            fi
            
            # Force remove any lingering containers
            for container in magentic-app magentic-ollama magentic-phoenix magentic-qdrant magentic-backend magentic-frontend mcp-gateway mcp-filesystem mcp-websearch mcp-github mcp-python mcp-database mcp-memory prometheus grafana loki promtail cadvisor; do
                docker rm -f "$container" 2>/dev/null || true
            done
            
            cd "$SCRIPT_DIR"
        fi
        
        # Remove database
        rm -f "$DB_PATH" 2>/dev/null || true
        
        # Remove logs and pid files
        rm -f "$DATA_DIR"/*.log 2>/dev/null || true
        rm -f "$DATA_DIR"/.*pid 2>/dev/null || true
        
        # Remove execution graphs
        rm -f "$SCRIPT_DIR/execution_graphs"/*.html 2>/dev/null || true
        
        log_success "All resources removed"
    else
        log_info "Cancelled"
    fi
}

# ============================================
# Status and Health
# ============================================

show_status() {
    echo
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                  Service Status                   ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo
    
    # Database
    if [[ -f "$DB_PATH" ]]; then
        local db_size=$(du -h "$DB_PATH" 2>/dev/null | cut -f1)
        echo -e "  Database:  ${GREEN}●${NC} Ready ($db_size)"
    else
        echo -e "  Database:  ${YELLOW}○${NC} Not initialized"
    fi
    
    # MCP Gateway
    if is_mcp_running; then
        local health=$(curl -sf "http://localhost:$MCP_GATEWAY_PORT/health" 2>/dev/null)
        if [[ -n "$health" ]]; then
            local healthy=$(echo "$health" | grep -o '"healthy_servers":[0-9]*' | cut -d: -f2)
            local total=$(echo "$health" | grep -o '"total_servers":[0-9]*' | cut -d: -f2)
            echo -e "  MCP:       ${GREEN}●${NC} Running ($healthy/$total servers)"
        else
            echo -e "  MCP:       ${YELLOW}●${NC} Starting..."
        fi
    else
        echo -e "  MCP:       ${RED}○${NC} Stopped"
    fi
    
    # API Server
    if is_api_running; then
        echo -e "  API:       ${GREEN}●${NC} Running (port $API_PORT)"
    else
        echo -e "  API:       ${RED}○${NC} Stopped"
    fi
    
    # Frontend
    if is_frontend_running; then
        echo -e "  Frontend:  ${GREEN}●${NC} Running (port $FRONTEND_PORT)"
    else
        echo -e "  Frontend:  ${RED}○${NC} Stopped"
    fi
    
    echo
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
}

health_check() {
    echo -e "${CYAN}Health Check${NC}"
    echo
    
    echo -n "Database: "
    if [[ -f "$DB_PATH" ]]; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}Not initialized${NC}"
    fi
    
    echo -n "MCP Gateway: "
    if curl -sf "http://localhost:$MCP_GATEWAY_PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}Unavailable${NC}"
    fi
    
    echo -n "API Server: "
    if curl -sf "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}Unavailable${NC}"
    fi
    
    echo -n "Frontend: "
    if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}Unavailable${NC}"
    fi
    
    echo -n "Metrics: "
    if curl -sf "http://localhost:$API_PORT/metrics" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}Disabled${NC}"
    fi
    
    echo -n "Prometheus: "
    if curl -sf "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    echo -n "Grafana: "
    if curl -sf "http://localhost:3000/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    echo
}

show_logs() {
    local service=${1:-}
    
    case $service in
        mcp)
            source "$CLI_DIR/mcp.sh"
            mcp_logs
            ;;
        api)
            source "$CLI_DIR/api.sh"
            api_logs
            ;;
        frontend)
            source "$CLI_DIR/frontend.sh"
            frontend_logs
            ;;
        metrics|observability)
            source "$CLI_DIR/observability.sh"
            observability_logs
            ;;
        *)
            log_info "Usage: ./magentic.sh logs [mcp|api|frontend|metrics]"
            ;;
    esac
}

# ============================================
# Help
# ============================================

show_help() {
    print_banner
    echo "Usage: ./magentic.sh [--dev|--prod] <command> [options]"
    echo
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  MODES${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  --dev               Development mode (default): Local Python/Node + Docker MCP"
    echo "  --prod              Production mode: Everything in Docker containers"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  SETUP${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  setup               First-time setup (venv, deps, config, Docker)"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  FULL STACK${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  start               Start all services (mode-dependent)"
    echo "  stop                Stop all services"
    echo "  restart             Restart all services"
    echo "  status              Show status of all services"
    echo "  remove              Remove all resources and data"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  BACKEND (API)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  cli                 Run interactive CLI mode"
    echo "  api                 Start API server (port $API_PORT)"
    echo "  api-stop            Stop API server"
    echo "  api-restart         Restart API server"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  FRONTEND${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  frontend            Start frontend dev server (port $FRONTEND_PORT)"
    echo "  frontend-stop       Stop frontend"
    echo "  frontend-restart    Restart frontend"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  MCP (Model Context Protocol) - Docker Services${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  mcp                 Start MCP Docker services"
    echo "  mcp-stop            Stop MCP services"
    echo "  mcp-restart         Restart MCP services"
    echo "  mcp-status          Show MCP status and health"
    echo "  mcp-logs [service]  Show MCP logs (all or specific service)"
    echo "  mcp-build           Build/rebuild MCP Docker images"
    echo "  mcp-remove          Remove MCP containers and data"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  OBSERVABILITY (Prometheus, Grafana, Loki)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  metrics             Start observability stack"
    echo "  metrics-stop        Stop observability stack"
    echo "  metrics-restart     Restart observability stack"
    echo "  metrics-status      Show observability status"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  DATABASE${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  db-init             Initialize/migrate database"
    echo "  db-reset            Reset database (deletes all data)"
    echo "  db-status           Show database status"
    echo "  db-backup           Backup database"
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  UTILITIES${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  logs [service]      Show logs (mcp|api|frontend|metrics|all)"
    echo "  health              Check health of all services"
    echo "  help                Show this help message"
    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  EXAMPLES${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "  ${CYAN}Development (default):${NC}"
    echo "    ./magentic.sh setup            # First-time setup"
    echo "    ./magentic.sh start            # Start in dev mode"
    echo "    ./magentic.sh cli              # Interactive CLI"
    echo "    ./magentic.sh stop             # Stop all"
    echo
    echo -e "  ${MAGENTA}Production (Docker):${NC}"
    echo "    ./magentic.sh --prod start     # Start all in Docker"
    echo "    ./magentic.sh --prod stop      # Stop all containers"
    echo "    ./magentic.sh --prod logs      # View all container logs"
    echo "    ./magentic.sh --prod status    # Container status"
    echo
}

# ============================================
# Main - Command Router
# ============================================

# Parse global flags
parse_flags() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                set_mode "dev"
                shift
                ;;
            --prod|--production)
                set_mode "prod"
                shift
                ;;
            *)
                # Return remaining args
                echo "$@"
                return 0
                ;;
        esac
    done
}

# Production mode logs
prod_logs() {
    local service=${1:-}
    
    if ! check_docker_silent; then
        log_error "Docker not available"
        return 1
    fi
    
    use_docker_compose
    local compose_cmd=$(get_compose_cmd)
    
    if [[ -n "$service" ]]; then
        log_info "Showing logs for $service..."
        $compose_cmd --profile prod logs -f --tail=100 "$service"
    else
        log_info "Showing logs for all services..."
        $compose_cmd --profile prod logs -f --tail=50
    fi
}

# Production mode status
prod_status() {
    if ! check_docker_silent; then
        log_error "Docker not available"
        return 1
    fi
    
    echo
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}        Production Container Status                ${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo
    
    use_docker_compose
    local compose_cmd=$(get_compose_cmd)
    
    $compose_cmd --profile prod ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    
    echo
}

main() {
    # Parse --dev/--prod flags first
    local remaining_args=$(parse_flags "$@")
    set -- $remaining_args
    
    local command=${1:-help}
    shift 2>/dev/null || true
    
    case $command in
        # Setup
        setup|install|init)
            source "$CLI_DIR/setup.sh"
            run_setup
            ;;
        
        # Full stack
        start)
            start_all
            ;;
        stop)
            stop_all
            ;;
        restart)
            stop_all
            sleep 2
            start_all
            ;;
        status)
            if is_prod_mode; then
                prod_status
            else
                show_status
            fi
            ;;
        remove|clean)
            remove_all
            ;;
        
        # CLI / Interactive
        cli|run)
            source "$CLI_DIR/api.sh"
            cli_start
            ;;
        
        # API Backend
        api|api-start)
            source "$CLI_DIR/api.sh"
            api_start
            ;;
        api-stop)
            source "$CLI_DIR/api.sh"
            api_stop
            ;;
        api-restart)
            source "$CLI_DIR/api.sh"
            api_restart
            ;;
        api-status)
            source "$CLI_DIR/api.sh"
            api_status
            ;;
        
        # MCP Docker services
        mcp|mcp-start)
            source "$CLI_DIR/mcp.sh"
            mcp_start
            ;;
        mcp-stop)
            source "$CLI_DIR/mcp.sh"
            mcp_stop
            ;;
        mcp-restart)
            source "$CLI_DIR/mcp.sh"
            mcp_restart
            ;;
        mcp-status)
            source "$CLI_DIR/mcp.sh"
            mcp_status
            ;;
        mcp-logs)
            source "$CLI_DIR/mcp.sh"
            mcp_logs "$@"
            ;;
        mcp-build)
            source "$CLI_DIR/mcp.sh"
            mcp_build "$@"
            ;;
        mcp-remove)
            source "$CLI_DIR/mcp.sh"
            mcp_remove
            ;;
        
        # Frontend
        frontend|ui|frontend-start|ui-start)
            source "$CLI_DIR/frontend.sh"
            frontend_start
            ;;
        frontend-stop|ui-stop)
            source "$CLI_DIR/frontend.sh"
            frontend_stop
            ;;
        frontend-restart|ui-restart)
            source "$CLI_DIR/frontend.sh"
            frontend_restart
            ;;
        frontend-status|ui-status)
            source "$CLI_DIR/frontend.sh"
            frontend_status
            ;;
        frontend-install|ui-install)
            source "$CLI_DIR/frontend.sh"
            frontend_install
            ;;
        
        # Observability
        metrics|observability|metrics-start|observability-start)
            source "$CLI_DIR/observability.sh"
            observability_start
            ;;
        metrics-stop|observability-stop)
            source "$CLI_DIR/observability.sh"
            observability_stop
            ;;
        metrics-restart|observability-restart)
            source "$CLI_DIR/observability.sh"
            observability_restart
            ;;
        metrics-status|observability-status)
            source "$CLI_DIR/observability.sh"
            observability_status
            ;;
        
        # Database
        db-init|db|migrate)
            source "$CLI_DIR/database.sh"
            db_init
            ;;
        db-reset)
            source "$CLI_DIR/database.sh"
            db_reset
            ;;
        db-status)
            source "$CLI_DIR/database.sh"
            db_status
            ;;
        db-backup)
            source "$CLI_DIR/database.sh"
            db_backup
            ;;
        
        # Utilities
        logs)
            if is_prod_mode; then
                prod_logs "$@"
            else
                show_logs "$@"
            fi
            ;;
        health)
            health_check
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo "Run './magentic.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"

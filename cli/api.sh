#!/usr/bin/env bash
#
# cli/api.sh - API Backend Server Management
# Handles FastAPI server operations
#

# Source common utilities if not already loaded
[[ -z "${_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ============================================
# API Server Management
# ============================================

api_start() {
    log_info "Starting Magentic API server..."
    check_python
    
    if is_api_running; then
        log_warning "API server is already running"
        return 0
    fi
    
    local python=$(get_python)
    
    # Set environment
    if is_mcp_running; then
        export ENABLE_MCP=true
        export MCP_GATEWAY_URL="http://localhost:$MCP_GATEWAY_PORT"
        log_info "MCP integration enabled"
    else
        export ENABLE_MCP=false
        log_warning "Running without MCP (Docker not running)"
    fi
    
    # Check if metrics should be enabled (from .env or default to true)
    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        source "$SCRIPT_DIR/.env" 2>/dev/null || true
    fi
    export ENABLE_METRICS=${ENABLE_METRICS:-true}
    if [[ "$ENABLE_METRICS" == "true" ]]; then
        log_info "Prometheus metrics enabled (/metrics endpoint)"
    fi
    
    ensure_data_dir
    
    # Start API in background
    cd "$SCRIPT_DIR"
    nohup $python -m uvicorn src.api:app --host 0.0.0.0 --port $API_PORT > "$DATA_DIR/api.log" 2>&1 &
    echo $! > "$API_PID_FILE"
    
    log_info "Waiting for API server..."
    
    if wait_for_service "http://localhost:$API_PORT/health" "API" 30; then
        log_success "API server running at http://localhost:$API_PORT"
    else
        log_error "API server failed to start"
        cat "$DATA_DIR/api.log" | tail -20
        return 1
    fi
}

api_stop() {
    if is_api_running; then
        local pid=$(cat "$API_PID_FILE")
        kill "$pid" 2>/dev/null || true
        rm -f "$API_PID_FILE"
        log_success "API server stopped"
    else
        log_info "API server is not running"
    fi
}

api_restart() {
    log_info "Restarting API server..."
    api_stop
    sleep 1
    api_start
}

api_status() {
    echo
    echo -e "${CYAN}API Server Status${NC}"
    echo
    
    if is_api_running; then
        local pid=$(cat "$API_PID_FILE")
        echo -e "  Status: ${GREEN}Running${NC} (PID: $pid)"
        echo -e "  URL:    http://localhost:$API_PORT"
        echo -e "  Docs:   http://localhost:$API_PORT/docs"
        
        # Check health
        local health=$(curl -sf "http://localhost:$API_PORT/health" 2>/dev/null)
        if [[ -n "$health" ]]; then
            echo -e "  Health: ${GREEN}OK${NC}"
        fi
        
        # Check metrics
        if curl -sf "http://localhost:$API_PORT/metrics" > /dev/null 2>&1; then
            echo -e "  Metrics: ${GREEN}Enabled${NC} (http://localhost:$API_PORT/metrics)"
        else
            echo -e "  Metrics: ${YELLOW}Disabled${NC}"
        fi
    else
        echo -e "  Status: ${RED}Stopped${NC}"
    fi
    echo
}

api_logs() {
    if [[ -f "$DATA_DIR/api.log" ]]; then
        tail -f "$DATA_DIR/api.log"
    else
        log_error "API log not found"
    fi
}

# ============================================
# CLI Interactive Mode
# ============================================

cli_start() {
    log_info "Starting Magentic CLI..."
    check_python
    
    local python=$(get_python)
    
    # Ask user about MCP
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           CLI Configuration${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    local enable_mcp=false
    
    # Check if MCP Gateway is responding
    if is_mcp_running; then
        echo -e "  ${GREEN}✓${NC} MCP Gateway is running (http://localhost:$MCP_GATEWAY_PORT)"
        read -p "  Enable MCP integration? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            enable_mcp=true
        fi
    else
        # Gateway not responding - check why
        if is_mcp_containers_running; then
            echo -e "  ${YELLOW}⚠${NC} MCP containers running but Gateway not responding"
            echo -e "  ${BLUE}ℹ${NC} Gateway may still be starting up..."
            read -p "  Wait and retry, or restart MCP? (w=wait/r=restart/n=skip) [w]: " -n 1 -r
            echo
            case $REPLY in
                r|R)
                    echo
                    echo -e "  ${BLUE}ℹ${NC} Restarting MCP services..."
                    source "$CLI_DIR/mcp.sh"
                    mcp_stop
                    sleep 2
                    if mcp_start && is_mcp_running; then
                        enable_mcp=true
                        echo -e "  ${GREEN}✓${NC} MCP Gateway restarted successfully"
                    else
                        echo -e "  ${RED}✗${NC} MCP Gateway failed to start"
                    fi
                    ;;
                n|N)
                    echo -e "  ${BLUE}ℹ${NC} Skipping MCP"
                    ;;
                *)
                    # Wait and retry
                    echo -ne "  ${BLUE}⠋${NC} Waiting for MCP Gateway..."
                    local attempts=0
                    while [[ $attempts -lt 15 ]]; do
                        if is_mcp_running; then
                            echo -e "\r  ${GREEN}✓${NC} MCP Gateway is now responding"
                            enable_mcp=true
                            break
                        fi
                        sleep 2
                        ((attempts++))
                        echo -ne "\r  ${BLUE}⠋${NC} Waiting for MCP Gateway... ($attempts/15)"
                    done
                    if [[ "$enable_mcp" != true ]]; then
                        echo -e "\r  ${RED}✗${NC} MCP Gateway still not responding    "
                    fi
                    ;;
            esac
        elif check_docker_silent; then
            echo -e "  ${YELLOW}⚠${NC} MCP Gateway is not running"
            read -p "  Enable MCP? This will start Docker services (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo
                echo -e "  ${BLUE}ℹ${NC} Starting MCP Gateway..."
                echo
                source "$CLI_DIR/mcp.sh"
                if mcp_start; then
                    sleep 2
                    if is_mcp_running; then
                        enable_mcp=true
                        echo
                        echo -e "  ${GREEN}✓${NC} MCP Gateway started successfully"
                    else
                        echo -e "  ${RED}✗${NC} MCP Gateway failed to respond"
                    fi
                else
                    echo -e "  ${RED}✗${NC} Failed to start MCP services"
                fi
            fi
        else
            if ! command -v docker &> /dev/null; then
                echo -e "  ${BLUE}ℹ${NC} Docker not installed - MCP services unavailable"
            else
                echo -e "  ${BLUE}ℹ${NC} Docker daemon not running - MCP services unavailable"
            fi
            read -p "  Continue without MCP? (Y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                log_info "Cancelled"
                return 0
            fi
        fi
    fi
    
    echo
    
    # Set MCP environment
    if [[ "$enable_mcp" == true ]]; then
        export ENABLE_MCP=true
        export MCP_GATEWAY_URL="http://localhost:$MCP_GATEWAY_PORT"
        log_success "MCP integration enabled"
    else
        export ENABLE_MCP=false
        log_info "Running without MCP"
    fi
    
    echo
    log_info "Starting interactive mode..."
    echo
    
    # Run the CLI
    cd "$SCRIPT_DIR"
    exec $python -m src.main
}

# ============================================
# Command Handler
# ============================================

handle_api_command() {
    local command=${1:-}
    shift 2>/dev/null || true
    
    case $command in
        cli|run)
            cli_start
            ;;
        api)
            api_start
            ;;
        api-start)
            api_start
            ;;
        api-stop)
            api_stop
            ;;
        api-restart)
            api_restart
            ;;
        api-status)
            api_status
            ;;
        api-logs)
            api_logs
            ;;
        *)
            log_error "Unknown API command: $command"
            echo "Available: cli, api, api-stop, api-restart, api-status, api-logs"
            return 1
            ;;
    esac
}

#!/usr/bin/env bash
#
# cli/frontend.sh - Frontend Development Server Management
# Handles React/Vite frontend operations
#

# Source common utilities if not already loaded
[[ -z "${_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ============================================
# Frontend Server Management
# ============================================

frontend_start() {
    log_info "Starting frontend dev server..."
    
    if [[ ! -d "$SCRIPT_DIR/frontend" ]]; then
        log_error "Frontend directory not found"
        return 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm not found - install Node.js from https://nodejs.org"
        return 1
    fi
    
    if is_frontend_running; then
        log_warning "Frontend is already running"
        return 0
    fi
    
    cd "$SCRIPT_DIR/frontend"
    
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi
    
    ensure_data_dir
    
    # Start in background
    nohup npm run dev > "$DATA_DIR/frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    
    sleep 3
    
    if is_frontend_running; then
        log_success "Frontend running at http://localhost:$FRONTEND_PORT"
    else
        log_error "Frontend failed to start"
        cat "$DATA_DIR/frontend.log" | tail -20
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

frontend_stop() {
    if is_frontend_running; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        kill "$pid" 2>/dev/null || true
        # Also kill any child processes (npm spawns node)
        pkill -P "$pid" 2>/dev/null || true
        rm -f "$FRONTEND_PID_FILE"
        log_success "Frontend stopped"
    else
        log_info "Frontend is not running"
    fi
}

frontend_restart() {
    log_info "Restarting frontend..."
    frontend_stop
    sleep 1
    frontend_start
}

frontend_status() {
    echo
    echo -e "${CYAN}Frontend Status${NC}"
    echo
    
    if is_frontend_running; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        echo -e "  Status: ${GREEN}Running${NC} (PID: $pid)"
        echo -e "  URL:    http://localhost:$FRONTEND_PORT"
    else
        echo -e "  Status: ${RED}Stopped${NC}"
    fi
    
    if [[ -d "$SCRIPT_DIR/frontend/node_modules" ]]; then
        local pkg_count=$(find "$SCRIPT_DIR/frontend/node_modules" -maxdepth 1 -type d 2>/dev/null | wc -l)
        echo -e "  Packages: ${GREEN}Installed${NC} (~$pkg_count)"
    else
        echo -e "  Packages: ${YELLOW}Not installed${NC} (run: ./magentic.sh frontend)"
    fi
    echo
}

frontend_logs() {
    if [[ -f "$DATA_DIR/frontend.log" ]]; then
        tail -f "$DATA_DIR/frontend.log"
    else
        log_error "Frontend log not found"
    fi
}

frontend_install() {
    log_info "Installing frontend dependencies..."
    
    if [[ ! -d "$SCRIPT_DIR/frontend" ]]; then
        log_error "Frontend directory not found"
        return 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm not found - install Node.js from https://nodejs.org"
        return 1
    fi
    
    cd "$SCRIPT_DIR/frontend"
    
    if [[ -d "node_modules" ]]; then
        log_warning "node_modules already exists"
        read -p "Reinstall? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf node_modules package-lock.json
        else
            cd "$SCRIPT_DIR"
            return 0
        fi
    fi
    
    npm install
    
    if [[ -d "node_modules" ]]; then
        log_success "Frontend dependencies installed"
    else
        log_error "npm install failed"
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# ============================================
# Command Handler
# ============================================

handle_frontend_command() {
    local command=${1:-}
    shift 2>/dev/null || true
    
    case $command in
        frontend|ui)
            frontend_start
            ;;
        frontend-start|ui-start)
            frontend_start
            ;;
        frontend-stop|ui-stop)
            frontend_stop
            ;;
        frontend-restart|ui-restart)
            frontend_restart
            ;;
        frontend-status|ui-status)
            frontend_status
            ;;
        frontend-logs|ui-logs)
            frontend_logs
            ;;
        frontend-install|ui-install)
            frontend_install
            ;;
        *)
            log_error "Unknown frontend command: $command"
            echo "Available: frontend, frontend-stop, frontend-restart, frontend-status, frontend-logs, frontend-install"
            return 1
            ;;
    esac
}

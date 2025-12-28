#!/usr/bin/env bash
#
# cli/observability.sh - Observability Stack Management
# Handles Prometheus, Grafana, Loki, Promtail, cAdvisor
#

# Source common utilities if not already loaded
[[ -z "${_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ============================================
# Observability Stack Management
# ============================================

observability_start() {
    if ! check_docker; then
        log_error "Docker is required for observability stack"
        return 1
    fi
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Observability Stack${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    local compose_cmd=$(get_compose_cmd)
    use_docker_compose
    
    # Ensure data directories exist with proper permissions
    source "$CLI_DIR/mcp.sh"
    setup_mcp_workspace
    
    log_info "Starting Prometheus, Grafana, Loki, Promtail, cAdvisor..."
    echo
    
    # List of observability services (must match docker-compose.yml)
    local OBS_SERVICES="prometheus loki promtail grafana cadvisor"
    
    # Verify docker is still running before starting
    if ! docker info &>/dev/null; then
        log_error "Docker stopped unexpectedly"
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    # Verify services exist in compose file
    local available_services=$($compose_cmd --profile observability config --services 2>/dev/null)
    if [[ -z "$available_services" ]]; then
        log_error "Could not read services from docker-compose.yml"
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    # Start services with visible output
    echo -e "  ${BLUE}⠋${NC} Starting containers..."
    local output
    output=$($compose_cmd --profile observability up -d 2>&1)
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        echo
        
        # Wait for Prometheus
        echo -ne "  ${BLUE}⠋${NC} Waiting for Prometheus..."
        local prometheus_ready=false
        for i in {1..30}; do
            if curl -sf "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
                prometheus_ready=true
                echo -e "\r  ${GREEN}✓${NC} Prometheus ready              "
                break
            fi
            echo -ne "\r  ${BLUE}⠋${NC} Waiting for Prometheus... ($i/30)"
            sleep 1
        done
        if ! $prometheus_ready; then
            echo -e "\r  ${YELLOW}⚠${NC} Prometheus still starting...     "
        fi
        
        # Wait for Grafana
        echo -ne "  ${BLUE}⠋${NC} Waiting for Grafana..."
        local grafana_ready=false
        for i in {1..30}; do
            if curl -sf "http://localhost:3000/api/health" > /dev/null 2>&1; then
                grafana_ready=true
                echo -e "\r  ${GREEN}✓${NC} Grafana ready                  "
                break
            fi
            echo -ne "\r  ${BLUE}⠋${NC} Waiting for Grafana... ($i/30)"
            sleep 1
        done
        if ! $grafana_ready; then
            echo -e "\r  ${YELLOW}⚠${NC} Grafana still starting...       "
        fi
        
        # Wait for Loki
        echo -ne "  ${BLUE}⠋${NC} Waiting for Loki..."
        local loki_ready=false
        for i in {1..20}; do
            if curl -sf "http://localhost:3100/ready" > /dev/null 2>&1; then
                loki_ready=true
                echo -e "\r  ${GREEN}✓${NC} Loki ready                     "
                break
            fi
            echo -ne "\r  ${BLUE}⠋${NC} Waiting for Loki... ($i/20)"
            sleep 1
        done
        if ! $loki_ready; then
            echo -e "\r  ${YELLOW}⚠${NC} Loki still starting...          "
        fi
        
        echo
        if $prometheus_ready && $grafana_ready; then
            log_success "Observability stack is running!"
            echo
            echo -e "  ${CYAN}Prometheus:${NC} http://localhost:9090"
            echo -e "  ${CYAN}Grafana:${NC}    http://localhost:3000 (admin/magentic123)"
            echo -e "  ${CYAN}Loki:${NC}       http://localhost:3100"
            echo
            echo -e "  ${BLUE}ℹ${NC} Metrics endpoint: http://localhost:$API_PORT/metrics"
            echo -e "  ${BLUE}ℹ${NC} Data persisted to docker/data/"
        else
            log_warning "Some services still starting - check ./magentic.sh metrics-status"
        fi
        echo
    else
        echo
        log_error "Failed to start observability stack"
        if [[ -n "$output" ]]; then
            echo -e "  ${YELLOW}Error:${NC} $output"
        fi
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
    return 0
}

observability_stop() {
    if ! check_docker_silent; then
        return 0
    fi
    
    log_info "Stopping observability stack..."
    
    local compose_cmd=$(get_compose_cmd)
    local docker_cmd="${compose_cmd%% *}"
    use_docker_compose
    
    echo -ne "  ${BLUE}⠋${NC} Stopping and removing observability containers..."
    $compose_cmd --profile observability down --remove-orphans 2>/dev/null
    echo -e "\r  ${GREEN}✓${NC} Observability containers removed              "
    
    # Prune any orphaned networks
    echo -ne "  ${BLUE}⠋${NC} Cleaning up networks..."
    $docker_cmd network prune -f > /dev/null 2>&1 || true
    echo -e "\r  ${GREEN}✓${NC} Networks cleaned up                          "
    
    echo
    log_success "Observability stack stopped"
    echo -e "  ${BLUE}ℹ${NC} Data is preserved in docker/data/"
    cd "$SCRIPT_DIR"
}

observability_restart() {
    log_info "Restarting observability stack..."
    observability_stop
    sleep 2
    observability_start
}

observability_status() {
    echo
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}            Observability Stack Status             ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo
    
    echo -n "  Prometheus: "
    if curl -sf "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        echo -e "${GREEN}Running${NC} (http://localhost:9090)"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    echo -n "  Grafana:    "
    if curl -sf "http://localhost:3000/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}Running${NC} (http://localhost:3000)"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    echo -n "  Loki:       "
    if curl -sf "http://localhost:3100/ready" > /dev/null 2>&1; then
        echo -e "${GREEN}Running${NC} (http://localhost:3100)"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    echo -n "  cAdvisor:   "
    if curl -sf "http://localhost:8080/healthz" > /dev/null 2>&1; then
        echo -e "${GREEN}Running${NC} (http://localhost:8080)"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
    
    echo
    echo -n "  Metrics Endpoint: "
    if curl -sf "http://localhost:$API_PORT/metrics" > /dev/null 2>&1; then
        echo -e "${GREEN}Available${NC} (http://localhost:$API_PORT/metrics)"
    else
        echo -e "${YELLOW}Unavailable${NC} - set ENABLE_METRICS=true and restart API"
    fi
    
    echo
    
    # Show data directory info
    echo "  Data Directories:"
    for dir in prometheus loki grafana; do
        if [[ -d "$DOCKER_DIR/data/$dir" ]]; then
            local size=$(du -sh "$DOCKER_DIR/data/$dir" 2>/dev/null | cut -f1)
            echo -e "    - $dir/: ${GREEN}exists${NC} ($size)"
        else
            echo -e "    - $dir/: ${YELLOW}not created${NC}"
        fi
    done
    echo
}

observability_logs() {
    if ! check_docker_silent; then
        log_error "Docker not available"
        return 1
    fi
    
    local service=${1:-}
    use_docker_compose
    local compose_cmd=$(get_compose_cmd)
    
    if [[ -n "$service" ]]; then
        log_info "Showing logs for $service..."
        $compose_cmd logs -f --tail=100 "$service"
    else
        log_info "Showing logs for observability services..."
        $compose_cmd --profile observability logs -f --tail=100
    fi
    
    cd "$SCRIPT_DIR"
}

# ============================================
# Command Handler
# ============================================

handle_observability_command() {
    local command=${1:-}
    shift 2>/dev/null || true
    
    case $command in
        metrics|observability)
            observability_start
            ;;
        metrics-start|observability-start)
            observability_start
            ;;
        metrics-stop|observability-stop)
            observability_stop
            ;;
        metrics-restart|observability-restart)
            observability_restart
            ;;
        metrics-status|observability-status)
            observability_status
            ;;
        metrics-logs|observability-logs)
            observability_logs "$@"
            ;;
        *)
            log_error "Unknown observability command: $command"
            echo "Available: metrics, metrics-stop, metrics-restart, metrics-status, metrics-logs"
            return 1
            ;;
    esac
}

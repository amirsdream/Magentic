#!/usr/bin/env bash
#
# cli/common.sh - Shared utilities and configuration
# Sourced by all CLI modules
#

# Prevent multiple sourcing
[[ -n "${_COMMON_LOADED:-}" ]] && return 0
_COMMON_LOADED=1

# ============================================
# Colors
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ============================================
# Mode Configuration (dev or prod)
# ============================================
# Can be set via: MAGENTIC_MODE env var, --dev/--prod flags, or defaults to 'dev'
: "${MAGENTIC_MODE:=dev}"

is_dev_mode() {
    [[ "$MAGENTIC_MODE" == "dev" ]]
}

is_prod_mode() {
    [[ "$MAGENTIC_MODE" == "prod" ]]
}

set_mode() {
    local mode=$1
    if [[ "$mode" == "dev" || "$mode" == "prod" ]]; then
        export MAGENTIC_MODE="$mode"
    else
        log_error "Invalid mode: $mode (use 'dev' or 'prod')"
        return 1
    fi
}

# ============================================
# Paths (set by magentic.sh before sourcing)
# ============================================
: "${SCRIPT_DIR:=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
: "${CLI_DIR:=$SCRIPT_DIR/cli}"
: "${DOCKER_DIR:=$SCRIPT_DIR/docker}"
: "${VENV_DIR:=$SCRIPT_DIR/.venv}"
: "${DATA_DIR:=$SCRIPT_DIR/data}"
: "${DB_PATH:=$DATA_DIR/magentic.db}"
: "${PID_FILE:=$DATA_DIR/.magentic.pid}"
: "${API_PID_FILE:=$DATA_DIR/.magentic-api.pid}"
: "${FRONTEND_PID_FILE:=$DATA_DIR/.frontend.pid}"

# ============================================
# Configuration
# ============================================
DEFAULT_PORT=8000
API_PORT=${MAGENTIC_API_PORT:-$DEFAULT_PORT}
MCP_GATEWAY_PORT=9000
FRONTEND_PORT=8081

# Python version preference
PREFERRED_PYTHON_VERSION="3.13"

# pyenv paths
PYENV_ROOT="${PYENV_ROOT:-$HOME/.pyenv}"
PYENV_BIN="$PYENV_ROOT/bin/pyenv"

# ============================================
# Logging Functions
# ============================================
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# ============================================
# Banner
# ============================================
print_banner() {
    echo -e "${MAGENTA}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║   __  __                        _   _                 ║
║  |  \/  | __ _  __ _  ___ _ __ | |_(_) ___           ║
║  | |\/| |/ _` |/ _` |/ _ \ '_ \| __| |/ __|          ║
║  | |  | | (_| | (_| |  __/ | | | |_| | (__           ║
║  |_|  |_|\__,_|\__, |\___|_| |_|\__|_|\___|          ║
║                |___/                                  ║
║                                                       ║
║          Magnetic Agent Networks                      ║
╚═══════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# ============================================
# Python Functions
# ============================================

# Find the best Python interpreter
find_best_python() {
    local python_cmd=""
    
    # Check pyenv first (preferred)
    if [[ -x "$PYENV_BIN" ]]; then
        for ver in "3.13" "3.12" "3.11" "3.10"; do
            local pyenv_version=$($PYENV_BIN versions --bare 2>/dev/null | grep "^$ver" | sort -V | tail -1)
            if [[ -n "$pyenv_version" ]]; then
                local pyenv_python="$PYENV_ROOT/versions/$pyenv_version/bin/python"
                if [[ -x "$pyenv_python" ]]; then
                    python_cmd="$pyenv_python"
                    break
                fi
            fi
        done
    fi
    
    # If pyenv didn't find a good version, check system paths
    if [[ -z "$python_cmd" ]]; then
        local system_paths=("/usr/bin" "/usr/local/bin" "/opt/homebrew/bin")
        
        for ver in "3.13" "3.12" "3.11" "3.10"; do
            for path in "${system_paths[@]}"; do
                if [[ -x "$path/python$ver" ]]; then
                    python_cmd="$path/python$ver"
                    break 2
                fi
            done
        done
    fi
    
    # Final fallback to generic python3
    if [[ -z "$python_cmd" ]]; then
        for path in "/usr/bin" "/usr/local/bin"; do
            if [[ -x "$path/python3" ]]; then
                python_cmd="$path/python3"
                break
            fi
        done
    fi
    
    echo "$python_cmd"
}

check_pyenv() {
    [[ -x "$PYENV_BIN" ]]
}

check_python() {
    if [[ ! -d "$VENV_DIR" ]]; then
        log_error "Virtual environment not found. Run: ./magentic.sh setup"
        exit 1
    fi
    
    local python="$VENV_DIR/bin/python"
    if ! $python -c "import dotenv, langchain, fastapi" 2>/dev/null; then
        log_error "Dependencies not installed. Run: ./magentic.sh setup"
        exit 1
    fi
}

check_python_soft() {
    if [[ ! -d "$VENV_DIR" ]]; then
        return 1
    fi
    
    local python="$VENV_DIR/bin/python"
    if ! $python -c "import dotenv" 2>/dev/null; then
        return 1
    fi
    return 0
}

get_python() {
    echo "$VENV_DIR/bin/python"
}

# ============================================
# Docker Functions
# ============================================

check_docker_silent() {
    if ! command -v docker &> /dev/null; then
        return 1
    fi
    
    if ! docker info &> /dev/null 2>&1; then
        return 1
    fi
    
    return 0
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed - MCP services will be unavailable"
        return 1
    fi
    
    if ! docker info &> /dev/null 2>&1; then
        log_warning "Docker daemon is not running - MCP services will be unavailable"
        return 1
    fi
    
    return 0
}

get_compose_cmd() {
    if docker compose version &> /dev/null 2>&1; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# Set up environment to use docker/docker-compose.yml exclusively
# Call this before running any docker compose commands
use_docker_compose() {
    cd "$DOCKER_DIR"
    # Prevent docker compose from finding parent docker-compose.yml files
    export COMPOSE_FILE="$DOCKER_DIR/docker-compose.yml"
}

# Set up environment to use root docker-compose.yml
use_root_compose() {
    cd "$SCRIPT_DIR"
    export COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
}

# ============================================
# SELinux Functions
# ============================================

is_selinux_enabled() {
    if command -v getenforce &> /dev/null; then
        local status=$(getenforce 2>/dev/null)
        [[ "$status" == "Enforcing" || "$status" == "Permissive" ]]
    else
        return 1
    fi
}

set_selinux_context() {
    local dir=$1
    if is_selinux_enabled && command -v chcon &> /dev/null; then
        # Use container_file_t (modern) or fall back to svirt_sandbox_file_t (legacy)
        chcon -Rt container_file_t "$dir" 2>/dev/null || \
        chcon -Rt svirt_sandbox_file_t "$dir" 2>/dev/null || true
    fi
}

# Fix ownership for observability containers (they run as non-root)
fix_observability_permissions() {
    local docker_dir="${1:-$DOCKER_DIR}"
    
    # Prometheus runs as nobody (65534)
    if [[ -d "$docker_dir/data/prometheus" ]]; then
        chown -R 65534:65534 "$docker_dir/data/prometheus" 2>/dev/null || \
        chmod -R 777 "$docker_dir/data/prometheus" 2>/dev/null || true
    fi
    
    # Grafana runs as grafana (472)
    if [[ -d "$docker_dir/data/grafana" ]]; then
        chown -R 472:472 "$docker_dir/data/grafana" 2>/dev/null || \
        chmod -R 777 "$docker_dir/data/grafana" 2>/dev/null || true
    fi
    
    # Loki runs as loki (10001)
    if [[ -d "$docker_dir/data/loki" ]]; then
        chown -R 10001:10001 "$docker_dir/data/loki" 2>/dev/null || \
        chmod -R 777 "$docker_dir/data/loki" 2>/dev/null || true
    fi
}

# ============================================
# Service Status Functions
# ============================================

is_mcp_running() {
    curl -sf "http://localhost:$MCP_GATEWAY_PORT/health" > /dev/null 2>&1
}

is_mcp_containers_running() {
    if check_docker_silent; then
        local compose_cmd=$(get_compose_cmd)
        cd "$DOCKER_DIR" 2>/dev/null || return 1
        local running=$($compose_cmd ps --services --filter "status=running" 2>/dev/null | wc -l)
        cd "$SCRIPT_DIR"
        [[ $running -gt 0 ]]
    else
        return 1
    fi
}

is_api_running() {
    if [[ -f "$API_PID_FILE" ]]; then
        local pid=$(cat "$API_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

is_frontend_running() {
    if [[ -f "$FRONTEND_PID_FILE" ]]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# ============================================
# Utility Functions
# ============================================

wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            return 0
        fi
        ((attempt++))
        sleep 1
    done
    return 1
}

# Spinner characters
SPINNER_CHARS="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

spinner() {
    local pid=$1
    local msg=$2
    local i=0
    local len=${#SPINNER_CHARS}
    
    while kill -0 $pid 2>/dev/null; do
        local char="${SPINNER_CHARS:$i:1}"
        printf "\r${BLUE}${char}${NC} ${msg}"
        i=$(( (i + 1) % len ))
        sleep 0.1
    done
    printf "\r"
}

ensure_data_dir() {
    mkdir -p "$DATA_DIR"
}

#!/usr/bin/env bash
#
# cli/setup.sh - First-time Setup and Installation
# Handles prerequisites, venv, dependencies, and configuration
#

# Source common utilities if not already loaded
[[ -z "${_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ============================================
# Prerequisites Check
# ============================================

check_prerequisites() {
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Checking Prerequisites${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    local has_errors=0
    local has_warnings=0
    
    # Check pyenv (REQUIRED)
    echo -e "  ${BLUE}pyenv${NC} (required for Python management)"
    if check_pyenv; then
        local pyenv_version=$($PYENV_BIN --version 2>/dev/null | awk '{print $2}')
        echo -e "    ${GREEN}✓${NC} pyenv $pyenv_version"
        echo -e "    ${GREEN}✓${NC} Location: $PYENV_ROOT"
        
        local installed_versions=$($PYENV_BIN versions --bare 2>/dev/null | tr '\n' ' ')
        if [[ -n "$installed_versions" ]]; then
            echo -e "    ${GREEN}✓${NC} Installed: $installed_versions"
        else
            echo -e "    ${YELLOW}⚠${NC} No Python versions installed via pyenv"
        fi
    else
        echo -e "    ${RED}✗${NC} pyenv not found"
        echo -e "    ${RED}  ${NC} Expected at: $PYENV_ROOT"
        has_errors=1
    fi
    
    # Check Python
    echo -e "  ${BLUE}Python${NC}"
    local best_python=$(find_best_python)
    local has_python_313=0
    
    if [[ -n "$best_python" ]]; then
        local best_ver=$($best_python --version 2>/dev/null | cut -d' ' -f2)
        local best_minor=$(echo $best_ver | cut -d'.' -f2)
        
        if [[ "$best_minor" -ge 10 ]]; then
            echo -e "    ${GREEN}✓${NC} Python $best_ver found"
            echo -e "    ${GREEN}✓${NC} Will use: $best_python"
            
            if [[ "$best_minor" != "13" ]]; then
                echo -e "    ${YELLOW}⚠${NC} Python 3.13 recommended for best compatibility"
            fi
        else
            echo -e "    ${RED}✗${NC} Python $best_ver (requires 3.10+)"
            has_errors=1
        fi
    else
        echo -e "    ${RED}✗${NC} Python 3.10+ not found"
        has_errors=1
    fi
    
    # Check Node.js and npm
    echo -e "  ${BLUE}Node.js & npm${NC} (for frontend)"
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        echo -e "    ${GREEN}✓${NC} Node.js $node_version"
    else
        echo -e "    ${YELLOW}⚠${NC} Node.js not found (frontend will be unavailable)"
        has_warnings=1
    fi
    
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        echo -e "    ${GREEN}✓${NC} npm $npm_version"
    else
        echo -e "    ${YELLOW}⚠${NC} npm not found (frontend will be unavailable)"
        has_warnings=1
    fi
    
    # Check Docker
    echo -e "  ${BLUE}Docker${NC} (for MCP services)"
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
        echo -e "    ${GREEN}✓${NC} Docker $docker_version"
        
        if docker info &> /dev/null 2>&1; then
            echo -e "    ${GREEN}✓${NC} Docker daemon running"
        else
            echo -e "    ${YELLOW}⚠${NC} Docker daemon not running"
            has_warnings=1
        fi
        
        if docker compose version &> /dev/null 2>&1; then
            local compose_version=$(docker compose version | grep -oP '\d+\.\d+\.\d+' | head -1)
            echo -e "    ${GREEN}✓${NC} Docker Compose $compose_version"
        fi
    else
        echo -e "    ${YELLOW}⚠${NC} Docker not found (MCP services will be unavailable)"
        has_warnings=1
    fi
    
    # Check curl
    echo -e "  ${BLUE}curl${NC}"
    if command -v curl &> /dev/null; then
        echo -e "    ${GREEN}✓${NC} curl available"
    else
        echo -e "    ${YELLOW}⚠${NC} curl not found (needed for health checks)"
        has_warnings=1
    fi
    
    echo
    echo -e "  ${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ $has_errors -eq 1 ]]; then
        echo
        log_error "Missing required prerequisites. Please install them first."
        echo
        if ! check_pyenv; then
            echo -e "  ${YELLOW}Install pyenv:${NC}"
            echo "    curl https://pyenv.run | bash"
            echo ""
            echo "  Then add to your ~/.bashrc or ~/.zshrc:"
            echo '    export PYENV_ROOT="$HOME/.pyenv"'
            echo '    export PATH="$PYENV_ROOT/bin:$PATH"'
            echo '    eval "$(pyenv init -)"'
            echo ""
        fi
        return 1
    fi
    
    if [[ $has_warnings -eq 1 ]]; then
        echo
        log_warning "Some optional tools are missing. The system will work with reduced features."
        read -p "Continue anyway? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            return 1
        fi
    fi
    
    return 0
}

# ============================================
# Python Environment Setup
# ============================================

install_python_via_pyenv() {
    local version=$1
    
    if ! check_pyenv; then
        log_error "pyenv is not installed"
        return 1
    fi
    
    log_info "Installing Python $version via pyenv (this may take a few minutes)..."
    
    local full_version=$($PYENV_BIN install --list 2>/dev/null | grep "^  $version" | grep -v "dev\|rc\|a\|b" | tail -1 | tr -d ' ')
    
    if [[ -z "$full_version" ]]; then
        log_error "Python $version not found in pyenv"
        return 1
    fi
    
    echo -e "  ${BLUE}ℹ${NC} Installing Python $full_version..."
    
    if $PYENV_BIN install "$full_version" 2>&1 | while read line; do
        echo -ne "\r  ${BLUE}⠋${NC} $line                    \r"
    done; then
        log_success "Python $full_version installed via pyenv"
        return 0
    else
        log_error "Failed to install Python $full_version"
        return 1
    fi
}

setup_venv() {
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Python Virtual Environment${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    local need_install_deps=true
    local best_python=$(find_best_python)
    local python_ver=""
    local best_minor=""
    
    if [[ -n "$best_python" ]]; then
        python_ver=$($best_python --version 2>/dev/null | cut -d' ' -f2)
        best_minor=$(echo "$python_ver" | cut -d'.' -f2)
    fi
    
    # Check if we need to install Python 3.13
    if [[ -z "$best_python" ]] || [[ "$best_minor" -lt 10 ]] || [[ "$best_minor" -ge 14 ]]; then
        if check_pyenv; then
            echo -e "  ${YELLOW}⚠${NC} Python 3.13 not found (best for package compatibility)"
            echo
            read -p "  Install Python 3.13 via pyenv? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                if install_python_via_pyenv "3.13"; then
                    best_python=$(find_best_python)
                    python_ver=$($best_python --version 2>/dev/null | cut -d' ' -f2)
                    best_minor=$(echo "$python_ver" | cut -d'.' -f2)
                else
                    log_error "Failed to install Python 3.13"
                    exit 1
                fi
            fi
        fi
    fi
    
    if [[ -z "$best_python" ]]; then
        log_error "No suitable Python found. Install Python 3.13 via pyenv:"
        echo "    $PYENV_BIN install 3.13"
        exit 1
    fi
    
    echo -e "  ${BLUE}ℹ${NC} Using: ${CYAN}$best_python${NC} ($python_ver)"
    echo
    
    if [[ -d "$VENV_DIR" ]]; then
        local venv_python_ver=""
        if [[ -f "$VENV_DIR/bin/python" ]]; then
            venv_python_ver=$("$VENV_DIR/bin/python" --version 2>/dev/null | cut -d' ' -f2)
        fi
        
        log_warning "Virtual environment already exists (Python $venv_python_ver)"
        
        local venv_minor=$(echo "$venv_python_ver" | cut -d'.' -f2)
        
        if [[ "$venv_minor" != "$best_minor" ]]; then
            echo -e "  ${YELLOW}⚠${NC} Current venv uses Python 3.$venv_minor, but 3.$best_minor is available"
        fi
        
        read -p "  Recreate it with $best_python? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$VENV_DIR"
            $best_python -m venv "$VENV_DIR"
            log_success "Virtual environment recreated with Python $python_ver"
        else
            log_info "Using existing virtual environment"
            local python="$VENV_DIR/bin/python"
            if $python -c "import dotenv, langchain, fastapi" 2>/dev/null; then
                log_info "Dependencies already installed"
                read -p "  Reinstall dependencies? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    need_install_deps=false
                fi
            fi
        fi
    else
        echo -ne "  ${BLUE}⠋${NC} Creating virtual environment with $best_python..."
        $best_python -m venv "$VENV_DIR" &
        spinner $! "Creating virtual environment..."
        wait $!
        log_success "Virtual environment created with Python $python_ver"
    fi
    
    echo "$need_install_deps"
}

install_dependencies() {
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Installing Dependencies${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    local pip="$VENV_DIR/bin/pip"
    local use_uv=false
    local uv_path=""
    
    # Check if uv is available (10-100x faster than pip)
    if [[ -x "$HOME/.local/bin/uv" ]]; then
        uv_path="$HOME/.local/bin/uv"
    elif [[ -x "$HOME/.cargo/bin/uv" ]]; then
        uv_path="$HOME/.cargo/bin/uv"
    elif command -v uv &> /dev/null; then
        uv_path=$(command -v uv)
    fi
    
    if [[ -n "$uv_path" ]] && "$uv_path" --version &> /dev/null; then
        use_uv=true
        local uv_ver=$("$uv_path" --version 2>/dev/null | head -1)
        echo -e "  ${GREEN}⚡${NC} Using ${CYAN}uv${NC} ($uv_ver) - 10-100x faster than pip"
        echo
    else
        echo -e "  ${YELLOW}💡${NC} Tip: Install ${CYAN}uv${NC} for 10-100x faster installs:"
        echo -e "     ${YELLOW}curl -LsSf https://astral.sh/uv/install.sh | sh${NC}"
        echo
        echo -e "  ${BLUE}⠋${NC} Upgrading pip, wheel, setuptools..."
        $pip install --upgrade pip wheel setuptools -q 2>/dev/null
        echo -e "  ${GREEN}✓${NC} pip upgraded"
    fi
    
    if [[ ! -f "$SCRIPT_DIR/requirements.txt" ]]; then
        log_error "requirements.txt not found"
        return 1
    fi
    
    echo
    if [[ "$use_uv" == true ]]; then
        local venv_python="$VENV_DIR/bin/python"
        local venv_python_ver=$($venv_python --version 2>/dev/null | cut -d' ' -f2)
        local venv_python_minor=$(echo "$venv_python_ver" | cut -d'.' -f1-2)
        
        echo -e "  ${BLUE}⚡${NC} Installing packages with uv..."
        echo -e "  ${BLUE}ℹ${NC} Target: Python $venv_python_ver"
        echo
        
        "$uv_path" pip install -r "$SCRIPT_DIR/requirements.txt" \
            --python "$venv_python" \
            --python-version "$venv_python_minor"
        local uv_exit=$?
        
        if [[ $uv_exit -ne 0 ]]; then
            echo -e "  ${YELLOW}⚠${NC} uv failed, falling back to pip..."
            $pip install -r "$SCRIPT_DIR/requirements.txt"
        fi
    else
        echo -e "  ${BLUE}⠋${NC} Installing packages from requirements.txt..."
        echo -e "  ${YELLOW}  (this may take a few minutes)${NC}"
        echo
        $pip install -r "$SCRIPT_DIR/requirements.txt"
    fi
    
    echo
    echo -e "  ${BLUE}ℹ${NC} Verifying installation..."
    local verify_failed=0
    
    for pkg in langchain langgraph qdrant-client fastapi rich python-dotenv alembic; do
        if $pip show "$pkg" &>/dev/null; then
            local ver=$($pip show "$pkg" 2>/dev/null | grep "^Version:" | cut -d' ' -f2)
            echo -e "    ${GREEN}✓${NC} $pkg ($ver)"
        else
            echo -e "    ${RED}✗${NC} $pkg missing"
            ((verify_failed++))
        fi
    done
    
    echo
    if [[ $verify_failed -eq 0 ]]; then
        log_success "All dependencies installed successfully!"
    else
        log_warning "Some packages may need manual installation"
    fi
    
    return 0
}

# ============================================
# LLM Configuration
# ============================================

setup_llm_config() {
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           LLM Configuration${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    local need_llm_config=true
    local llm_provider="ollama"
    local openai_key=""
    local anthropic_key=""
    
    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        local current_provider=$(grep "^LLM_PROVIDER=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d'=' -f2)
        if [[ -n "$current_provider" ]]; then
            echo -e "  ${BLUE}ℹ${NC} Current configuration:"
            echo -e "    Provider: ${CYAN}$current_provider${NC}"
        fi
        
        log_warning ".env file already exists"
        read -p "  Reconfigure LLM settings? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing .env configuration"
            llm_provider="$current_provider"
            return 0
        fi
    fi
    
    echo
    echo "Select your LLM provider:"
    echo -e "  ${GREEN}1)${NC} Ollama (Local, Free) ${YELLOW}[Recommended]${NC}"
    echo -e "  ${GREEN}2)${NC} OpenAI (Requires API key)"
    echo -e "  ${GREEN}3)${NC} Claude/Anthropic (Requires API key)"
    echo
    read -p "Enter choice [1-3]: " provider_choice
    
    case $provider_choice in
        1)
            llm_provider="ollama"
            log_info "Selected: Ollama (local)"
            ;;
        2)
            llm_provider="openai"
            log_info "Selected: OpenAI"
            read -p "Enter your OpenAI API key: " openai_key
            ;;
        3)
            llm_provider="claude"
            log_info "Selected: Claude/Anthropic"
            read -p "Enter your Anthropic API key: " anthropic_key
            ;;
        *)
            log_warning "Invalid choice. Defaulting to Ollama."
            ;;
    esac
    
    create_env_file "$llm_provider" "$openai_key" "$anthropic_key"
    
    echo "$llm_provider"
}

create_env_file() {
    local provider=$1
    local openai_key=${2:-your-openai-api-key-here}
    local anthropic_key=${3:-your-anthropic-api-key-here}
    
    cat > "$SCRIPT_DIR/.env" << EOF
# Magentic Configuration
LLM_PROVIDER=$provider
LLM_TEMPERATURE=0.7

# Ollama Configuration
OLLAMA_MODEL=llama3.2:1b
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI Configuration
OPENAI_API_KEY=$openai_key
OPENAI_MODEL=gpt-4o

# Anthropic/Claude Configuration
ANTHROPIC_API_KEY=$anthropic_key
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# Observability & Metrics
PHOENIX_PORT=6006
ENABLE_OBSERVABILITY=false
ENABLE_METRICS=true
MAX_INPUT_LENGTH=1000

# Multi-Agent Configuration
MAX_PARALLEL_AGENTS=3
UI_DISPLAY_LIMIT=200
DEBUG_STATE=false

# RAG Configuration
ENABLE_RAG=true
RAG_VECTOR_STORE=qdrant
RAG_QDRANT_MODE=memory
RAG_QDRANT_URL=http://localhost:6333
RAG_QDRANT_COLLECTION=knowledge_base
RAG_PERSIST_DIRECTORY=./rag_data
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_TOP_K=4

# Embeddings
RAG_EMBEDDING_PROVIDER=ollama
RAG_EMBEDDING_MODEL=nomic-embed-text

# MCP Configuration
ENABLE_MCP=false
MCP_GATEWAY_URL=http://localhost:9000
EOF
    log_success ".env file created"
}

setup_ollama() {
    if ! command -v ollama &> /dev/null; then
        log_warning "Ollama is not installed"
        echo
        echo "Install Ollama from: https://ollama.ai/download"
        echo "  Linux/Mac: curl -fsSL https://ollama.ai/install.sh | sh"
        echo
        read -p "Install Ollama now? (Linux/Mac only) (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
                log_info "Installing Ollama..."
                curl -fsSL https://ollama.ai/install.sh | sh
                log_success "Ollama installed"
            else
                log_error "Automatic installation not supported on $OSTYPE"
                return 1
            fi
        else
            log_warning "Skipping Ollama installation"
            return 0
        fi
    else
        log_success "Ollama is installed"
    fi
    
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        log_success "Ollama service is running"
        
        log_info "Pulling LLM model (llama3.2:1b)..."
        ollama pull llama3.2:1b 2>&1 | tail -1
        
        log_info "Pulling embedding model (nomic-embed-text)..."
        ollama pull nomic-embed-text 2>&1 | tail -1
        
        log_success "Models ready"
    else
        log_warning "Ollama is not running"
        echo "  Start it with: ollama serve"
        echo "  Then pull models: ollama pull llama3.2:1b && ollama pull nomic-embed-text"
    fi
}

# ============================================
# Frontend Setup
# ============================================

setup_frontend() {
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Setting Up Frontend${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    if [[ ! -d "$SCRIPT_DIR/frontend" ]]; then
        log_warning "Frontend directory not found"
        return 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_warning "npm not found - skipping frontend setup"
        echo "  Install Node.js from https://nodejs.org to enable frontend"
        return 1
    fi
    
    cd "$SCRIPT_DIR/frontend"
    
    if [[ -d "node_modules" ]]; then
        log_info "Frontend dependencies already installed"
        read -p "  Reinstall? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            cd "$SCRIPT_DIR"
            return 0
        fi
        rm -rf node_modules package-lock.json
    fi
    
    echo -ne "  ${BLUE}⠋${NC} Installing npm packages..."
    npm install 2>&1 | tail -1 &
    spinner $! "Installing npm packages..."
    wait $!
    
    if [[ -d "node_modules" ]]; then
        local pkg_count=$(find node_modules -maxdepth 1 -type d | wc -l)
        echo -e "  ${GREEN}✓${NC} Frontend ready ($pkg_count packages installed)"
    else
        echo -e "  ${RED}✗${NC} npm install failed"
        cd "$SCRIPT_DIR"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
    return 0
}

# ============================================
# Docker/MCP Setup
# ============================================

setup_docker_mcp() {
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Setting Up MCP (Docker)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not installed - skipping MCP setup"
        echo "  Install Docker from https://docker.com to enable MCP services"
        return 1
    fi
    
    if ! docker info &> /dev/null 2>&1; then
        log_warning "Docker daemon not running - skipping MCP setup"
        echo "  Start Docker and run: ./magentic.sh mcp"
        return 1
    fi
    
    if [[ ! -d "$DOCKER_DIR" ]]; then
        log_warning "Docker directory not found"
        return 1
    fi
    
    # Setup workspace directories (with SELinux support)
    source "$CLI_DIR/mcp.sh"
    setup_mcp_env
    setup_mcp_workspace
    
    echo
    read -p "  Build MCP Docker images now? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local compose_cmd=$(get_compose_cmd)
        cd "$DOCKER_DIR"
        
        echo -ne "  ${BLUE}⠋${NC} Building MCP images (this may take a while)..."
        $compose_cmd build 2>&1 | tail -1 &
        spinner $! "Building MCP images..."
        wait $!
        
        if [[ $? -eq 0 ]]; then
            echo -e "  ${GREEN}✓${NC} MCP images built"
            echo
            echo "  Start MCP services with: ${YELLOW}./magentic.sh mcp${NC}"
        else
            echo -e "  ${YELLOW}⚠${NC} MCP build had issues - try: cd docker && docker compose build"
        fi
        
        cd "$SCRIPT_DIR"
    else
        log_info "Skipped MCP build. Run later: ./magentic.sh mcp"
    fi
    
    return 0
}

# ============================================
# Main Setup Function
# ============================================

run_setup() {
    print_banner
    echo -e "${CYAN}First-Time Setup${NC}"
    
    # Step 1: Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi
    
    # Step 2: Setup virtual environment
    local need_install_deps=$(setup_venv)
    
    # Step 3: Install Python dependencies
    if [[ "$need_install_deps" == "true" ]]; then
        install_dependencies
    fi
    
    # Step 4: Configure LLM Provider
    local llm_provider=$(setup_llm_config)
    
    # Step 5: Setup Ollama if selected
    if [[ "$llm_provider" == "ollama" ]]; then
        setup_ollama
    fi
    
    # Step 6: Create directories
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}              Creating Directories${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    mkdir -p "$SCRIPT_DIR/rag_data" "$SCRIPT_DIR/execution_graphs" "$DATA_DIR"
    echo -e "  ${GREEN}✓${NC} rag_data/"
    echo -e "  ${GREEN}✓${NC} execution_graphs/"
    echo -e "  ${GREEN}✓${NC} data/"
    log_success "Created required directories"
    
    # Step 7: Initialize database
    source "$CLI_DIR/database.sh"
    db_init true
    
    # Step 8: Setup Frontend
    setup_frontend
    
    # Step 9: Setup Docker MCP
    setup_docker_mcp
    
    # Setup Complete!
    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}           ✓ Setup Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "  ${CYAN}Quick Start:${NC}"
    echo -e "    ${GREEN}./magentic.sh start${NC}     Start all services"
    echo -e "    ${GREEN}./magentic.sh cli${NC}       Run interactive CLI"
    echo
    echo -e "  ${CYAN}Individual Services:${NC}"
    echo -e "    ${GREEN}./magentic.sh api${NC}       Start API server only"
    echo -e "    ${GREEN}./magentic.sh frontend${NC}  Start frontend only"
    echo -e "    ${GREEN}./magentic.sh mcp${NC}       Start MCP services"
    echo
    echo -e "  ${CYAN}Management:${NC}"
    echo -e "    ${GREEN}./magentic.sh status${NC}    Check service status"
    echo -e "    ${GREEN}./magentic.sh logs${NC}      View service logs"
    echo -e "    ${GREEN}./magentic.sh stop${NC}      Stop all services"
    echo
    echo -e "  ${CYAN}Documentation:${NC}"
    echo -e "    README.md, docs/ARCHITECTURE.md"
    echo
}

# ============================================
# Command Handler
# ============================================

handle_setup_command() {
    local command=${1:-setup}
    
    case $command in
        setup|install|init)
            run_setup
            ;;
        *)
            run_setup
            ;;
    esac
}

#!/usr/bin/env bash
#
# cli/database.sh - Database Management
# Handles SQLite database initialization, migrations, and reset
#

# Source common utilities if not already loaded
[[ -z "${_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# ============================================
# Database Management
# ============================================

db_init() {
    local during_setup=${1:-false}
    
    echo
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}           Database Setup${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    
    # Check if database already exists
    local db_exists=false
    if [[ -f "$DB_PATH" ]] || [[ -f "$DATA_DIR/magentic.db" ]]; then
        db_exists=true
        echo -e "  ${BLUE}ℹ${NC} Database already exists"
        
        if [[ "$during_setup" == "true" ]]; then
            read -p "  Re-initialize database? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Keeping existing database"
                return 0
            fi
        fi
    else
        echo -e "  ${BLUE}ℹ${NC} No existing database found"
    fi
    
    # During setup, use soft check; otherwise use strict check
    if [[ "$during_setup" == "true" ]]; then
        if ! check_python_soft; then
            log_warning "Python environment not ready, skipping database initialization"
            echo -e "  ${YELLOW}  ${NC} Run './magentic.sh db-init' after setup completes"
            return 0
        fi
    else
        check_python
    fi
    
    ensure_data_dir
    echo -e "  ${GREEN}✓${NC} Data directory ready: $DATA_DIR"
    
    local alembic_bin="$VENV_DIR/bin/alembic"
    
    # Run Alembic migrations
    if [[ -f "$SCRIPT_DIR/alembic.ini" ]]; then
        cd "$SCRIPT_DIR"
        if [[ -x "$alembic_bin" ]]; then
            echo -ne "  ${BLUE}⠋${NC} Running database migrations..."
            if $alembic_bin upgrade head 2>&1 | tail -3; then
                echo -e "  ${GREEN}✓${NC} Database migrations applied"
            else
                echo -e "  ${YELLOW}⚠${NC} Migration had issues (may be OK if DB already exists)"
            fi
        else
            log_warning "Alembic not installed"
            echo -e "  ${YELLOW}  ${NC} Database migrations skipped"
        fi
    else
        log_info "No alembic.ini found - using default SQLite database"
        # Create a simple SQLite database if needed
        local python="$VENV_DIR/bin/python"
        if [[ -x "$python" ]]; then
            $python -c "
import sqlite3
import os
db_path = os.path.join('$DATA_DIR', 'magentic.db')
conn = sqlite3.connect(db_path)
conn.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)')
conn.commit()
conn.close()
print('  ✓ SQLite database initialized:', db_path)
" 2>/dev/null && echo -e "  ${GREEN}✓${NC} Database initialized"
        fi
    fi
    
    cd "$SCRIPT_DIR"
    return 0
}

db_reset() {
    log_warning "This will delete all data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ -f "$DB_PATH" ]]; then
            rm "$DB_PATH"
            log_success "Database deleted"
        fi
        
        # Re-initialize
        db_init
    else
        log_info "Cancelled"
    fi
}

db_status() {
    echo
    echo -e "${CYAN}Database Status${NC}"
    echo
    
    if [[ -f "$DB_PATH" ]]; then
        local db_size=$(du -h "$DB_PATH" 2>/dev/null | cut -f1)
        echo -e "  Status: ${GREEN}Initialized${NC}"
        echo -e "  Path:   $DB_PATH"
        echo -e "  Size:   $db_size"
        
        # Count tables if sqlite3 is available
        if command -v sqlite3 &> /dev/null; then
            local table_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
            echo -e "  Tables: $table_count"
        fi
    else
        echo -e "  Status: ${YELLOW}Not initialized${NC}"
        echo -e "  Run: ./magentic.sh db-init"
    fi
    echo
}

db_backup() {
    if [[ ! -f "$DB_PATH" ]]; then
        log_error "Database not found"
        return 1
    fi
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$DATA_DIR/magentic_backup_$timestamp.db"
    
    cp "$DB_PATH" "$backup_file"
    log_success "Database backed up to: $backup_file"
}

# ============================================
# Command Handler
# ============================================

handle_db_command() {
    local command=${1:-}
    shift 2>/dev/null || true
    
    case $command in
        db-init|db|migrate)
            db_init
            ;;
        db-reset)
            db_reset
            ;;
        db-status)
            db_status
            ;;
        db-backup)
            db_backup
            ;;
        *)
            log_error "Unknown database command: $command"
            echo "Available: db-init, db-reset, db-status, db-backup"
            return 1
            ;;
    esac
}

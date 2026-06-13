#!/bin/bash
# start.sh — one-command dev startup: MongoDB (Docker) + Backend + Frontend
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

clear
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  All-In-One Development Environment                  ║${NC}"
echo -e "${BLUE}║  MongoDB + Backend + Frontend                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
        ok ".env created from template"
    else
        fail ".env.example not found"
    fi
fi

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v docker &>/dev/null || fail "Docker not installed"
docker info &>/dev/null       || fail "Docker daemon not running — start Docker Desktop"
ok "Docker"

command -v node &>/dev/null   || fail "Node.js not installed"
ok "Node.js"

# ── Install deps ──────────────────────────────────────────────────────────────
if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
    info "Installing backend dependencies..."
    (cd "$ROOT_DIR/backend" && npm install --silent)
    ok "Backend dependencies installed"
fi
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    info "Installing frontend dependencies..."
    (cd "$ROOT_DIR/frontend" && npm install --silent)
    ok "Frontend dependencies installed"
fi

# ── Free ports 3000 and 5173 ─────────────────────────────────────────────────
free_port() {
    local port="$1"
    local pids
    # lsof (macOS/Linux) or fuser (Linux)
    if command -v lsof &>/dev/null; then
        pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    elif command -v fuser &>/dev/null; then
        pids=$(fuser "${port}/tcp" 2>/dev/null | tr ' ' '\n' || true)
    fi
    if [ -n "${pids:-}" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        ok "Port $port cleared"
    fi
}
info "Freeing ports 3000 and 5173..."
free_port 3000
free_port 5173

# ── MongoDB ───────────────────────────────────────────────────────────────────
echo ""
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^credit_card_mongo$'; then
    ok "MongoDB already running"
else
    info "Starting MongoDB..."
    # Use the Compose v2 plugin so volume/project names match README & full stack
    cd "$ROOT_DIR"
    docker compose -f "docker-compose.mongodb.yml" up -d 2>&1 || fail "Failed to start MongoDB"
    ok "MongoDB started"
    sleep 3
fi

# ── Start Backend + Frontend ──────────────────────────────────────────────────
echo ""
info "Launching services..."

# tmux — best experience (split panes)
if command -v tmux &>/dev/null; then
    SESSION="credit-card-dev"
    tmux kill-session -t "$SESSION" 2>/dev/null || true
    tmux new-session  -d -s "$SESSION" -x 220 -y 50
    tmux send-keys    -t "$SESSION" "cd '$ROOT_DIR/backend'  && npm run start:dev" Enter
    tmux split-window -h -t "$SESSION"
    tmux send-keys    -t "$SESSION" "cd '$ROOT_DIR/frontend' && npm run dev" Enter
    tmux select-pane  -t "$SESSION:0.0"
    ok "Services started in tmux (session: $SESSION)"
    echo ""
    echo -e "  ${YELLOW}Attach :${NC} tmux attach-session -t $SESSION"
    echo -e "  ${YELLOW}Detach :${NC} Ctrl+B then D"
    echo -e "  ${YELLOW}Kill   :${NC} tmux kill-session -t $SESSION"
    tmux attach-session -t "$SESSION"

# Windows Terminal
elif command -v wt &>/dev/null; then
    WIN_BE=$(cygpath -w "$ROOT_DIR/backend"  2>/dev/null || echo "$ROOT_DIR/backend")
    WIN_FE=$(cygpath -w "$ROOT_DIR/frontend" 2>/dev/null || echo "$ROOT_DIR/frontend")
    printf "@echo off\r\ncd /d \"%s\"\r\nnpm run start:dev\r\npause\r\n" "$WIN_BE" > /tmp/cc_backend.bat
    printf "@echo off\r\ncd /d \"%s\"\r\nnpm run dev\r\npause\r\n"       "$WIN_FE" > /tmp/cc_frontend.bat
    wt new-tab --title "Backend"  "$(cygpath -w /tmp/cc_backend.bat)" \; \
       new-tab --title "Frontend" "$(cygpath -w /tmp/cc_frontend.bat)"
    ok "Opened Windows Terminal tabs"

# PowerShell (Windows/Git Bash)
elif command -v powershell &>/dev/null || command -v pwsh &>/dev/null; then
    PS=$(command -v pwsh 2>/dev/null || command -v powershell)
    "$PS" -Command "Start-Process '$PS' -ArgumentList '-NoExit','-Command','cd ''$ROOT_DIR/backend''; npm run start:dev'"
    sleep 1
    "$PS" -Command "Start-Process '$PS' -ArgumentList '-NoExit','-Command','cd ''$ROOT_DIR/frontend''; npm run dev'"
    ok "Opened PowerShell windows"

# gnome-terminal / xterm / kitty fallback
elif command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- bash -c "cd '$ROOT_DIR/backend'  && npm run start:dev; bash" &
    sleep 1
    gnome-terminal -- bash -c "cd '$ROOT_DIR/frontend' && npm run dev; bash" &
    ok "Opened gnome-terminal windows"
elif command -v xterm &>/dev/null; then
    xterm -T "Backend"  -e bash -c "cd '$ROOT_DIR/backend'  && npm run start:dev; bash" &
    sleep 1
    xterm -T "Frontend" -e bash -c "cd '$ROOT_DIR/frontend' && npm run dev; bash" &
    ok "Opened xterm windows"
elif command -v kitty &>/dev/null; then
    kitty bash -c "cd '$ROOT_DIR/backend'  && npm run start:dev; bash" &
    sleep 1
    kitty bash -c "cd '$ROOT_DIR/frontend' && npm run dev; bash" &
    ok "Opened kitty windows"

# Last resort — background processes
else
    warn "No terminal emulator found — running in background"
    (cd "$ROOT_DIR/backend"  && npm run start:dev) > /tmp/cc_backend.log  2>&1 &
    BE_PID=$!
    sleep 2
    (cd "$ROOT_DIR/frontend" && npm run dev)        > /tmp/cc_frontend.log 2>&1 &
    FE_PID=$!
    echo "  Backend  PID: $BE_PID  (tail -f /tmp/cc_backend.log)"
    echo "  Frontend PID: $FE_PID  (tail -f /tmp/cc_frontend.log)"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Ready!                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${YELLOW}Frontend :${NC} http://localhost:5173"
echo -e "  ${YELLOW}Backend  :${NC} http://localhost:3000"
echo -e "  ${YELLOW}Health   :${NC} http://localhost:3000/health"
echo ""
echo -e "  ${BLUE}Stop MongoDB:${NC} docker compose -f docker-compose.mongodb.yml down"
echo ""

#!/usr/bin/env bash
# deploy.sh — one-click deploy for manage-credit-card on Ubuntu VPS
# Usage: sudo bash deploy.sh [--domain yourdomain.com] [--email admin@yourdomain.com]
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
fatal()   { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}▶ $*${NC}"; }

# ── Parse args ───────────────────────────────────────────────────────────────
DOMAIN=""
EMAIL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email)  EMAIL="$2";  shift 2 ;;
    *) fatal "Unknown argument: $1" ;;
  esac
done

# ── Guard: root + Ubuntu ──────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || fatal "Run as root:  sudo bash deploy.sh"
[[ -f /etc/os-release ]] && source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fatal "This script requires Ubuntu. Detected: ${ID:-unknown}"

UBUNTU_VERSION="${VERSION_ID:-}"
info "Ubuntu ${UBUNTU_VERSION} detected."

# ── Project root (script location) ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
info "Working directory: $SCRIPT_DIR"

# ─────────────────────────────────────────────────────────────────────────────
step "1 / 7  Install system packages"
# ─────────────────────────────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release git ufw wget 2>/dev/null
success "System packages ready."

# ─────────────────────────────────────────────────────────────────────────────
step "2 / 7  Install Docker CE + Compose plugin"
# ─────────────────────────────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
  success "Docker already installed (${DOCKER_VER}), skipping."
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/ubuntu/gpg" \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) \
signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null

  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable docker --now
  success "Docker $(docker --version | awk '{print $3}' | tr -d ',') installed."
fi

# sanity check compose plugin
docker compose version &>/dev/null || fatal "'docker compose' plugin not found."

# ─────────────────────────────────────────────────────────────────────────────
step "3 / 7  Configure .env"
# ─────────────────────────────────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"

prompt_if_missing() {
  local key="$1" prompt_text="$2" default="${3:-}"
  # already set in file → skip
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    existing=$(grep -E "^${key}=" "$ENV_FILE" | cut -d= -f2-)
    [[ -n "$existing" ]] && { info "${key} already set."; return; }
  fi
  local val
  if [[ -n "$default" ]]; then
    read -rp "  ${prompt_text} [${default}]: " val
    val="${val:-$default}"
  else
    while [[ -z "${val:-}" ]]; do
      read -rp "  ${prompt_text}: " val
    done
  fi
  # upsert
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  touch "$ENV_FILE"
  info ".env created."
fi

echo ""
echo "  Configure application secrets. Press Enter to keep existing/default values."
echo ""

prompt_if_missing "TELEGRAM_BOT_TOKEN"  "Telegram Bot Token (leave blank to disable bot)" ""
prompt_if_missing "JWT_SECRET"          "JWT secret key" "$(openssl rand -hex 32)"
prompt_if_missing "NODE_ENV"            "NODE_ENV" "production"

# Inject API URL into .env for reference (used by compose override for SSL)
if [[ -n "$DOMAIN" ]]; then
  API_URL="https://${DOMAIN}/api"
else
  PUBLIC_IP=$(curl -sf https://api.ipify.org || echo "localhost")
  API_URL="http://${PUBLIC_IP}:3000"
fi

prompt_if_missing "VITE_API_URL" "Frontend API URL" "$API_URL"

success ".env configured."

# ─────────────────────────────────────────────────────────────────────────────
step "4 / 7  Configure UFW firewall"
# ─────────────────────────────────────────────────────────────────────────────
ufw --force reset >/dev/null 2>&1
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp    comment "SSH"       >/dev/null
ufw allow 80/tcp    comment "HTTP"      >/dev/null
ufw allow 443/tcp   comment "HTTPS"     >/dev/null
# MongoDB port must NOT be reachable externally — apps talk internally via Docker network
ufw deny 27017/tcp  comment "MongoDB (internal only)" >/dev/null
ufw --force enable >/dev/null
success "UFW enabled: 22/80/443 open, 27017 blocked."

# ─────────────────────────────────────────────────────────────────────────────
step "5 / 7  Build & start containers"
# ─────────────────────────────────────────────────────────────────────────────
VITE_API_URL_VAL=$(grep -E '^VITE_API_URL=' "$ENV_FILE" | cut -d= -f2-)

COMPOSE_ARGS="docker compose -f docker-compose.yml"
if [[ -n "$DOMAIN" && -f "$SCRIPT_DIR/docker-compose.ssl.yml" ]]; then
  COMPOSE_ARGS+=" -f docker-compose.ssl.yml"
  info "SSL override: docker-compose.ssl.yml merged."
fi

# Pass VITE_API_URL as build arg so Vite bakes the correct URL
export VITE_API_URL="${VITE_API_URL_VAL:-http://localhost:3000}"

$COMPOSE_ARGS build --build-arg VITE_API_URL="$VITE_API_URL"
$COMPOSE_ARGS up -d --remove-orphans
success "Containers started."

# ─────────────────────────────────────────────────────────────────────────────
step "6 / 7  Wait for health checks"
# ─────────────────────────────────────────────────────────────────────────────
BACKEND_URL="http://localhost:3000/health"
info "Waiting for backend at ${BACKEND_URL} …"
MAX=30; COUNT=0
until wget -qO- "$BACKEND_URL" &>/dev/null; do
  COUNT=$((COUNT+1))
  [[ $COUNT -ge $MAX ]] && { warn "Backend not healthy after ${MAX} attempts — check logs: docker compose logs backend"; break; }
  sleep 3
  echo -n "."
done
[[ $COUNT -lt $MAX ]] && success "Backend is healthy."

# ─────────────────────────────────────────────────────────────────────────────
step "7 / 7  SSL setup (optional)"
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "$DOMAIN" ]]; then
  [[ -n "$EMAIL" ]] || read -rp "  Email for Let's Encrypt: " EMAIL

  # Install nginx + certbot on host for SSL termination
  apt-get install -y -qq nginx certbot python3-certbot-nginx 2>/dev/null

  # Write host nginx config — proxies to Docker containers
  NGINX_CONF="/etc/nginx/sites-available/credit-card"
  cat > "$NGINX_CONF" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    # ACME challenge passthrough (certbot)
    location /.well-known/acme-challenge/ { root /var/www/html; }

    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # ── Frontend (Docker container on port 8080) ──────────────────────────
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    # ── Backend API (Docker container on port 3000) ───────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
NGINXEOF

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/credit-card
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t && systemctl reload nginx

  # Obtain certificate
  certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

  # Auto-renew cron (runs twice daily, standard certbot recommendation)
  CRON_LINE="0 3,15 * * * root certbot renew --quiet --nginx"
  if ! grep -qF "certbot renew" /etc/crontab 2>/dev/null; then
    echo "$CRON_LINE" >> /etc/crontab
    success "Certbot auto-renew cron added."
  fi

  systemctl reload nginx
  success "SSL configured for https://${DOMAIN}"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Deploy complete!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo -e "  Frontend : ${BOLD}https://${DOMAIN}${NC}"
  echo -e "  API      : ${BOLD}https://${DOMAIN}/api${NC}"
else
  PUBLIC_IP=$(curl -sf https://api.ipify.org || echo "your-server-ip")
  echo -e "  Frontend : ${BOLD}http://${PUBLIC_IP}${NC}"
  echo -e "  API      : ${BOLD}http://${PUBLIC_IP}:3000${NC}"
fi
echo ""
echo -e "  Useful commands:"
echo -e "    docker compose logs -f          # stream logs"
echo -e "    docker compose ps               # container status"
echo -e "    docker compose down             # stop all"
echo -e "    docker compose up --build -d    # rebuild & restart"
echo ""

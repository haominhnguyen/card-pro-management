# CI/CD — Build on GitHub, deploy to your VPS via Cloudflare Tunnel

This repo ships a two-stage pipeline ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)):

```
 push to main
      │
      ▼
┌─────────────────────────────┐        ┌──────────────────────────────────────┐
│  build  (ubuntu-latest)     │        │  deploy  (self-hosted runner on VPS)   │
│  • build backend image      │  GHCR  │  • write .env from secrets             │
│  • build frontend image     ├───────▶│  • docker compose pull                 │
│  • push to ghcr.io (cached) │        │  • docker compose up -d                │
└─────────────────────────────┘        └───────────────┬────────────────────────┘
                                                        ▼
                        Cloudflare ──tunnel──▶ cloudflared ─▶ nginx (proxy) ─┬─▶ frontend
                        (TLS + your domain)                                  └─▶ backend ─▶ mongo
```

- **Fast build** runs on GitHub-hosted runners (free, fast, with layer caching) → images in **GHCR**.
- **Deploy** runs on **your own server** through a self-hosted runner — it only pulls + starts.
- **Cloudflare Tunnel** is the only public door. **No ports are opened on the VPS** (not even 80/443).
- **nginx** is the internal reverse proxy: one origin serves the SPA, `/api`, and `/socket.io`.

> Files: [`docker-compose.prod.yml`](../docker-compose.prod.yml) · [`deploy/nginx/default.conf`](../deploy/nginx/default.conf)

---

## One-time setup

### 1. Cloudflare Tunnel

1. Cloudflare Dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** → *Cloudflared*.
2. Name it (e.g. `card-pro`), **copy the tunnel token** (`eyJh...`). This becomes the
   `CLOUDFLARE_TUNNEL_TOKEN` secret below.
3. On the **Public Hostnames** tab add a route:
   - **Subdomain/Domain**: e.g. `card.yourdomain.com`
   - **Service**: `HTTP` → `proxy:80`
     (`proxy` is the nginx service name; cloudflared reaches it over the internal docker network)
4. Cloudflare auto-creates the DNS record and serves TLS at its edge. Done — no certbot, no open ports.

### 2. Self-hosted runner on the VPS

On the VPS (Docker + the compose plugin must be installed — `deploy.sh` step 2 does this, or install Docker CE manually):

```bash
# GitHub → repo → Settings → Actions → Runners → New self-hosted runner (Linux)
# Follow the shown ./config.sh command (the default `self-hosted` label is enough).
# Then install it as a service so it survives reboots:
sudo ./svc.sh install
sudo ./svc.sh start
```

The deploy job targets `runs-on: [self-hosted]`, so the default `self-hosted` label
matches. The runner's Linux user must be able to run `docker` (add it to the `docker`
group). If you run multiple self-hosted runners, give this one a unique label and use it
in `runs-on` to pin the deploy to the VPS.

### 3. GitHub secrets & variables

Repo → **Settings → Secrets and variables → Actions**.

**Variables** (not secret):

| Name           | Example                        | Purpose                                              |
|----------------|--------------------------------|------------------------------------------------------|
| `VITE_API_URL` | `https://card.yourdomain.com`  | Baked into the SPA — must equal your public origin.  |

**Secrets:**

| Name                      | Purpose                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `CLOUDFLARE_TUNNEL_TOKEN` | The tunnel token from step 1.                                           |
| `PROD_ENV_FILE`           | The **entire** backend `.env` (multi-line). See below.                  |

`GITHUB_TOKEN` is provided automatically and is used to push/pull GHCR images — no PAT needed
as long as the runner deploys the **same** repository.

#### `PROD_ENV_FILE` contents

Paste a full env file (the deploy job appends image tags + the tunnel token automatically):

```dotenv
# Mongo is the in-stack container — leave as-is unless using Atlas
MONGODB_URI=mongodb://mongo:27017/credit-card-db
PORT=3000

# Auth — generate two DIFFERENT 64-hex secrets:  openssl rand -hex 32
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Same origin as VITE_API_URL above (used for CORS + cookies)
FRONTEND_ORIGIN=https://card.yourdomain.com

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=

# Google Sheets (optional)
GOOGLE_SPREADSHEET_ID=
GOOGLE_APPLICATION_CREDENTIALS=./config/google-service-account.json
```

---

## Deploying

Just push to `main` (or run the workflow manually from the Actions tab):

```bash
git push origin main
```

Pipeline: `build` pushes `:latest` and `:<commit-sha>` tags to GHCR, then `deploy` pulls the
**exact sha** and brings the stack up. The deploy step waits for the backend `/health` to pass.

---

## Operations

```bash
# on the VPS, from the repo checkout (the runner's working dir, or a manual clone)
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f cloudflared

# manual rollback to a known good commit sha
BACKEND_IMAGE=ghcr.io/haominhnguyen/card-pro-management/backend:<sha> \
FRONTEND_IMAGE=ghcr.io/haominhnguyen/card-pro-management/frontend:<sha> \
docker compose -f docker-compose.prod.yml up -d
```

---

## Notes & alternatives

- **First deploy** can run the manual `workflow_dispatch` once secrets are set; mongo data
  persists in the named volumes across redeploys.
- **GHCR package visibility**: the first push creates private packages under your user. The
  self-hosted runner authenticates with `GITHUB_TOKEN`, so they can stay private.
- **Prefer no Tunnel?** You can instead orange-cloud a DNS `A` record to the VPS public IP,
  open 80/443, and put a **Cloudflare Origin Certificate** on `proxy`. The Tunnel approach
  here avoids open ports entirely and is recommended.
- The legacy [`deploy.sh`](../deploy.sh) (host nginx + Let's Encrypt) still works for a
  manual, non-Cloudflare deploy; this pipeline supersedes it for automated CD.

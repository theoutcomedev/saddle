# Quickstart: Deploying Saddle on Any VPS or Bare Metal Server

This guide explains how anyone can deploy **Saddle** onto any cloud VPS (Hetzner, DigitalOcean, AWS, Linode, OVH, etc.) or Bare Metal server in under 3 minutes.

---

## ⚡ 1-Minute Launch

### Prerequisites
- Any Linux server with **Docker** & **Docker Compose** installed (Ubuntu 22.04/24.04, Debian, Arch, Fedora, etc.)
- Open ports: `80` (Traefik gateway), `8080` (Traefik dashboard, optional), `3080` (Saddle app direct port, optional)

### Step 1: Clone Repository
```bash
git clone https://github.com/theoutcomedev/saddle.git
cd saddle
```

### Step 2: (Optional) Set an Admin Password
Create a `.env` file or export environment variables:
```bash
# Optional: Set a password to protect your Saddle instance
echo "SADDLE_ADMIN_PASSWORD=your-secure-password" > .env

# Optional: Set a custom domain (defaults automatically to <YOUR_VPS_IP>.sslip.io)
# echo "PUBLIC_DOMAIN=saddle.yourdomain.com" >> .env
```

### Step 3: Launch
```bash
docker compose up -d --build
```

That is it!

---

## 🌐 What Happens Automatically Behind the Scenes

When you run `docker compose up -d`:

1. **Auto IP & Domain Detection**:
   - `docker-entrypoint.sh` queries public IP reflection endpoints (`api.ipify.org`, `ifconfig.me`, `icanhazip.com`).
   - Automatically provisions `sslip.io` magic DNS. If your VPS IP is `123.45.67.89`, your instance is immediately accessible at:
     - **Main Saddle App:** `http://123.45.67.89/` or `http://123.45.67.89:3080/`
     - **Traefik Dashboard:** `http://123.45.67.89:8080/`

2. **Full Autonomous PaaS Engine Ready**:
   - The Traefik reverse proxy creates the shared bridge network `saddle-network`.
   - The embedded Docker socket is mounted into the Saddle container (`/var/run/docker.sock`).
   - **Autonomous App Deployment**: Any app the AI builds inside Saddle can be instantly deployed to a live URL (`http://<app-name>.<VPS_IP>.sslip.io`) without configuring DNS, certificates, or ports.

3. **Built-in Deployed Apps Control Center**:
   - The **Deployed Apps** button in the sidebar footer discovers all containers on `saddle-network`.
   - Provides 1-click status monitoring, live logs streaming, restart, stop, and delete controls out of the box.

4. **Self-Contained Persistence**:
   - Database (`PostgreSQL 15`), caching (`Redis 7`), user configurations (`config.yaml`), and workspaces persist across container restarts in named Docker volumes.

---

## 🛠️ Housekeeping & Day-2 Management

### Updating Saddle to the Latest Version
```bash
git pull origin master
docker compose up -d --build
```

### Checking Logs
```bash
# View all logs
docker compose logs -f

# View Saddle app logs only
docker compose logs -f saddle-app
```

### Stopping or Restarting
```bash
# Stop all services
docker compose down

# Restart all services
docker compose restart
```

### Data Backup & Restoration
All data resides in Docker volumes:
- `saddle-data` — Workspaces and session states
- `postgres-data` — Relational database records
- `redis-data` — Cache and async task queue state
- `saddle-apps` — Code repositories of autonomous deployed applications

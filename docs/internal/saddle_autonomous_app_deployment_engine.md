# Saddle Autonomous App Deployment Engine (Traefik + sslip.io)

**Status:** Implemented & Production-Ready
**Classification:** Core Infrastructure & PaaS Architecture
**Author:** DeepSeek AI / Saddle Engineering

---

## 1. Executive Summary

Saddle is designed not merely as a conversational AI harness, but as an **Autonomous AI Application Factory & Self-Hosted PaaS**.

Users can prompt Saddle to scaffold, build, and deploy full-stack web applications (Next.js, Vite/React, FastAPI, Node.js, Go, etc.) directly into production. Every application automatically receives its own live public URL via **`sslip.io` Magic DNS** and **Traefik Edge Routing** with zero manual server configuration.

---

## 2. System Architecture

```
                          ┌────────────────────────────────────────┐
                          │            Incoming Requests           │
                          │   http://<app>.91.99.165.95.sslip.io   │
                          │                  OR                    │
                          │        http://91.99.165.95:80          │
                          └───────────────────┬────────────────────┘
                                              │ (Port 80)
                          ┌───────────────────▼────────────────────┐
                          │         Traefik Edge Router            │ (Port 8080 Dashboard)
                          │  (Watches /var/run/docker.sock)        │
                          └───────────────────┬────────────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                               ▼                               ▼
     ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
     │   Saddle Core   │             │   User App 1    │             │   User App 2    │
     │  (Control Core) │             │ (e.g. SayPixels)│             │ (e.g. Kanban)   │
     │    Port 3080    │             │    Port 3000    │             │    Port 5173    │
     └─────────────────┘             └─────────────────┘             └─────────────────┘
```

### Core Components:

1. **Traefik v3 (Edge Gateway):**
   - Binds to host port `80` and `8080` (dashboard).
   - Attached to the shared bridge network `saddle-network`.
   - Listens to `/var/run/docker.sock` to detect new containers and route subdomains in real-time without restarting or reloading configuration files.

2. **`sslip.io` Magic DNS (Wildcard Routing):**
   - Free, zero-configuration public DNS resolver.
   - Any domain formatted as `<app-name>.<SERVER_IP>.sslip.io` automatically resolves to `<SERVER_IP>`.
   - Works on any VPS, cloud provider (Hetzner, DigitalOcean, AWS), or local machine without buying a domain.

3. **`saddle-app` (PaaS Orchestrator):**
   - Has access to `/var/run/docker.sock` and `docker-cli` inside the container.
   - Spawns sibling app containers with Traefik discovery labels.

---

## 3. How the AI Agent Deploys Applications

When a user asks Saddle to build and deploy an application, the agent follows the [.agents/skills/deploy-app/SKILL.md](../../.agents/skills/deploy-app/SKILL.md) workflow:

1. **Scaffold Project:** Writes application code in the workspace or `/app/apps/<app-name>/`.
2. **Generate `Dockerfile`:** Creates a standard production multi-stage build.
3. **Generate `docker-compose.yml`:** Attaches the container to `saddle-network` and adds Traefik discovery labels:
   ```yaml
   services:
     web:
       container_name: app-saypixels
       build: .
       restart: unless-stopped
       networks:
         - saddle-network
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.saypixels.rule=Host(`saypixels.91.99.165.95.sslip.io`)"
         - "traefik.http.services.saypixels.loadbalancer.server.port=3000"

   networks:
     saddle-network:
       external: true
   ```
4. **Launch Container:** Executes `docker compose up -d --build`.
5. **Verify & Report:** Checks container health and provides the user with the clickable live URL:
   `http://saypixels.91.99.165.95.sslip.io`

---

## 4. User Guide & How to Use

### How to Prompt the AI:

You can give Saddle simple natural language commands:

* **To build and deploy a new app:**
  > *"Build a Next.js voice memo prototype called `voicenotes` and deploy it live."*
  > *"Create a React Vite countdown timer app and deploy it on a live URL."*
  > *"Deploy the SayPixels prototype so I can test it on my phone."*

* **To update an existing app:**
  > *"Update the SayPixels app with dark mode and re-deploy it."*

* **To check status or logs:**
  > *"Check the logs for app `saypixels`."*
  > *"Show me all running deployed apps."*

* **To stop or remove an app:**
  > *"Stop the `saypixels` app container."*

---

### How to Access Deployed Apps & Dashboards:

1. **Deployed Applications:**
   - URL: `http://<app-name>.91.99.165.95.sslip.io`
   - Example: `http://saypixels.91.99.165.95.sslip.io`
   - Can be opened directly in any desktop or mobile browser.

2. **Traefik Visual Dashboard:**
   - URL: `http://91.99.165.95:8080`
   - Displays all active HTTP routers, services, and live containers on the VPS.

3. **Saddle Core Application:**
   - Root URL: `http://91.99.165.95/` (via Traefik port 80)
   - Direct URL: `http://91.99.165.95:3080/`

---

## 5. Upgrading to a Custom Domain (Future)

To use your own custom domain (e.g. `*.apps.yourdomain.com`):
1. Point a Wildcard A record `*.apps.yourdomain.com` ➔ `91.99.165.95`.
2. Update the Traefik router rule to match `Host(`<app-name>.apps.yourdomain.com`)`.
3. Traefik will automatically issue a free Let's Encrypt SSL certificate for seamless HTTPS.

---

## 6. Bare Metal & Non-Docker Deployment Mode

If Saddle is deployed on a raw Bare Metal Linux server without Docker (e.g. Node.js process managed directly by `systemd` or `pm2`), the routing and DNS engine operates with the following principles:

### A. `sslip.io` Magic DNS (100% Platform Agnostic)
`sslip.io` is pure DNS. It resolves hostnames to IP addresses before traffic ever touches your server:
- `<app>.<IP>.sslip.io` resolves directly to `<IP>` regardless of whether the server runs Docker, Bare Metal, or Kubernetes.

### B. Direct Port Exposure (Zero-Config Bare Metal)
On Bare Metal, every process started by an agent (e.g. `pnpm start --port 3001` or `uvicorn main:app --port 8000`) binds directly to the host network interface `0.0.0.0`:
- **Direct Access:** Any app is immediately accessible via `http://<SERVER_IP>:<PORT>` (e.g. `http://91.99.165.95:3001`).

### C. Traefik File Provider / Caddy on Bare Metal (Named Subdomains)
To have named subdomains (`http://saypixels.<IP>.sslip.io`) without Docker:
1. Traefik runs as a native binary / service on host port `80`.
2. Traefik watches a dynamic configuration folder (`/etc/traefik/dynamic/*.yml`).
3. When the agent launches a host process on port `3001`, it drops a lightweight YAML file into `/etc/traefik/dynamic/saypixels.yml`:
   ```yaml
   http:
     routers:
       saypixels:
         rule: "Host(`saypixels.91.99.165.95.sslip.io`)"
         service: saypixels
     services:
       saypixels:
         loadBalancer:
           servers:
             - url: "http://127.0.0.1:3001"
   ```
4. Traefik reloads the route instantly with zero downtime.

---

## 7. Sandbox Execution & Docker Socket Permissions

### Why `workspace-write` mode does not apply to container deployment:
* **Filesystem Confined (`workspace-write`):** In `workspace-write` sandbox mode, Linux namespaces (via bubblewrap/landlock) lock the process into the local project directory and strictly block access to UNIX domain sockets (including `/var/run/docker.sock`).
* **Container Orchestration (`danger-full-access` / Unconfined):** To build Docker images and command the Docker daemon to attach sibling containers to `saddle-network`, the agent operates with unconfined socket permissions.
* The container is configured with `cap_add: [SYS_ADMIN]` and `security_opt: [apparmor:unconfined]` so both confined and unconfined tool calls execute reliably.

---

## 8. Multi-Tenant SaaS Architecture & Data Isolation Roadmap

When Saddle scales to multi-tenant hosting, the engine operates as an autonomous multi-tenant Micro-PaaS:

### A. Tenant Subdomain Namespacing
* Container naming & Traefik rules are auto-scoped to the tenant:
  `http://<app-name>-<tenant-id>.<SERVER_IP>.sslip.io` (or `http://<app-name>.<username>.saddle.app`).
* Prevents name collisions between users.

### B. Data & File Isolation
* Dedicated volume mount directories per tenant:
  `/data/tenants/<tenant-id>/apps/<app-name>/uploads/`
* User A's container only mounts User A's directory. User A cannot view, read, or modify User B's files.

### C. Database Isolation
* **SQLite Model:** Each tenant app gets its own isolated SQLite database file. Zero RAM idle cost, zero cross-tenant bleeding, instant 1-click backups.
* **Postgres Model:** Saddle auto-provisions tenant-scoped databases (`CREATE DATABASE db_<tenantId>_<appId>`) with private random credentials.

### D. Auto-Sleep / Hibernation (Replit Model)
* Idle containers (no web traffic for 15m) are paused to save RAM.
* Traefik or a wake proxy intercepts incoming HTTP requests and revives the container in ~1.5 seconds.

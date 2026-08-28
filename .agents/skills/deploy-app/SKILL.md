---
name: deploy-app
description: Deploy any web application or project built in Saddle to a live public URL using Traefik and sslip.io magic DNS.
---

# Deploy App Skill (Autonomous PaaS)

Use this skill whenever the user asks to deploy, host, run, or publish a web application, prototype, backend, or full-stack project built in Saddle.

---

## Architecture Overview

All deployed apps run as Docker containers attached to the shared `saddle-network`.
Traefik automatically discovers the container via Docker labels and routes HTTP traffic on port 80 based on the subdomain.

* **Server IP:** Auto-detected from host via `$SADDLE_SERVER_IP` or `$HOST_PUBLIC_IP` (e.g. `91.99.165.95` or any VPS IP).
* **Live App URL:** `http://<app-name>.<SERVER_IP>.sslip.io` (or `http://<app-name>.localhost` if running locally)
* **Direct Port Access (optional backup):** `http://<SERVER_IP>:<allocated_port>`
* **Traefik Dashboard:** `http://<SERVER_IP>:8080`

---

## Deployment Workflow

### Step 1: Prepare the App Name & Port
Choose a slugified lowercase name for the app (e.g., `saypixels`, `kanban-board`, `fastapi-backend`).
Determine the container internal listening port (e.g., `3000` for Next.js, `5173` for Vite/React, `8000` for FastAPI/Python).

### Step 2: Create / Verify `Dockerfile`
Ensure the project has a production-ready `Dockerfile`.

#### Common Dockerfile Templates:

**A. React / Vite / Static SPA (Nginx):**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**B. Next.js (Node.js standalone):**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

**C. Python FastAPI / Flask:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### Step 3: Create `docker-compose.yml` for the App

In the app's root directory, write a `docker-compose.yml`:

```yaml
services:
  web:
    container_name: app-<APP_NAME>
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    networks:
      - saddle-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.<APP_NAME>.rule=Host(`<APP_NAME>.${SERVER_IP:-91.99.165.95}.sslip.io`)"
      - "traefik.http.services.<APP_NAME>.loadbalancer.server.port=<CONTAINER_PORT>"

networks:
  saddle-network:
    external: true
```

---

### Step 4: Build and Launch the Container

Run the deployment command inside the app directory:

```bash
docker compose up -d --build
```

---

### Step 5: Verify Health & Respond to User

1. Wait 3–5 seconds for the container to boot.
2. Check container status:
   ```bash
   docker ps --filter "name=app-<APP_NAME>"
   ```
3. Test HTTP response:
   ```bash
   curl -I "http://<APP_NAME>.91.99.165.95.sslip.io"
   ```
4. Respond to the user with the live link:
   > 🚀 **Your app is deployed and live!**
   > - **Live URL:** [http://<APP_NAME>.91.99.165.95.sslip.io](http://<APP_NAME>.91.99.165.95.sslip.io)
   > - **Status:** Running in Docker container `app-<APP_NAME>`

# Saddle Deployed Apps & PaaS Control Center Architecture

**Status:** Production Standard Specification
**Classification:** Core Application Management & Visual PaaS Orchestration
**Target Systems:** Saddle OS Sidebar, Cordis Host APIs, Traefik Reverse Proxy, Web Client

---

## 1. Executive Summary

Saddle empowers users and autonomous coding agents to build, containerize, and deploy full-stack web applications to live public URLs in seconds. To provide zero-friction visibility and operational management over these running services, Saddle includes a native **Deployed Apps Control Center**.

Located in the sidebar footer (above Settings) with a native app-grid icon, the dashboard discovers active containers connected to `saddle-network`, inspects their Traefik routing rules, and provides single-click lifecycle controls (Open App, View Logs, Restart, Stop, and Delete).

---

## 2. Discovery & Routing Architecture

```
┌────────────────────────────────────────────────────────┐
│ Saddle Host Backend (RPC: apps.list)                   │
└──────────────────────────┬─────────────────────────────┘
                           │ Runs: docker ps -a --format "{{json .}}"
                           ▼
┌────────────────────────────────────────────────────────┐
│ Filter & Inspection Engine:                            │
│  - Filters for saddle-network / traefik.enable=true    │
│  - Excludes core infra (saddle-app, postgres, redis)   │
│  - Parses Traefik Host Rule: Host(`app.domain.sslip.io`)│
│  - Extracts Internal Port: loadbalancer.server.port    │
│  - Reads Container State: running / stopped / restart  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ (RpcResponse<{ apps: DeployedAppView[] }>)
┌────────────────────────────────────────────────────────┐
│ Client UI (DeployedAppsStore + DeployedAppsModal)      │
│  - Reactive live card grid with active status badges   │
│  - Direct clickable URL link: http://<app>.<ip>.sslip.io│
│  - 1-Click Actions: [Open ↗] [Logs 📜] [Restart 🔄]    │
└────────────────────────────────────────────────────────┘
```

---

## 3. The Five Core RPC Endpoints

| RPC Method | Input Payload | Output / Effect | Description |
| :--- | :--- | :--- | :--- |
| `apps.list` | `{}` | `{ apps: DeployedAppView[] }` | Queries Docker for all running and stopped apps on `saddle-network`. |
| `apps.restart` | `{ name: string }` | `{ success: boolean }` | Triggers `docker restart <container>` without re-building image layers. |
| `apps.stop` | `{ name: string }` | `{ success: boolean }` | Gracefully stops the container (`docker stop <container>`). |
| `apps.delete` | `{ name: string }` | `{ success: boolean }` | Forcefully stops and removes the container (`docker rm -f <container>`). |
| `apps.logs` | `{ name: string, tail?: number }` | `{ logs: string }` | Streams the last 150 lines of stdout and stderr from the container. |

---

## 4. Visual UI Design Principles

1. **Native Iconography (No Emojis):** Uses a clean 16x16 App Grid SVG matching Saddle's design system and the Settings gear geometry.
2. **Active Count Badge:** Displays a discrete live counter (e.g. `2`) next to the button when applications are running.
3. **Glassmorphism Modal:** Centered overlay with escape-to-close behavior, backdrop blur, and responsive grid layout.
4. **Terminal Log Drawer:** Built-in dark monospace logs viewer with 1-click **Copy Logs** button and auto-scroll to the bottom.

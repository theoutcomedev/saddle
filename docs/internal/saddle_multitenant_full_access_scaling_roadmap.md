# Saddle Multi-Tenant Scaling & Full Access Architecture Roadmap

**Status:** Strategic Architecture Specification
**Classification:** Core Infrastructure, Security & Scalability Blueprint
**Target Systems:** Saddle OS, Traefik v3, Docker Orchestrator, Firecracker MicroVMs

---

## 1. Executive Summary

Saddle is architected as an **Autonomous AI Software Factory & Self-Hosted PaaS**. In single-player mode, the AI agent enjoys direct root sovereignty to spawn sibling containers, manage Docker networks, and configure Traefik edge routes.

As Saddle transitions from a personal power tool into a high-concurrency **Multi-Tenant SaaS platform**, the platform must provide users and AI agents with the same unconstrained "Full Access" experience without risking host compromise, noisy neighbors, or cross-tenant data leaks.

This document outlines the four-phase architectural roadmap for scaling execution sandboxes and app hosting from 1 user to 100,000+ concurrent developers.

---

## 2. Evolution Roadmap Overview

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│         PHASE 1         │     │         PHASE 2         │     │         PHASE 3         │     │         PHASE 4         │
│   Single-Player (Today) │ ──► │  Multi-Tenant SaaS MVP  │ ──► │ Global Scale MicroVMs   │ ──► │ Multi-Node Fleet & BYOC │
│  Raw Docker Socket & IP │     │  Scoped Docker Proxy    │     │ Firecracker / gVisor    │     │ Multi-Cloud Auto-Scale  │
│      (1 - 5 Users)      │     │  (100 - 2,000 Users)    │     │  (10,000+ Active Devs)  │     │   (Enterprise Teams)    │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

---

## 3. Phase-by-Phase Architecture

### Phase 1: Single-Player / Personal PaaS (Current)
* **Execution Model:** Direct `/var/run/docker.sock` access inside `saddle-app`.
* **Routing:** Traefik v3 Docker provider with `sslip.io` dynamic DNS and direct port bindings.
* **Security:** Trusted single-owner root sovereignty.
* **Hardware Cost:** ~€6 – €13 / month (Single Hetzner VPS).
* **Capacity:** 10 – 30 active deployed applications.

---

### Phase 2: Multi-Tenant SaaS MVP (100 – 2,000 Users)
* **Goal:** Launch a commercial SaaS with isolated accounts, self-serve signups, and safe app deployments on a single dedicated server.

```
                                  INCOMING TRAFFIC
                             http://<app>-<tenantId>.<domain>
                                            │
                                            ▼ (Port 80/443)
                                 ┌────────────────────┐
                                 │ Traefik v3 Router  │
                                 └──────────┬─────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
      │  User A App     │          │  User B App     │          │  Saddle Core    │
      │  app-alex-chat  │          │  app-sarah-cms  │          │  PaaS Engine    │
      │  RAM: Max 384MB │          │  RAM: Max 384MB │          │  Port 3080      │
      └─────────────────┘          └─────────────────┘          └─────────────────┘
```

#### Core Components:
1. **Scoped PaaS Controller (Docker Socket Proxy):**
   * Instead of exposing the raw Docker socket to tenant containers, commands flow through an internal Saddle Deployment Service.
   * Forces strict container naming convention: `app-<tenantId>-<appName>`.
   * Enforces container-level hardware limits (`cpus: "0.50"`, `memory: "384M"`).
   * Restricts tenant operations: User A can only query, stop, or view logs for `app-alex-*`.

2. **Filesystem Jails (`workspace-write`):**
   * Bubblewrap (`bwrap`) + Landlock Linux Security Modules confine file modifications strictly to `/data/tenants/<tenantId>/workspace/`.
   * System paths, host credentials, and other tenants' directories are unmounted or set to read-only.

3. **Auto-Sleep Hibernation (The Replit Model):**
   * Idle applications (zero HTTP requests for 15 minutes) are paused to disk, reclaiming 100% of their resident RAM.
   * Traefik middleware (e.g. Sablier or custom Saddle wake proxy) intercepts incoming HTTP requests, revives the container in ~1.5 seconds, and forwards the connection.
   * **Result:** A single 64GB RAM server can support **1,500+ active user applications** simultaneously.

* **Hardware Cost:** ~€45 – €85 / month (Hetzner AX41 Dedicated Server: 64GB DDR4, AMD Ryzen 5 3600, 2x 512GB NVMe).

---

### Phase 3: High-Scale Concurrency & MicroVM Sandboxes (10,000+ Users)
* **Goal:** Provide genuine, unconstrained root Full Access to untrusted code at massive concurrency with zero security risks.

```
                              HOST PHYSICAL MACHINE
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                                                                           │
  │   ┌───────────────────────────┐           ┌───────────────────────────┐   │
  │   │     MicroVM Tenant A      │           │     MicroVM Tenant B      │   │
  │   │  (Firecracker / gVisor)   │           │  (Firecracker / gVisor)   │   │
  │   │  - Boot time: 100ms       │           │  - Boot time: 100ms       │   │
  │   │  - Dedicated Linux Kernel │           │  - Dedicated Linux Kernel │   │
  │   │  - Unrestricted Root DinD │           │  - Unrestricted Root DinD │   │
  │   └─────────────┬─────────────┘           └─────────────┬─────────────┘   │
  │                 │                                       │                 │
  │                 ▼ (Isolated Tap Interface)              ▼                 │
  │   ┌───────────────────────────────────────────────────────────────────┐   │
  │   │                  Traefik Mesh & Network Ingress                   │   │
  │   └───────────────────────────────────────────────────────────────────┘   │
  └───────────────────────────────────────────────────────────────────────────┘
```

#### Core Components:
1. **Firecracker / gVisor MicroVMs:**
   * Each user session runs inside a lightweight, hardware-virtualized MicroVM with its own dedicated Linux kernel.
   * Boots in **under 120 milliseconds**.
   * Users and AI agents possess **100% genuine root Full Access** inside their MicroVM (running custom kernels, raw Docker-in-Docker, iptables, background daemons).
   * Even a full root compromise inside the MicroVM cannot escape the hardware hypervisor.

2. **Ephemeral Memory Snapshotting:**
   * When a user closes their browser or stops interacting, the MicroVM memory state is snapshotted to NVMe storage in ~50ms (0 CPU / 0 RAM idle footprint).
   * When the user returns, the VM resumes from its exact execution state in ~100ms.

---

### Phase 4: Multi-Node Fleet Orchestration & Enterprise BYOC
* **Goal:** Auto-scaling across multiple cloud regions and distributing on-premise private clouds.

```
                                GLOBAL INGRESS
                                *.saddle.app
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
             ┌─────────────────────┐   ┌─────────────────────┐
             │ US Worker Cluster   │   │ EU Worker Cluster   │
             │ (Nodes 1..N)        │   │ (Nodes 1..N)        │
             │ 10,000 MicroVMs     │   │ 10,000 MicroVMs     │
             └─────────────────────┘   └─────────────────────┘
```

1. **Autonomous Fleet Autoscaler:**
   * Central Control Plane monitors worker node saturation (CPU, RAM, disk).
   * When a cluster reaches 80% capacity, Saddle calls cloud provider APIs (Hetzner Cloud, AWS, DigitalOcean) to provision a new worker node in 30 seconds.

2. **Enterprise BYOC (Bring Your Own Cloud):**
   * Enterprise teams can deploy Saddle within their own private AWS VPC, GCP project, or bare-metal Kubernetes cluster via a 1-line installation script:
     ```bash
     curl -sSL https://get.saddle.app | bash
     ```

---

## 4. Multi-Tenant Permission & Security Matrix

| Feature | Phase 1 (Single-Player) | Phase 2 (SaaS MVP) | Phase 3 (Scale SaaS) | Phase 4 (Enterprise) |
| :--- | :--- | :--- | :--- | :--- |
| **Code Editing Sandbox** | Host-level / unconfined | `workspace-write` (bwrap) | MicroVM isolated jail | Customer VPC Sandboxed |
| **Docker / Full Access** | Raw host `/var/run/docker.sock` | Scoped PaaS Proxy & Caps | Unrestricted DinD in MicroVM | Private Node DinD |
| **Public App Domains** | `<app>.<IP>.sslip.io` | `<app>-<user>.<domain>` | Custom Domains + Auto-SSL | Wildcard Internal DNS |
| **App Hibernation** | Manual stop | Auto-sleep after 15m | 50ms Memory Snapshots | Configurable Policy |
| **Max Concurrent Users** | 1 - 5 | 500 - 2,000 per server | 50,000+ across fleet | Unlimited (BYOC) |

---

## 5. Summary & Action Items

1. **Current State:** Single-player mode is fully equipped with dynamic IP auto-detection, Traefik edge routing, and native `saddle:deployment` system prompt integration.
2. **Next Milestone (Phase 2):** When initiating the SaaS MVP, implement the Scoped Deployment Proxy and Sablier auto-sleep middleware.
3. **Long-Term Ceiling (Phase 3):** Transition execution to Firecracker MicroVMs to unlock true Replit/Fly.io-grade multi-tenant scale with absolute hardware isolation.

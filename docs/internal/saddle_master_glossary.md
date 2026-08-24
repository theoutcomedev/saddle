# The Master Saddle Glossary: Engineering, Architecture, AI & Enterprise Operations

A first-principles reference dictionary for the core concepts, technologies, and terms used across Saddle's software engineering, infrastructure, security, and global business operations.

---

## 1. Core Architecture & Software Engineering

### Micro-Kernel
* **What it is:** A software design pattern where the core engine contains only the absolute bare minimum logic required to run (lifecycle management, service registration, event bus). Everything else—from the UI sidebar to the database layer—is loaded as pluggable modules.
* **In Saddle:** Cordis is our micro-kernel. The core binary has zero hardcoded opinions; it just boots services and lets plugins mount into it.

### Inversion of Control (IoC)
* **What it is:** Instead of your custom code calling a centralized library, the framework calls your custom code when needed. You don't manage the execution lifecycle; the container injects dependencies into you.
* **In Saddle:** Plugins state their dependencies declaratively (e.g. `static inject = ['ui-slots', 'database']`). Cordis automatically injects those services when they become active.

### Composability
* **What it is:** The design property where system components can be selected, assembled, reordered, or replaced in infinite configurations like Lego bricks, without breaking the rest of the application.
* **In Saddle:** Every button, panel, agent tool, and LLM router is composable. A user or plugin can swap the main chat view for a 3D canvas or an Excel sheet at runtime.

### Slots and Outlets (`ui-slots`)
* **What it is:** An architectural pattern where React components do not hardcode their child components. Instead, they render empty "Outlets" (named mounting points), and external plugins register "Slot Occupants" to fill them.
* **In Saddle:** `<SlotOutlet name="workspace.center" />` allows any plugin to provide the center screen view. If no plugin is active, it renders a default fallback.

### Headless UI
* **What it is:** Software that contains all the complex state management, data streaming, and business logic, but renders zero rigid visual DOM elements by default, leaving visual presentation 100% open.
* **In Saddle:** Saddle's engine is headless. The visual shell is just an arrangement of dynamic Outlets.

### Hot Module Replacement (HMR)
* **What it is:** The ability to inject updated JavaScript code into a live running browser or server process without reloading the page or losing current state.
* **In Saddle:** `/plugins/<id>/client.js` allows new plugins or themes to be installed and mounted into the active React tree in milliseconds without a page refresh.

---

## 2. Infrastructure, Cloud & Hosting

### VPS (Virtual Private Server)
* **What it is:** A virtualized slice of a physical computer running in a datacenter. You get dedicated CPU cores, RAM, and storage with full root access over the Linux operating system.
* **In Saddle:** Our Hetzner VPS (`91.99.165.95`) acts as our cloud production host.

### Bare Metal
* **What it is:** A physical server dedicated entirely to a single tenant with no virtualization hypervisor layer in between. Offers maximum raw computing and disk I/O performance.
* **In Saddle:** High-tier Enterprise clusters ($5,000/mo+) can be deployed on dedicated Hetzner or Equinix Bare Metal machines.

### Containerization (Docker)
* **What it is:** Packaging an application and all its dependencies (Node.js, libraries, system binaries) into a standardized, self-contained unit (a "Container") that runs identically on any Linux machine.
* **In Saddle:** We run 3 isolated containers: `saddle-app-1` (the web runtime), `saddle-postgres-1` (the database), and `saddle-redis-1` (the task cache).

### Docker Volume
* **What it is:** A persistent storage directory managed by Docker that lives outside container lifecycles. Even if you destroy and rebuild a container, data stored in a volume is preserved.
* **In Saddle:** `deepseek-harness_saddle-data` stores our persistent application files and databases across container rebuilds.

### Reverse Proxy (NGINX)
* **What it is:** An intermediary server sitting between the public internet and backend applications. It receives incoming requests on port 80/443, handles SSL encryption, enforces basic authentication, and routes traffic internally to backend ports.
* **In Saddle:** NGINX listens on public port `80` and forwards authenticated traffic internally to the Docker container listening on port `3080`.

### DNS-Rebinding Protection / Trust Fence
* **What it is:** A web security defense that prevents malicious websites in a user's browser from making unauthorized background requests to local IP addresses (`127.0.0.1` or internal VPS ports).
* **In Saddle:** `packages/client/connection/src/api-request-trust.ts` checks incoming `Host` headers against trusted whitelist flags (`--trusted-host 91.99.165.95`).

### Loopback / Localhost (`127.0.0.1`)
* **What it is:** A closed network loop that routes packets back into the local machine. Any service bound only to `127.0.0.1` cannot be reached from the outside internet.
* **In Saddle:** PostgreSQL (`5432`) and Redis (`6379`) are bound strictly to `127.0.0.1`, making them completely invisible to external hackers.

---

## 3. Databases & Multi-Tenancy

### Multi-Tenancy
* **What it is:** A software architecture where a single instance of an application serves multiple distinct users or organizations ("tenants"), while guaranteeing complete data isolation and privacy between them.
* **In Saddle:** Sprint 2 introduces multi-tenancy so thousands of consumers and enterprises can use Saddle on shared infrastructure without seeing each other's data.

### Row-Level Security (RLS)
* **What it is:** A PostgreSQL security feature that enforces access control at the database row level. Even if a backend bug writes a broad query (`SELECT * FROM sessions`), the database engine automatically restricts returned rows to `WHERE user_id = current_user`.
* **In Saddle:** RLS ensures strict data isolation between all users and guarantees the Founder Superadmin has an impenetrable private data vault.

### SQLite vs. PostgreSQL
* **SQLite:** A lightweight, zero-configuration database that writes directly to a single file on disk. Perfect for single-user local applications (powers **Saddle Lite**).
* **PostgreSQL:** An enterprise-grade, highly concurrent client-server relational database with advanced indexing, JSON support, and Row-Level Security (powers **Saddle Cloud**).

### JSONB
* **What it is:** PostgreSQL's binary JSON format that stores unstructured JSON documents with indexed, high-speed querying capabilities.
* **In Saddle:** Used in `user_installed_plugins.user_config` and `sessions.payload` to store custom UI states and dynamic plugin parameters without requiring schema changes.

---

## 4. Security, Cryptography & Sandboxing

### AES-256-GCM (Authenticated Encryption)
* **What it is:** The gold standard in symmetric encryption. It encrypts data using a 256-bit key and generates an authentication tag that detects any tampering or corruption.
* **In Saddle:** Used in our `credentials_vault` table to encrypt user API keys (DeepSeek, OpenAI, Anthropic) before writing them to the database.

### Initialization Vector (IV) & Nonce
* **What it is:** A random, unique number generated for every single encryption operation. Ensures that encrypting the same API key twice produces completely different ciphertexts, preventing pattern analysis.

### Landlock & Chroot Sandboxing
* **What it is:** Linux kernel security mechanisms that restrict what files and network sockets an autonomous agent subprocess can access.
* **In Saddle:** When an agent runs bash or python scripts, Landlock traps the execution inside an isolated directory micro-jail, preventing it from reading host files or attacking the server.

### JWT (JSON Web Token)
* **What it is:** A digitally signed, stateless token passed in HTTP headers that securely proves a user's identity, role, and tenant ID across API requests.

---

## 5. Real-Time Data & UI Protocols

### Server-Sent Events (SSE)
* **What it is:** A lightweight HTTP streaming protocol where a server pushes real-time text/event frames to a client over a persistent connection (unlike WebSockets, SSE is one-way, highly efficient, and firewall-friendly).
* **In Saddle:** Used to stream real-time LLM token outputs, subagent status changes, and autonomous task progress frames to the browser.

### Observable Projections (`useProjection`)
* **What it is:** A reactive UI subscription pattern. Instead of the entire page re-rendering when a token is generated, only the specific DOM node subscribed to that projection key re-renders.
* **In Saddle:** Delivers 60 FPS UI responsiveness during heavy background multi-agent workflows.

### JSON-RPC 2.0
* **What it is:** A standardized remote procedure call protocol encoded in JSON. It allows two independent processes (or a browser and a worker) to call functions on each other asynchronously.
* **In Saddle:** Used by the Subagent delegation protocol and the Cordis Plugin communication bridge.

### Zstandard (`zstd`) & JSONL
* **JSONL (JSON Lines):** A file format where each line is an independent JSON object, ideal for append-only streaming logs.
* **Zstandard (`zstd`):** A high-performance, real-time compression algorithm developed by Meta.
* **In Saddle:** Chat histories are stored as `.jsonl.zst` files, reducing disk footprint by ~60% while maintaining instant read speeds.

---

## 6. AI & Autonomous Agent Concepts

### Cognitive Operating System (Cognitive OS)
* **What it is:** A layer of software that abstracts foundation models, memory, tools, and visual interfaces into a unified environment where humans and autonomous agents collaborate seamlessly.
* **In Saddle:** Saddle is the Cognitive OS that bridges raw intelligence with real-world human action.

### Autonomous Agent Swarms
* **What it is:** Multiple specialized AI agents (e.g. Architect, Coder, Tester, Researcher) working in parallel, delegating tasks to one another, and resolving complex goals collaboratively.
* **In Saddle:** Saddle's subagent engine spawns, coordinates, and monitors multi-agent swarms with isolated workspaces and unified memory.

### Bring Your Own Key (BYOK)
* **What it is:** A commercial model where users provide their own direct API keys from model vendors (DeepSeek, OpenAI, Anthropic), allowing them to use the software without paying token markups.
* **In Saddle:** We charge a flat **$10/month BYOK Platform Fee**, capturing pure margin while capping resource concurrency via Redis.

---

## 7. Business, Corporate & Legal Operations

### Merchant of Record (MoR)
* **What it is:** A legal entity that sells goods or services to end consumers on your behalf, taking full responsibility for processing payments, international currency conversions, and global sales tax / VAT compliance.
* **Examples:** Paddle, Lemon Squeezy, or Stripe Billing combined with Stripe Tax.
* **In Saddle:** Automates global tax collection and ensures compliance across 100+ countries with zero tax friction.

### Economic Nexus & EU VAT Reverse Charge
* **Economic Nexus:** US state laws requiring companies exceeding certain revenue thresholds (e.g., $100k) to collect and remit local state sales tax.
* **EU VAT Reverse Charge:** An EU regulation allowing B2B buyers to account for VAT in their own country, exempting the seller from charging tax on cross-border transactions.

### Delaware C-Corporation
* **What it is:** The standard corporate legal structure required by venture capitalists, institutional investors, and global accelerators (e.g., Y Combinator). Provides liability protection, flexible share classes, and corporate tax predictability.

### Section 83(b) Election
* **What it is:** A critical IRS filing made within 30 days of receiving equity in a startup. It allows founders to pay taxes on the nominal value of their stock at founding rather than paying massive income tax as the company valuation grows.

### SAFE (Simple Agreement for Future Equity)
* **What it is:** A standardized, founder-friendly investment contract created by Y Combinator that allows startups to raise early capital without setting an immediate formal corporate valuation.

### 70/30 Creator Marketplace Split
* **What it is:** The industry-standard digital marketplace revenue model (popularized by Apple's App Store) where 70% of plugin sales go directly to the creator and 30% is retained by Saddle Treasury.

# Saddle Plugin Architecture & Extensibility

This document outlines the architectural vision and technical implementation of the Saddle/DeepSeek Harness plugin ecosystem. It covers the current "Single-Player" mode and the roadmap for scaling to a "Multi-Tenant Marketplace."

---

## 1. The Core Philosophy

The fundamental design of Saddle blurs the line between **User** and **Developer**. By leveraging AI agents that can write, compile, and execute code within the live application environment, users can build the platform *while they are using it*.

The engine powering this extensibility is **Cordis**, a highly modular Inversion of Control (IoC) framework. Cordis operates on the concept of **Contexts**—isolated bubbles of capabilities that can be nested and dynamically loaded.

---

## 2. Terminology: "Apps" vs. "Plugins"

In user-facing discussions, you will often hear the terms "Apps" and "Plugins." It is critical to understand that **architecturally, there is no difference between them.** Both are fundamentally Cordis Plugins.

* **"Apps":** A Cordis Plugin that leans heavily into the UI/Client APIs to render a visual interface (e.g., a Calculator, a Fitness Dashboard, or a Notepad).
* **"Plugins":** A Cordis Plugin that leans heavily into the Backend/Host APIs to perform background work (e.g., an automated workflow, an API data fetcher, or a custom tool for the AI to use).

Because they share the exact same underlying architecture, the Marketplace distribution model applies equally to both. Both are packaged as JavaScript bundles, uploaded to the same database, and hot-loaded into Tenant Contexts using the exact same mechanisms.

---

## 3. Single-Player Architecture (Current State)

In the current single-player deployment on your VPS, you (the sole user) operate with "Root Admin" privileges. The AI has full read/write access to the host machine's Docker container.

### A. Temporary Plugins (Session-Scoped)
* **What they are:** Quick, ephemeral tools built on the fly (e.g., a crypto-price checker).
* **How they work:** The AI writes the code and dynamically mounts it into the Cordis Context of your *current chat session*.
* **Lifecycle:** When the chat is closed or the server (PM2) restarts, the context is destroyed and the plugin vanishes. It leaves no trace on the file system.

### B. Permanent Plugins (Source Code Modification)
* **What they are:** Lasting features, UI components, or background services (e.g., the full-screen App Store & Notepad).
* **How they work:** The AI acts as a developer. It writes physical TypeScript/React files into the core codebase (`/app/packages/`), edits compiler configurations (`tsconfig.json`), and modifies the global composition file (`cordis.patch.yml`).
* **Lifecycle:** These survive server restarts. However, because they are written into the ephemeral Docker container, a developer (you) must manually extract them via SSH and push them to the official GitHub repository to ensure they survive future deployments.

---

## 4. Multi-Tenant Architecture (The Future Marketplace)

To scale to 1,000+ users and become the "Apple Store of the AI era," the architecture fundamentally shifts from **Source Code Modification** to **Marketplace Distribution**.

### A. The End of "Full Access" (The Sandbox)
In a multi-tenant world, the core Saddle GitHub repository becomes the **Read-Only Operating System**.
Users and their AI agents will no longer have permission to modify `/app/packages/` or reboot the server. Instead, the AI will be mathematically fenced to only write code into a private, user-specific tenant folder (e.g., `/data/tenants/user_123/`).

### B. Tenant Contexts (The User Bubble)
Cordis handles multi-tenancy by forking the root context.
* Every user gets their own persistent **Tenant Context**.
* If User A installs a plugin, it is dynamically mounted *only* into User A's Tenant Context.
* Even though User A and User B share the exact same Node.js server process, their capabilities never bleed into each other due to strict Context isolation.

---

## 5. The Marketplace Distribution Flow

The ultimate vision is a global marketplace where users can build, publish, and monetize apps with zero developer intervention and zero server downtime.

1. **Creation (Hot-Swapping):** User A asks their AI to build a Fitness App. The AI compiles a self-contained JavaScript bundle and saves it to User A's private folder. Cordis dynamically hot-loads this bundle into User A's Tenant Context. The UI updates instantly.
2. **Publishing (The Database):** User A decides to sell the app. The AI packages the JavaScript bundle, attaches metadata (price, description), and uploads it to the global **Marketplace Database** (e.g., AWS S3 + Postgres). The core GitHub repo is entirely untouched.
3. **Installation (Instant Shapeshifting):** User B browses the Marketplace and buys the Fitness App. User B's agent downloads the bundle from the database and updates User B's personal configuration file. The UI dynamically fetches the code over the network (via Module Federation) and the app instantly appears in User B's "My Installed Apps" launcher.

---

## 6. Security & Isolation

Running arbitrary JavaScript generated by thousands of users on a single server is a massive security risk. To protect the ecosystem, Saddle must employ strict sandboxing:

* **V8 Isolates / WebAssembly:** User-generated plugins do not run directly in the main Node.js thread. They execute inside a secure sandbox.
* **RPC Bridge (`TypertRemoteService`):** The sandboxed plugin can only communicate with the main Cordis engine through a strictly typed Remote Procedure Call (RPC) interface. It is physically blocked from accessing the file system, network, or other tenants' data unless explicitly granted permission by the Sandbox Policy.

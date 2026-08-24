# Saddle: Future-Proof Billing Engine & HCI Architecture

## The HCI Paradigm Shift
Traditional Human-Computer Interaction (HCI) is synchronous and manual: the human clicks a button, the computer performs a task, and the human waits. Traditional SaaS billing models (flat monthly fees) are built for this manual constraint.

**Saddle represents an agentic HCI paradigm shift.** You do not pull a cart; you ride a horse. Users delegate high-level intents to background agents that operate autonomously, asynchronously, and unpredictably.
A flat subscription model in an agentic OS is a death sentence for margins. If human input is no longer the bottleneck, compute consumption will skyrocket.

Therefore, the billing engine cannot just be a Stripe integration. It must be a **transactional middleware** embedded directly into the OS's event loop.

---

## The Cordis Billing Middleware
Saddle's billing engine acts as a central nervous system for cost routing. Because every capability in Saddle is a dynamically loaded Cordis plugin, the Billing Middleware wraps the plugin lifecycle.

### 1. Pre-Flight Compute Reservation
Before an agent or plugin is allowed to execute, the middleware performs a "Pre-Flight Check":
1. **Estimate Cost:** The requested plugin declares its compute footprint (e.g., "I need the Pro LLM and 10 minutes of web-scraping CPU").
2. **Ledger Check (Postgres):** The middleware queries the user's "Saddle Credit" wallet in Postgres.
3. **Reservation (Redis):** If funds exist, the middleware uses Redis to temporarily lock/reserve those credits.
4. **Execution or Rejection:** If the user lacks funds, execution is blocked instantly at the API gateway, returning a clean UI prompt to top-up via Stripe.

### 2. Post-Flight Settlement
Agentic tasks are unpredictable. An agent might finish in 10 seconds or get stuck in a loop for 2 hours.
* When a task completes, the exact telemetry (tokens burned, CPU time used, database writes) is calculated.
* The Redis reservation is cleared.
* The final, exact cost is permanently deducted from the Postgres ledger.

---

## Infrastructure Requirements (The Trifecta)

To build a billing engine capable of surviving autonomous HCI, the infrastructure must be decoupled into three distinct layers:

### Layer 1: The Source of Truth (Postgres)
* **What it does:** Relational ACID-compliant database.
* **Why we need it:** To store user accounts, Stripe customer IDs, Plugin Marketplace ownership licenses, and the exact ledger of "Saddle Credits". You cannot use SQLite for this in a multi-user environment; concurrent transactions would lock the database and corrupt balances.

### Layer 2: The Fast State & Governor (Redis)
* **What it does:** In-memory key-value store.
* **Why we need it:**
  1. **Rate Limiting:** Stopping bad actors (or runaway BYOK users) from flooding the server with 1,000 background jobs.
  2. **Job Queues:** Managing the execution queues for the UI Dock.
  3. **Credit Reservations:** Locking user balances in milliseconds before execution starts.

### Layer 3: The Payment Gateway (Stripe)
* **What it does:** Fiat-to-Credit conversion.
* **Why we need it:** Stripe handles credit cards, fraud, and payouts. When a user buys 1,000 Saddle Credits for $10, Stripe processes the fiat, fires a webhook to our server, and our server mints 1,000 credits into the Postgres ledger.

---

## The Marketplace Economics (Platform Taxation)
Because the Billing Middleware controls the execution of all plugins, it also enforces licensing.
If a user tries to execute a premium "Financial Analyst Plugin" built by a third-party developer:
1. The middleware checks Postgres to see if the user owns the license.
2. If they execute it, the cost is split at settlement: **70% of the credits go to the developer's ledger, and 30% are burned/kept as the Saddle Platform Tax.**

This engine ensures that as the HCI paradigm shifts from humans doing work to agents doing work, your revenue scales proportionally with the compute they consume.

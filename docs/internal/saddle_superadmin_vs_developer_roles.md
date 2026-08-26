# Saddle Role Reference: Superadmin vs. Developer

> Two distinct seats of power in the Saddle empire — one shapes the platform in code, one governs it in production.

---

## The Core Mental Model

| Dimension | The Developer (You) | The Superadmin (Also You, Initially) |
| :--- | :--- | :--- |
| **Primary Workspace** | Local machine, GitHub, VPS terminal | The live Saddle web app and an admin dashboard |
| **Primary Tool** | Code editor, CLI (`saddle web`), `git`, `docker` | A browser-based admin panel, SQL access, API controls |
| **What They Control** | The architecture, the behavior, the binary | The users, the data, the runtime parameters |
| **When They Act** | Before something is deployed | After it is deployed and live |
| **Risk Zone** | Breaking the application for everyone | Mismanaging user data or billing |
| **Analogy** | The architect who designed the building | The property manager who runs it day-to-day |

---

## Part 1: The Developer Role (You Building Saddle)

> Already documented in detail at [saddle_ui_extensibility_vs_core_development.md](file:///Users/brightonm1/.gemini/antigravity/brain/97db5a70-1029-431f-b253-1745424bc8ff/saddle_ui_extensibility_vs_core_development.md). This section summarises and expands it.

### 1A. What the Developer Does on Local Saddle Lite

This is your **R&D environment** — zero risk to live users or production data.

| Action | Tool / Location |
| :--- | :--- |
| Write and test new features | `packages/client/*`, `apps/web/*` |
| Run the app locally | `pnpm run saddle web` |
| Test agent plugin behavior | `packages/bundle/*` |
| Modify the UI slot system | `packages/client/ui-slots/src/*` |
| Adjust branding, themes, CSS tokens | `packages/client/ui-theme/src/styles/*` |
| Run builds and check for errors | `pnpm run build` |
| Test against a local SQLite database | Automatic via the default profile |
| Test experimental Docker changes | `docker compose up --build` locally |

**Rule of Thumb:** If it touches `.ts`, `.tsx`, `.css`, or `package.json` files in the monorepo, it is a Developer action. These changes must be tested locally before being pushed.

---

### 1B. What the Developer Does on GitHub

GitHub is the **source of truth and deployment trigger**.

| Action | Command |
| :--- | :--- |
| Commit all changes | `git add . && git commit -m "..."` |
| Push to live VPS | `git push theoutcomedev master --no-verify` |
| Review change history | `git log --oneline` |
| Roll back a bad deploy | `git revert <commit-hash>` then push again |
| Branch for risky experiments | `git checkout -b sprint-2-auth` |

> [!CAUTION]
> The moment you push to the `theoutcomedev` remote, our Python deploy script picks it up and rebuilds the live container. A broken push goes live on the VPS. Always run `pnpm run build` locally first to verify zero errors before pushing.

---

### 1C. What the Developer Does on the VPS (Hetzner)

The VPS is where you go when something cannot be fixed by a code push alone — direct server surgery.

| Action | Command on VPS |
| :--- | :--- |
| SSH into the server | `ssh root@91.99.165.95` |
| View live container logs | `docker logs saddle-app -f` |
| Restart the app container | `docker compose restart saddle-app` |
| Force full rebuild | `docker compose up --build -d` |
| Wipe and reset ALL data (danger!) | `docker compose down -v` |
| Inspect database directly | `docker exec -it saddle-postgres psql -U saddle -d saddle` |
| Inspect Redis directly | `docker exec -it saddle-redis redis-cli` |
| Check disk usage | `df -h` / `docker system df` |
| Prune unused Docker images | `docker system prune -af` |

> [!WARNING]
> `docker compose down -v` permanently destroys all Docker volumes including the PostgreSQL database and all chat history. Only use it when you explicitly want a clean slate.

**Rule of Thumb:** VPS terminal access = Developer hat on. Regular day-to-day governance of the live product should NOT require SSHing in.

---

## Part 2: The Superadmin Role (You Governing Saddle)

### 2A. Current State (Pre-Sprint 2)

Right now the Superadmin role does not formally exist inside the app — the app runs in single-operator mode. You informally perform Superadmin duties via:

- Directly querying the database from the VPS terminal via `psql`
- Watching Docker logs for errors
- Manually monitoring server resource usage
- Hand-editing environment variables in `docker-compose.yml`

This is unsustainable at scale. Sprint 2 formalizes this into a proper governed role with a dedicated Admin Dashboard inside the Saddle web app itself.

---

### 2B. Future State (Post-Sprint 2): What the Superadmin Can Do

The Superadmin has `role = 'superadmin'` with PostgreSQL `BYPASSRLS` — they can see and act on all tenant data globally. But they operate entirely within a browser-based interface, with no code access required.

#### 👥 User Management
| Action | How |
| :--- | :--- |
| View all registered users and their plan tier | Admin Dashboard → Users table |
| Suspend / ban a user account | Toggle `users.is_active = false` |
| Reset a user's password or email | Admin Dashboard → Edit User |
| Promote a user to "Operator" sub-admin role | Update `users.role = 'operator'` |
| Inspect a specific user's session history | Query with BYPASSRLS privilege |
| Delete a user and wipe their data (GDPR) | Cascading delete across all RLS-scoped tables |

#### 💳 Billing & Monetization Management
| Action | How |
| :--- | :--- |
| View Monthly Recurring Revenue (MRR) live | Admin Dashboard → Billing tab |
| Issue refunds or credit adjustments | Stripe Dashboard + update `billing_credits` |
| Upgrade / downgrade a user's plan manually | Update `subscriptions.plan_tier` |
| Override BYOK concurrency limit for a VIP user | Update `user_limits.max_concurrent_jobs` |
| View which users are on free vs paid tiers | Users table → `plan_tier` column filter |

#### 🏪 Plugin Marketplace Governance
| Action | How |
| :--- | :--- |
| Approve or reject a submitted plugin | Admin Dashboard → Marketplace queue |
| Remove a malicious or policy-violating plugin | Set `plugins.status = 'revoked'` |
| Feature a plugin in the curated marketplace | Set `plugins.is_featured = true` |
| Adjust the creator revenue split | Update global `marketplace_config.creator_split` |

#### 🔐 Security & Trust Controls
| Action | How |
| :--- | :--- |
| View failed login attempts and suspicious IPs | Admin Dashboard → Security Logs |
| Temporarily lock down new registrations | Toggle `platform_config.registration_open` |
| Broadcast an emergency system notice to all users | Admin Dashboard → Broadcast Message |
| Revoke all active sessions globally (emergency) | Flush JWT signing secret (requires Developer deploy) |

#### 📊 Platform Telemetry & Health
| Action | How |
| :--- | :--- |
| View global active subagent count | Admin Dashboard → Live System tab |
| Monitor total token burn across all users | Aggregated from `usage_logs` table |
| View server memory, CPU, and disk usage | Admin Dashboard → Infrastructure panel |
| Receive alerts when VPS disk > 80% | Automated alerting (Sprint 3) |

---

## Part 3: Hard Walls — What the Superadmin CANNOT Do

Even with `BYPASSRLS`, these actions require the Developer to put on their code editor:

| Action | Why It Requires the Developer |
| :--- | :--- |
| Change how API key encryption works | Requires modifying `packages/server/auth/vault.ts` |
| Add a new UI slot outlet | Requires modifying `packages/client/ui-slots/src/` |
| Update the Saddle version or release a new build | Requires a git commit + push + Docker rebuild |
| Modify the RLS policy rules themselves | Requires a PostgreSQL migration script |
| Change the billing webhook logic | Requires editing `packages/server/billing/stripe.ts` |
| Access the GitHub repository | Only the Developer has git access |
| Change Docker container configuration | Requires editing `docker-compose.yml` + VPS SSH |
| Add a new environment variable | Requires editing `docker-compose.yml` + redeploy |

> [!IMPORTANT]
> **The Key Insight:** The Superadmin operates entirely within the rules the Developer has written. The Developer writes the laws; the Superadmin enforces them. As Saddle scales, the Superadmin hat can safely be delegated to a Trust & Safety team or Operations Manager — they never need GitHub access or a code editor.

---

## Part 4: Decision Matrix — Which Hat Do You Wear?

| Situation | Developer Hat 🧑‍💻 | Superadmin Hat 👑 |
| :--- | :---: | :---: |
| A user reports a UI bug | ✅ Fix in codebase, push, redeploy | ❌ |
| A user wants a refund | ❌ | ✅ Issue via Stripe + Admin Dashboard |
| The app crashes and containers are down | ✅ SSH → `docker compose up -d` | ❌ |
| A plugin violates the marketplace policy | ❌ | ✅ Revoke in Admin Dashboard |
| Branding colours need changing | ✅ Edit CSS tokens, push | ❌ |
| A new user needs their plan upgraded | ❌ | ✅ Edit in Admin Dashboard |
| Adding a new payment tier | ✅ Code the billing logic, then push | ❌ |
| Banning a spam account | ❌ | ✅ Suspend in Admin Dashboard |
| VPS disk is running full | ✅ `docker system prune` via SSH | ❌ |
| Approving a marketplace plugin | ❌ | ✅ Admin Dashboard → Marketplace queue |
| Changing the Postgres database schema | ✅ Write and run a migration script | ❌ |
| Broadcasting a platform maintenance notice | ❌ | ✅ Admin Dashboard → Broadcast |

---

## Summary: The Two Seats of Power

```
Developer Role (Code Layer)          Superadmin Role (Governance Layer)
──────────────────────────────       ─────────────────────────────────────
Local Saddle Lite (Macbook)          Saddle Cloud Admin Dashboard (Browser)
GitHub Repository                    Live User Database (via UI)
VPS Terminal (SSH)                   Stripe Billing Dashboard
docker-compose.yml                   Marketplace Approval Queue
TypeScript / CSS Source Files        Platform Config Toggles
pnpm build / pnpm run saddle         Broadcast Notices / Emergency Controls
```

Both roles are currently held by you as Founder. As the company scales, the Superadmin role can be safely delegated to an Operations Manager or Trust & Safety team without ever giving them access to the codebase or the GitHub repository.

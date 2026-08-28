# Saddle Configuration Engine & Portable State Architecture

**Status:** Production Standard Specification
**Classification:** Core Configuration, State Portability & SaaS Migration
**Target Systems:** Saddle OS Settings Subsystem, Cordis Plugins, Web Client

---

## 1. Executive Summary

Saddle uses a **Declarative Configuration State Model** centered around a human-readable YAML specification (`~/.dsh/config.yaml`). Every preference, AI provider key, agent preset, UI theme, security sandbox mode, and installed plugin managed through the visual UI is persisted into this single file.

This document outlines the purpose, lifecycle, browser download fallback mechanism, and multi-tenant scaling trajectory of Saddle's configuration engine.

---

## 2. Anatomy of `config.yaml`

A complete Saddle installation state is captured in structured namespaces:

```yaml
# 1. AI Model Providers & Credentials
llm-deepseek:
  apiKey: "sk-your-deepseek-api-key"
  model: "deepseek-chat"
  temperature: 0.7
  maxTokens: 8192

# 2. Agent Modes & Personas
agent-presets:
  activePreset: "creator"
  customInstructions: "You are Saddle, an autonomous engineering entity."

# 3. Installed Plugins & External Tools
tool-web-search:
  provider: "tavily"
  apiKey: "tvly-your-search-api-key"

# 4. Global UI & Security Defaults
settings:
  appearance: "friesian"
  language: "en"
  defaultPermission: "danger-full-access"
  enterBehavior: "queue"
```

---

## 3. Four Core Real-World Use Cases

### A. 1-Click Backup & Peace of Mind
Before experimenting with complex plugins, fine-tuning custom presets, or modifying API endpoints, users can export their entire configuration in one click. If settings are ever corrupted or accidentally cleared, restoring the backup takes less than 3 seconds.

### B. Cloud-to-Local Environment Synchronization
Developers frequently alternate between running Saddle on a remote high-memory cloud VPS (e.g. Hetzner) and running Saddle locally on a MacBook or offline laptop.
* Users download `config.yaml` from the cloud web UI.
* Placing the file at `~/.dsh/config.yaml` on their local machine instantly replicates all models, keys, presets, and themes without manual re-entry.

### C. Power-User Bulk Editing (Zero-Friction DevOps)
Instead of clicking through multiple UI menus, power users can open `config.yaml` in VS Code or Neovim to bulk paste custom LLM base URLs (e.g. self-hosted Ollama, vLLM, OpenRouter endpoints) and batch configure complex plugin options.

### D. Team Onboarding & Standardized Agent Environments (Infrastructure-as-Code)
Engineering leaders can curate an optimal Saddle environment (pre-configured company coding rules, approved MCP servers, and persona guidelines) and share the `config.yaml` template with new hires for instant day-one onboarding.

---

## 4. Web vs Desktop Native Opener Lifecycle

```
┌────────────────────────────────────────────────────────┐
│ User clicks: "Open configuration file" in Settings     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ (RPC: settings.openDocument)
┌────────────────────────────────────────────────────────┐
│ Backend checks: canOpenNativePath()                    │
└──────────────┬───────────────────────────┬─────────────┘
               │ (Desktop OS: Mac/Win/GUI) │ (Headless Cloud / VPS / Mobile)
               ▼                           ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ Spawns native editor:       │  │ Reads ~/.dsh/config.yaml    │
│ (VS Code, TextEdit, etc.)   │  │ Returns content & filename  │
└─────────────────────────────┘  └──────────────┬──────────────┘
                                                │
                                                ▼ (Browser Client)
                                 ┌─────────────────────────────┐
                                 │ Generates Blob & triggers   │
                                 │ Instant Browser Download!   │
                                 └─────────────────────────────┘
```

1. **Desktop Native Mode:** When running on macOS, Windows, or desktop Linux with an active window manager (`DISPLAY`), clicking the action opens the host system's default text editor.
2. **Headless Cloud & Web Mode:** When running in headless environments (Docker container, Hetzner VPS, remote web browser, smartphone), Saddle automatically detects the absence of a GUI display server. Instead of failing with an OS error, the backend delivers the raw file payload and the client triggers an instant browser download of `config.yaml`.

---

## 5. Multi-Tenant SaaS Evolution

Because Saddle is built on the **Cordis micro-kernel architecture**, the settings subsystem is itself an isolated plugin:

* **Single-Player (Phase 1):** Mounts `@deepseek-ai/dsh-settings-file`, reading/writing `~/.dsh/config.yaml`.
* **Multi-Tenant SaaS (Phase 2+):** Replaces the file plugin with `@deepseek-ai/dsh-settings-postgres`. Each tenant's configuration is isolated in their private database row (`tenants.config_json`).
* When Tenant Alex clicks *"Open configuration file"*, Saddle serializes Alex's specific configuration row and downloads `saddle-config.yaml` to Alex's browser. Sarah's configuration is completely isolated and inaccessible.

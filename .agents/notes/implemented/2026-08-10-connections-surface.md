# Connections surface: the authorization seam, the wire domain, and the settings page

**Date:** 2026-08-10
**Status:** implemented
**Related:** credentials/authorization, credentials/connections, mcp/mcp-client, host/apiproxy, client/runtime, client/ui-settings-connections

## What shipped

The connection story was only half-present: the authorization seam and the
api-key flow existed, and the model's request_credential tool could register a
flow on demand, but nothing mounted the seam in the base composition, the web
app had no surface, and device/OAuth grants had no implementation. This change
makes connections live end to end.

- **Mounting.** The base composition now mounts the authorization service, and
  the standard agent preset mounts the request_credential tool, so the model
  can offer to connect a service from chat in the web app.
- **Flows.** dsh-connections gains RFC 8628 device authorization and
  authorization-code-with-PKCE helpers (loopback or manual-code redirect),
  both committing grant records; a shipped api-key catalog (supabase, github,
  openai, anthropic, resend) registers as a host row.
- **Wire domain.** A connections.* RPC domain (list/connect/poll/answer/
  cancel/disconnect) over ctx.authorization walks one attempt at a time: the
  host holds the attempt, the client polls its walkable state and feeds
  answers. Two new error codes: connection-not-found, connection-attempt-invalid.
- **Surface.** A Connections settings section lists flows with credential
  state, walks connect attempts (notice / masked prompt / settled), disconnects
  with an inline confirm, and shows live MCP server status.
- **MCP.** mcp-client publishes a coarse lifecycle status (connecting/ready/
  failed/closed) as a typed event plus a per-root registry; the connections
  list surfaces it. The web composition carries two disabled example rows.

## Decisions

- The connect walk is poll-based (700 ms) rather than pushed: the host owns
  the attempt and the surface is a settings page, not a live dashboard. The
  attempt registry lives per createApiProxy instance; attempts settle to a
  terminal state and the entry is retained (bounded by user actions).
- Cancel exists as its own RPC so closing a dialog can withdraw an attempt
  whose flow would otherwise wait on a prompt forever.
- MCP status is deliberately coarse: reconnect-loop churn inside a live
  supervisor is not surfaced. The event contract is declared identically in
  mcp-client and apiproxy (no package dependency edge).
- Token records use the grant record kind (opaque JSON payload), so
  credentials-local needs no new record kind.

## Deferred

- A real-composition web e2e for the Connections page (the GUI test tiers were
  not extended in this change); the device/oauth flows have unit coverage
  against a stubbed token endpoint, and the dialog walk is exercised by the
  runtime test only.
- Live refresh: the section refetches on mount and after mutations only.

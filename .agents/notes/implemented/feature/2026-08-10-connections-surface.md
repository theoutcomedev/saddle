# Agent Note: Connections surface: the authorization seam, the wire domain, and the settings page

Status: implemented

## Problem

The connection story was only half-present: the authorization seam and the api-key flow existed, and the model's `request_credential` tool could register a flow on demand, but nothing mounted the seam in the base composition, the web app had no surface, and device/OAuth grants had no implementation.

## Decision

- **Mounting.** The base composition now mounts the authorization service, and the standard agent preset mounts the `request_credential` tool, so the model can offer to connect a service from chat in the web app.
- **Flows.** `dsh-connections` gains RFC 8628 device authorization and authorization-code-with-PKCE helpers (loopback or manual-code redirect), both committing grant records; a shipped api-key catalog (supabase, github, openai, anthropic, resend) registers as a host row.
- **Wire domain.** A `connections.*` RPC domain (list/connect/poll/answer/cancel/disconnect) over `ctx.authorization` walks one attempt at a time: the host holds the attempt, the client polls its walkable state and feeds answers. Two error codes were added: `connection-not-found`, `connection-attempt-invalid`.
- **Surface.** A Connections settings section lists flows with credential state, walks connect attempts (notice / masked prompt / settled), disconnects with an inline confirm, and shows live MCP server status.
- **MCP.** `mcp-client` publishes a coarse lifecycle status (connecting/ready/failed/closed) as a typed event plus a per-root registry; the connections list surfaces it. The web composition carries two disabled example rows.

## Alternatives considered

- **Pushing connect-attempt state instead of polling it.** Not taken: the host owns the attempt and the surface is a settings page rather than a live dashboard, so the client polls walkable state every 700 ms.
- **Letting a closed dialog leave its attempt running until it settles.** Not taken: cancel exists as its own RPC so closing a dialog can withdraw an attempt whose flow would otherwise wait on a prompt forever.
- **Surfacing reconnect-loop churn inside a live MCP supervisor.** Not taken: MCP status is deliberately coarse, and the event is declared identically in `mcp-client` and `apiproxy` with no package dependency edge between them.
- **Adding a new record kind for token records.** Not taken: token records use the grant record kind (opaque JSON payload), so `credentials-local` needs no new record kind.

## Consequences

- Connecting a service is available in the web app without per-deployment wiring: the seam is mounted in the base composition and the tool rides the standard agent preset.
- The attempt registry lives per `createApiProxy` instance and retains settled entries bounded by user actions, so closing a dialog cannot leave a prompt waiting forever.
- The connections page refetches on mount and after mutations only — live refresh is not part of this change.
- MCP status stays coarse by design: a reconnect loop inside a live supervisor is invisible to the list until the lifecycle state itself moves.

## Deferred

- A real-composition web e2e for the Connections page (the GUI test tiers were not extended in this change); the device/oauth flows have unit coverage against a stubbed token endpoint, and the dialog walk is exercised by the runtime test only.
- Live refresh: the section refetches on mount and after mutations only.

# @deepseek-ai/dsh-client-ui-settings-connections

The Connections settings section: every registered service flow (api-key,
device, oauth) with its credential state, the connect dialog that walks one
authorization attempt against the host, and the live MCP server status card.

## Model Experience

The section itself is not model-visible. It rides the same authorization seam
the model's request_credential tool uses, so a service connected here is
immediately available to the model through that tool's store, and a service
the model connects in chat appears here as configured.

## Behavior

- Lists flows from the connections wire domain (host authorization registry +
  credential records). A configured flow shows Connected; an unconfigured one
  offers Connect.
- Connect walks the host attempt: notices (open a page, enter a code), prompts
  (masked for secrets), and the settled outcome, with Cancel withdrawing the
  attempt.
- Disconnect requires an inline confirm and deletes the stored credential.
- The MCP card lists mounted mcp-client servers with their lifecycle state.

## Known Limitations and Deferred Work

- The section is a settings page: it refetches on mount and after mutations and
  does not live-subscribe to flow or status changes.
- MCP status is the coarse lifecycle state mcp-client publishes (connecting /
  ready / failed / closed); reconnect-loop churn inside a live supervisor is
  not surfaced.

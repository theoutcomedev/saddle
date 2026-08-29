# dsh-connections

English | [中文](README.zh.md)

Service connections for the DeepSeek Harness: a generic `api-key` authorization
flow plus the model-facing `request_credential` tool that wires an external
service in chat.

## What it does

- `registerApiKeyConnection(ctx, { id, label, docsUrl })` registers one
  authorization flow for a service. The flow prompts for the key through the
  [authorization](../authorization/README.md) seam's masked `secret` prompt
  (kept out of logs and screenshots) and commits it as an `api-key` record in
  the credential store.
- `request_credential` (the tool) registers that flow on demand and runs it, so
  the model can offer "connect Supabase?" in chat and the human answers a masked
  prompt. The key lands in the encrypted credential store; the tool never echoes
  it back.

## Security

Keys enter through a masked input and are stored encrypted at rest by the local
credential provider (envelope encryption). The tool returns only the attempt's
status, never the value. See [credentials-local](../credentials-local/README.md)
for the at-rest guarantee.

## Services

| Service | Usage |
|---|---|
| `ctx.authorization` | register and run the flow |
| `ctx.credentials` | commit the api-key record |
| `ctx.tools` | register `request_credential` |
| `ctx.userQuestions` | surface the masked prompt |

## Known limitations

- Only the `api-key` method ships today; `device-flow` and `oauth-app` are the
  authorization seam's other methods and would add their own flows.
- The sidebar "Connections" page that lists flows and connected records is a
  separate client package, not part of this host package.

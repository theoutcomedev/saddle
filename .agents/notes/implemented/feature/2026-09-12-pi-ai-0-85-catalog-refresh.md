# Agent Note: The pi-ai 0.85.1 catalog refresh, and a caller abort that outranks pi-ai's classification

Status: implemented

English | [中文](2026-09-12-pi-ai-0-85-catalog-refresh.zh.md)

## Problem

The installed `@earendil-works/pi-ai` catalog is the whole model list a catalog route serves: `discoverModels` answers such a route from the installed entries with no network call, and `catalogModels` materializes the same entries behind every request. A model released after the pinned version therefore cannot appear in a selector or resolve by id, no matter what the provider's own listing says.

Two releases later (0.82.1 → 0.85.1) the catalog carries the models that prompted this: `claude-fable-5-1` (Claude Fable 5.1) and `gpt-6-astra` (GPT-6 Astra), plus a revised deepseek entry and a dropped one. The same release changed two things the harness depended on: a request cancelled before it reached the provider arrives as an ordinary `error` event whose message is the abort reason instead of `stopReason: "aborted"`, and the stop-reason union gained `pending` and `deferred`.

## Decision

1. **Pin `^0.85.1`** in `dsh-llm-pi-ai` and carry the version into the `minimumReleaseAgeExclude` entry, whose comment already states that fresh pi-ai releases are the point of the pin.
2. **The caller's own signal decides an abort.** `toStreamChunks` takes the caller's signal and rewrites a terminal event mapped to an error as `aborted` when that signal is aborted. It is the same rule the adapter already applies to an error it catches rather than receives, so the two delivery styles now agree.
3. **The new stop reasons map to errors with their own codes.** `deferred` is only reachable when the caller asks for a durable handle (`SimpleStreamOptions.deferred`), which this adapter never does, and `pending` is a stream that ended mid-turn; both would silently truncate a turn if mapped to a stop.
4. **The nine compat fields 0.85.1 added start withheld**, each named in its protocol's drift gate: offering one means documenting a profile field and the wire effect it buys, and no current deployment varies its request with any of them. The two new *values* the harness can already reach — the `baseten` thinking format and the `thinking.budget` chat-template placeholder — join their gates, so a profile may name them.
5. **Catalog expectations in the llm suites follow the installed catalog**: the deepseek output-cap spelling (`max_tokens`), the added `low` level, and the mixed-protocol compat specs, which now discover a route shipping both OpenAI protocols instead of naming `xai`.

## Alternatives considered

- **Stay pinned and hand-declare the two models.** Rejected: it serves two models instead of the catalog, and a hand-entered model is text-only until its `input` is declared and carries no catalog capacities.
- **Offer the nine new compat fields in the same change.** Rejected for now: no consumer needs them, and each offered field is a documented profile field, a schema entry, and a wire effect to maintain ([package rule](../../../../packages/AGENTS.md)).
- **Treat a `deferred` stop as a normal stop.** Rejected: the response is resumable, and reporting it as finished discards the rest of the turn silently.
- **Keep the pre-abort tests green by relaxing them.** Rejected: an aborted request reported as a provider error is a user-visible misreport, not a test expectation to move.

## Consequences

- The Models page offers Fable 5.1 and GPT-6 Astra, and both resolve by id; `claude-opus-4-1` and its dated variant are gone from the catalog, so a route or default naming one must move to another model.
- DeepSeek's pi-ai route now sends `max_tokens` instead of `max_completion_tokens` and reports a `low` level, both read from the installed entry rather than configured.
- A pre-aborted request finishes as `aborted` again; mid-stream aborts were never affected.
- The nine withheld capabilities stay unavailable to configuration until someone offers them, and the gates make that state visible at the next upgrade.

## Files

- `packages/llm/llm-pi-ai/package.json`, `pnpm-workspace.yaml`: the pin and its release-age exclusion.
- `packages/llm/llm-pi-ai/src/stream.ts`: the caller-abort rule and the `deferred`/`pending` reasons; `src/adapter.ts` passes the signal.
- `packages/llm/llm-pi-ai/src/catalog.ts`: the two new nameable values and the nine withheld fields.
- Tests: `tests/convert.spec.ts`, `tests/adapter.spec.ts`, `tests/catalog.spec.ts`.

## Deferred

- **The withheld capabilities** — `supportsFinishReason`, `chatTemplateArgs`, `thinkingTokenBudgetField`, `supportsThinkingTokenBudget`, `vllmPriority`, `supportsAdditionalTools`, `supportsMaxOutputTokens`, `supportsMidConvoEffort`, `allowedFallbackModels`. The reasoning-token budget pair is the most likely first candidate: the adapter already offers `thinkingBudgets`, and these fields are how token-based endpoints cap reasoning separately from the answer.
- **Six pre-existing llm-suite failures** in this checkout (two llm-deepseek catalog expectations, one dormant-mount provider list, and two composition timeouts) fail identically on the previous pin, so they are not this change's.

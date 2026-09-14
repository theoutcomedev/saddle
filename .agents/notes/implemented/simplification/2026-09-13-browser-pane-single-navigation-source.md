# Agent Note: The Workbench browser pane keeps one navigation source

Status: implemented

English | [中文](2026-09-13-browser-pane-single-navigation-source.zh.md)

## Problem

Every `browser_*` tool call made its conversation row dispatch `workbench:open-browser` with a Steel debug URL composed in the browser from the page hostname. The dock therefore replaced whatever the reader had open with Steel's viewer, whose own UI is a fixed-size surface inside a resizable pane. `browser-pane.tsx` then preferred that stream endpoint over its typed address, and submitting a new address re-broadcast the endpoint it still held, so the typed page never became the framed page. The Steel container also published a Traefik router on `steel.<ip>.sslip.io`, and that API authenticates nothing unless `STEEL_API_KEY` is set: an unauthenticated caller could create and drive browser sessions on the deployment's own network. No client code read the `viewerUrl` the browser tools already return, so the payload existed only to be printed at the reader.

## Decision

The tool row renders its call and dispatches nothing; opening a link stays the reader's gesture through `workbench:open-browser`, which now carries a URL only. The browser pane's address bar is its single navigation source: the owner URL seeds it, tabs hold URLs alone, and the submit handler navigates instead of re-broadcasting. The Steel viewer, its takeover control, and the stream fields on `WorkbenchPaneParams` are gone.

Steel keeps running for the agent's own browsing and keeps no Traefik router, so it answers only as `saddle-steel:3000` on `saddle-network`. The browser tools report a viewer URL only when the deployment sets `STEEL_PUBLIC_VIEWER_URL`; otherwise they report the empty string, and the model is never handed a URL that does not resolve.

## Alternatives considered

**Keep the takeover control and default it to the page.** The control only means something while a stream endpoint exists, and the endpoint was the defect: it replaced the page the reader asked for and made the pane's width irrelevant to what it displayed. Keeping the control would have kept the endpoint, the re-broadcast, and the public router.

**Proxy Steel's viewer through an authenticated Saddle route.** This is the shape a live view should eventually take, but it is a new host surface with its own session ownership, authorization, and frame policy, and nothing in the pane needed it once the auto-open was gone. Removing the bridge now leaves the decision open rather than shipping a second unauthenticated one.

**Keep the public Steel router and set an API key.** The key would have to reach the browser to make the viewer usable, which puts a network-wide credential in client code, and the viewer is unusable at pane width anyway.

**Leave the unused stream plumbing in place.** Dead parameters survive review by looking supported; a param no producer sets is a promise the pane cannot keep.

## Consequences

An agent browsing session is no longer visible on screen while it runs, and the model receives no viewer URL, so a person cannot watch or take over that session from the GUI. In exchange, the dock keeps showing what the reader opened, the pane honours its own address bar, the deployment exposes no unauthenticated browser-automation API, and the removed fields, copy, and styles no longer claim a capability that was not viable at pane size. Reintroducing a live view means an authenticated, correctly sized surface, not the Steel debug page in an iframe.

## Related

[browser-pane.client.spec.tsx](../../../../packages/client/ui-workbench/tests/browser-pane.client.spec.tsx) pins the address bar as the single navigation source, and [tool-row.client.spec.tsx](../../../../packages/client/ui-tool/tests/tool-row.client.spec.tsx) pins that a `browser_navigate` row dispatches nothing.

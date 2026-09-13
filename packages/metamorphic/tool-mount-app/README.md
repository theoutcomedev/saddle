# @deepseek-ai/dsh-tool-mount-app

English | [中文](README.zh.md)

Model-facing `mount_app` tool. The agent passes a title and a map of virtual files; the tool
saves them under `<session cwd>/.saddle/apps/<slug>/` and returns them as
`presentationMeta`, which the client renders as a live app inside a sandboxed iframe: an
inline card in the conversation, and a docked pane in the Workbench.

The canvas the client builds is deliberately closed — React 18 with its hooks, lucide icons,
and Tailwind, compiled from one entry module with no package resolution (see
[the runtime internals](../../../.agents/skills/saddle-apps/references/runtime-internals.md)).
The tool schema names exactly that surface: an entry of `/App.tsx`, or a self-contained
`/index.html` that the canvas returns as the document itself. There is no `dependencies`
and no `template` field, because the canvas has neither.

Disk persistence is best effort: a session without a working cwd still mounts, and the returned
`savedDir` is absent.

## Model Experience

### Metamorphic apps

#### What the model sees

One system-prompt section (`saddle:metamorphic-apps`, order 195) stating when to reach for
`mount_app` and what the canvas serves: React 18, its hooks, lucide icons and Tailwind tokens,
one entry file, no package resolution, native SVG for charts, and `/index.html` for anything
the React path cannot express. The tool description repeats the same limits, and the schema
carries `title`, `description`, `target`, `entryFile`, and `files`.

#### Token effect

Fixed schema and prompt cost on every request. A call submits the app source as arguments, so a
mounted app is billed as its own source; the result is one confirmation line plus the whole file
map echoed back as presentation metadata.

#### KV Cache effect

The prompt section and tool schema are stable, so they cache with the rest of the request prefix.
Mounting does not rewrite earlier turns: tool arguments and results are appended like any other
call. The one exception is a mounted app whose files are large — that growth sits at the tail of
the conversation and invalidates the prefix from that point onward.

## Known Limitations and Deferred Work

- **No module graph.** Only one entry module executes; extra `files` keys are saved and listed in
  the app's Code view but cannot be imported, and any import the canvas does not serve is refused
  with a diagnostic rather than resolved. Multi-file apps need the `/index.html` shape.
- **The canvas loads its compiler and framework from public CDNs.** A blocked network, proxy, or
  Content-Security-Policy stops every app from compiling; the canvas reports which asset is
  missing instead of showing a blank frame, but self-hosting those assets is not done yet.
- **No npm packages, deliberately.** Chart libraries, animation packages, and anything else must
  be replaced with native SVG/CSS, or the app must ship as `/index.html` with its own bundled
  document.
- **Mounted cards are snapshots.** Editing the saved files later does not update a card already in
  the conversation; the user re-mounts or opens the app from the Apps surface.

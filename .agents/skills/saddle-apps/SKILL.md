---
name: saddle-apps
description: Build, mount, and ship interactive apps that show up in Saddle's Apps catalog and run in the Workbench pane — self-contained HTML apps that cannot trip the metamorphic compile wrapper, wired with the standard top header, Dock button, and Maximize-in-Workbench control. Use whenever asked to build an app, mount an app, add something to "Apps", make an app work in the Workbench, or fix an app that shows "Compilation Error".
---

# Building Apps for Saddle (Apps catalog + Workbench)

An app in Saddle has three surfaces, and getting one right does not get the others right:

1. **The chat card** — rendered by `metamorphicToolview` (`mount_app`), an inline `<iframe>` whose `srcDoc` is generated from the tool call's files.
2. **The Apps catalog** — the sidebar "Apps" storefront, driven by `APP_CATALOG` in `ui-app-store`.
3. **The Workbench pane** — docked app column, or full screen, hosted by `WorkbenchAppHost` / `renderActiveApp`.

This skill covers the parts that are not obvious: the compiler that rejects React entries, the escape hatch that bypasses it, and the exact wiring that makes an app look and behave like a first-party one.

## Non-negotiables

- Ship **one self-contained `/index.html`** (vanilla JS/CSS, no imports, no CDN). This bypasses the wrapper entirely and cannot fail to compile. See *The escape hatch*.
- Pass **exactly one key** to `mount_app`. Extra keys become real files on disk, and two keys that resolve to the same entry emit the module twice.
- When you add an app to the catalog, wire **all three** paths: catalog entry, docked host, fullscreen host — plus the card icon.
- A docked app must have **Maximize in Workbench** and must **scroll** when the pane is narrow. Both are covered below.
- Verify from the real served bundle and, when possible, in the real GUI. Never claim a UI change works because the build succeeded.

## Why React entries fail: the wrapper

`buildMetamorphicSrcDoc(files, entryFile, title)` (in `@deepseek-ai/dsh-client-ui-app-store/lib/client.js`) builds an iframe document that loads React 18 UMD + Babel, then:

```js
let processedCode = ${JSON.stringify(entryCode)};
// import rewrites:
processedCode = processedCode.replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g, 'const { $1 } = window.__lucideProxy;');
processedCode = processedCode.replace(/import\s+React\s*(?:,\s*\{([^}]+)\})?\s*from\s+['"]react['"];?/g, (m, g1) => g1 ? 'const { ' + g1 + ' } = React;' : '');
processedCode = processedCode.replace(/import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g, 'const { $1 } = React;');
// export rewrites: `export default function App` -> `function App`
const evaluateModule = new Function(
  'React','useState','useEffect','useMemo','useRef','useCallback','LucideIcons',
  processedCode + '; return typeof App !== "undefined" ? App : ...'
);
```

`new Function` parameters share scope with the body. So `import { useEffect } from "react"` becomes `const { useEffect } = React;` **inside a function that already has a `useEffect` parameter**:

```
SyntaxError: Identifier 'useEffect' has already been declared
```

That is the "Compilation Error" users hit. It is not your app's bug; it is any entry file that imports hooks by name. Other members of the family: `Missing initializer in const declaration` (a truncated/oddly-transformed entry), `Cannot use import statement outside a module`.

If you must stay React (do not, unless asked): import **only** the default — `import React from "react"` — and call `React.useState(...)`, `React.useEffect(...)`, etc. The `new Function` scope provides exactly `React, useState, useEffect, useMemo, useRef, useCallback, LucideIcons` — **not** `useReducer`, `useContext`, `useCallback`-adjacent APIs. Icons may be imported from `lucide-react` (rewritten to a proxy).

## The escape hatch (preferred)

The first line of the builder:

```js
function buildMetamorphicSrcDoc(files, entryFile = "/App.tsx", title = "Metamorphic App") {
  if (files["/index.html"] || files["index.html"]) return files["/index.html"] || files["index.html"] || "";
  ...
```

If the app ships an `/index.html`, **that document is returned verbatim**: no regex rewriting, no `new Function`, no Babel pass, no import interception, no compile step. The host still mounts it in the sandboxed iframe exactly as before.

So: write the app as one HTML file. `references/app-shell.html` is a working starting point (dark theme, top header, canvas stage, sliders, error banner, mobile-first CSS).

## Mount hygiene

```jsonc
// mount_app
{ "title": "...", "files": { "/index.html": "<the whole document>" }, "entryFile": "/index.html", "template": "vanilla", "target": "workbench" }
```

- Keys become real files at `/root/<workspace>/.saddle/apps/<slug>/`. A key like `"<//App.tsx"` writes a junk file and directory — never pass placeholder keys.
- The tool result reports **`(N files)`**. That N must equal your key count. `(2 files)` from a one-app payload means you passed a stray key, and the client will emit the entry module twice.
- The card renders from `data.meta` (`presentationMeta`) on the tool result: `{ appId, title, description, target, entryFile, files, dependencies, template, fileCount, savedDir }`. If `files` is absent or truncated there, the card shows text and **no app at all** — verify with `scripts/read-session-log.mjs` when a mount "succeeds" but nothing renders.
- Mount cards embed a snapshot of the files. **Updating the app later does not update old cards** — tell the user to use the Apps entry (or re-mount).

## Making it a first-class app (Apps + Workbench)

Package: `/app/packages/client/ui-app-store/`

### 1. Catalog entry — `src/client/AppStore.tsx`

```tsx
const APP_CATALOG: readonly AppCatalogEntry[] = [
  { id: 'notepad', ... },
  {
    id: 'your-app',
    name: 'Your App',
    category: 'Simulations',            // categories are derived from this field
    icon: 'your-app',                   // sentinel consumed by the card renderer
    tags: ['simulation', 'canvas'],
    description: 'One sentence the storefront shows.',
  },
]
```

### 2. Card icon

```tsx
{app.id === 'notepad'
  ? <IconListPenOutline16 size={22} />
  : app.icon === 'your-app'
    ? <YourIcon size={22} />
    : (app.icon || '📦')}
```

Define a small inline SVG component next to `IconDock`. An emoji works but looks less intentional.

### 3. The host component

One component, two modes, so docked and fullscreen can never drift apart:

```tsx
function YourApp({ mode, onClose, onDock }: { mode: 'docked' | 'fullscreen'; onClose?: () => void; onDock?: () => void }) {
  const isDocked = mode === 'docked'
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isDocked || !isMaximized) return
    document.body.setAttribute('data-app-maximized', 'true')
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMaximized(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.removeAttribute('data-app-maximized')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isDocked, isMaximized])

  useEffect(() => () => { document.body.removeAttribute('data-app-maximized') }, [])

  const frame = (
    <iframe title="Your App" srcDoc={YOUR_APP_HTML} sandbox="allow-scripts allow-modals"
      style={{ flex: 1, width: '100%', minHeight: 0, border: 'none', display: 'block', background: '#05070d' }} />
  )

  if (isDocked) {
    return (
      <div className={`${css.npRootDocked} ${isMaximized ? css.npDockedMaximized : ''}`}>
        <div className={css.npDockedToolbar}>
          <div className={css.npToolbarLeft} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <YourIcon size={15} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Your App</span>
          </div>
          <div className={css.npActions}>
            <button type="button" className={css.iconBtn}
              title={isMaximized ? 'Restore View (Esc)' : 'Maximize in Workbench'}
              aria-label={isMaximized ? 'Restore View' : 'Maximize in Workbench'}
              onClick={() => setIsMaximized(prev => !prev)}>
              {isMaximized ? <IconMinimize size={16} /> : <IconFullscreen size={16} />}
            </button>
            {onDock ? <button type="button" className={css.iconBtn} title="Dock in Workbench" onClick={onDock}><IconDock size={16} /></button> : null}
            {onClose ? <button type="button" className={css.close} aria-label="Close" title="Close" onClick={onClose}><IconCloseOutline16 size={16} /></button> : null}
          </div>
        </div>
        {frame}
      </div>
    )
  }

  const fullscreenElement = (
    <div className={css.npRoot}>
      <div className={css.npHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <YourIcon size={18} />
          <h2 className={css.npTitle}>Your App</h2>
        </div>
        <div className={css.npActions}>{/* dock + close, same as above */}</div>
      </div>
      {frame}
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(fullscreenElement, document.body) : fullscreenElement
}
```

Reuse the existing CSS-module classes — `npRootDocked`, `npDockedMaximized`, `npDockedToolbar`, `npToolbarLeft`, `npActions`, `iconBtn`, `close`, `npRoot`, `npHeader`, `npTitle`. No new CSS is needed for a standard header + maximize.

### 4. Wire both hosts

```tsx
// docked (Workbench pane)
export function WorkbenchAppHost({ appStore, params }) {
  const appId = (params?.appId as string) || 'notepad'
  if (appId === 'notepad') return <NotepadApp appStore={appStore} mode="docked" />
  if (appId === 'your-app') return <YourApp mode="docked" />
  if (appId === 'metamorphic' || params?.files) { /* keep: agent-mounted apps still dock */ }
  ...
}

// fullscreen
const renderActiveApp = (id: string) => {
  switch (id) {
    case 'notepad': return <NotepadApp appStore={appStore} mode="fullscreen" onClose={closeAll} />
    case 'your-app': return <YourApp mode="fullscreen" onClose={closeAll} />
    ...
  }
}
```

**Keep the `params?.files` branch.** Removing it breaks docking for every `mount_app` card.

### 5. Maximize needs the tab strip hidden too

Maximizing to `npDockedMaximized` fills the pane but leaves the Workbench tab strip visible. The strip is hidden by a body attribute, per app, in `/app/packages/client/ui-workbench/src/client/Workbench.module.css`:

```css
:global([data-editor-maximized="true"]) .strip,
:global([data-browser-maximized="true"]) .strip,
:global([data-app-maximized="true"]) .strip,
:global([data-notepad-maximized="true"]) .strip {
  display: none !important;
}
```

`data-app-maximized` is the generic one for app-store apps; your host sets it (see above). Without this rule the app maximizes but the strip stays.

### 6. Embed the document as an asset module

Generate it — never hand-escape a 30 KB string:

```bash
node scripts/embed-app.mjs <path-to-index.html> /app/packages/client/ui-app-store/src/client/your-app.ts YOUR_APP_HTML
```

It writes `export const YOUR_APP_HTML: string = <JSON.stringify(html)>`. Keep the app source in the workspace and the generated module in the package.

## Host layout rules (this is where "can't scroll" comes from)

Apps run inside an iframe whose size you do not control: a docked pane is often ~360 px wide and tall, a phone is narrow, fullscreen is large. Write the app **mobile-first** and add a wide-screen override:

```css
/* base: the document scrolls, so every control stays reachable in a narrow pane */
.app { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
main { display: flex; flex-direction: column; gap: 12px; flex: 1 1 auto; min-height: 0; }
#stage { flex: 0 0 auto; height: clamp(240px, 48vh, 460px); }

@media (min-width: 900px) and (min-height: 560px) {
  html, body { height: 100%; overflow: hidden; }
  .app { height: 100%; min-height: 0; }
  main { flex-direction: row; min-height: 0; }
  #stage { flex: 1 1 auto; height: auto; min-height: 240px; }
  aside { width: 336px; flex: 0 0 auto; min-height: 0; overflow-y: auto; }
}
```

Two traps that cost real debugging time:

- **`body { overflow: hidden }` + `.app { height: 100% }` with no narrow-screen rule** cuts off everything below the canvas in a docked pane, with no way to scroll. That is the classic "can't scroll the app in the Workbench" bug.
- **`min-height: 0` is mandatory** on the flex children that scroll (`main`, `aside`). Without it the default `min-height: auto` lets the sidebar stretch the row: a canvas measured 1354 px tall inside a 768 px viewport.

Also: `touch-action: none` only on the interactive canvas (so dragging works), keep a short stage on small screens so there is always page left to scroll, and bump button/slider targets under `@media (hover: none)`.

`references/app-shell.html` implements all of this.

## Build and ship

```bash
cd /app/packages/client/ui-app-store && npx tsc --noEmit -p tsconfig.json   # types
cd /app/packages/client/ui-app-store && pnpm bundle                          # tsdown -> lib/client.js
curl -s http://127.0.0.1:3080/plugins/@deepseek-ai/dsh-client-ui-app-store/client.js | grep -c 'Your App'
```

The GUI serves `/plugins/@deepseek-ai/<pkg>/client.js` and lists a `rev` hash in `window.__DSH_BOOT__` (see the GUI HTML). Changing the bundle changes the rev, and **the user must refresh the page** — client-plugin HMR only applies while `pnpm run dev:web` is running.

## The rebuild-drift trap

Rebuilding a plugin package rebuilds it from `src/`. If that package's checked-in `lib/client.js` was already stale relative to `src/`, you silently ship every pending source change in that package.

Before rebuilding a package you do not own, measure:

```bash
wc -c /app/packages/client/<pkg>/lib/client.js   # before
pnpm bundle
wc -c /app/packages/client/<pkg>/lib/client.js   # after
```

A one-line CSS change should move the bundle by tens of bytes. In this project a workbench rebuild moved it **+5,058 bytes**, i.e. ~5 KB of unbuilt source changes. When that happens:

1. Prefer a **byte-patch of the built bundle**: keep a copy of the original, insert only your rule, write it back. Everything else stays byte-identical to what the user was running.
2. Keep the `src/` edit so a deliberate future rebuild includes it.
3. Tell the user explicitly that the artifact and source now differ, and why.

## Verification recipes

Do not stop at "the build succeeded". In rough order of cost:

1. **Payload**: `mount_app` must report `(1 files)` for a one-file app.
2. **What the client received**: `node scripts/read-session-log.mjs` decodes `session.jsonl.zstd` (a *multi-frame* zstd log — one frame per record) and prints the `data.meta` of each `tool/result`. Use it when a mount reports success but nothing renders.
3. **What is served**: `curl -s http://127.0.0.1:3080/plugins/@deepseek-ai/<pkg>/client.js | grep -c '<your string>'`.
4. **The app document itself**: `node scripts/verify-app.mjs <index.html>` runs it in jsdom (stubbed canvas + rAF), drives the controls, and reports whether the app's own error banner appeared plus element counts.
5. **End-to-end in the real GUI**: port 3080 is **not** reachable from outside the container — but **port 80 through Traefik is**. Any unmatched sslip.io host falls through to the GUI: `http://<anything>.<SERVER_IP>.sslip.io/`. Log in with `$SADDLE_ADMIN_PASSWORD`, click `button[aria-label="Apps"]`, then use the card's Dock / Fullscreen buttons.
6. **Responsive layout matrix**: in the browser, fetch the served bundle, extract the document, and lay it out in sized iframes:

   ```js
   const js = await (await fetch('/plugins/@deepseek-ai/dsh-client-ui-app-store/client.js')).text()
   const HTML = JSON.parse(js.match(/"<!DOCTYPE html>[\s\S]*?<\/html>\\n"/)[0])
   // per size: iframe{width,height}, srcdoc = HTML, then measure
   //   de.scrollHeight - de.clientHeight   (page scroll range)
   //   stage/aside rects                   (two-column vs stacked, reachability)
   ```

   Testing 390×844, 700×900, 1024×768, 1440×900 and one wide+short case catches the whole mobile/scroll bug class without deploying anything.
7. **Maximize**: after clicking the button, assert `body[data-app-maximized] === 'true'`, the root gained `npDockedMaximized`, the strip's computed `display === 'none'`, the iframe grew, and that Escape restores all of it.

## Gotcha checklist

- [ ] One key in `mount_app.files`; `(1 files)` in the result.
- [ ] App is a single self-contained `/index.html` with no imports and no CDN.
- [ ] Catalog entry + card icon + docked host + fullscreen host all wired.
- [ ] `params?.files` branch in `WorkbenchAppHost` left intact.
- [ ] Header has title, maximize (docked), dock, close; Escape restores.
- [ ] `data-app-maximized` set/cleared, and the `.strip` rule present in the workbench CSS.
- [ ] Mobile-first CSS + wide-screen override; `min-height: 0` on scrolling flex children.
- [ ] `tsc --noEmit` clean; bundle rebuilt; served bundle grepped for your strings.
- [ ] Bundle byte delta matches the size of your change (or you patched instead of rebuilding).
- [ ] End-to-end check in the real GUI on port 80; told the user to refresh.

## Reference files

- `references/app-shell.html` — mobile-first self-contained app template (header, canvas stage, controls, error banner).
- `references/runtime-internals.md` — the metamorphic wrapper in full, with the failure catalogue.
- `scripts/embed-app.mjs` — generate the embedded asset module from an HTML file.
- `scripts/verify-app.mjs` — jsdom smoke test for an app document.
- `scripts/read-session-log.mjs` — decode multi-frame session logs and dump mount payloads.

## Worked example (read this before building a new one)

**Particle Life** is the reference implementation of everything above:

- App document: `/root/Questions/.saddle/apps/particle-life-emergent-ecologies/index.html`
  (mobile-first layout, docked-pane scrolling, canvas sim, matrix editor).
- Embedded asset: `/app/packages/client/ui-app-store/src/client/particle-life-app.ts`.
- Catalog entry, `IconParticleCluster`, `ParticleLifeApp` (header + maximize + dock + close),
  and both host wirings: `/app/packages/client/ui-app-store/src/client/AppStore.tsx`.
- Strip-hiding rule: `/app/packages/client/ui-workbench/src/client/Workbench.module.css`.

Copy that shape rather than starting from scratch.

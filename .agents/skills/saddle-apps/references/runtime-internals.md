# Metamorphic runtime internals

What Saddle does with the files you pass to `mount_app`, why an entry fails to compile, and
which error message means what. Source of truth: `buildMetamorphicSrcDoc` and
`prepareMetamorphicEntry` in `@deepseek-ai/dsh-client-ui-primitives`
(`src/metamorphic-runtime.ts`), used by the chat card (`MetamorphicRow`, ui-tool) and the
Workbench host (`MetamorphicCanvas`, ui-app-store).

## 1. Where files go

`mount_app` writes every key of `files` as a real file under
`<session cwd>/.saddle/apps/<slug>/`, and returns the same map to the client as
`presentationMeta`:

```jsonc
{
  "appId": "app-<slug>-<epoch-ms>",
  "title": "...",
  "description": "...",
  "target": "workbench",
  "entryFile": "/App.tsx",
  "fileCount": 1,
  "savedDir": "/root/<workspace>/.saddle/apps/<slug>",
  "files": { "/App.tsx": "<source>" }
}
```

Keys are taken literally. `"<//App.tsx"` creates a directory `<` containing `//App.tsx`;
`"\\/App.tsx"` creates a directory `\`. Those junk files stay on disk and show up in the app
directory listing. Pass exactly one key.

## 2. The document

`buildMetamorphicSrcDoc(files, entryFile, title)` returns the iframe's `srcdoc`:

- `/index.html` present → **returned verbatim**. No compile step, no rewrite.
- otherwise → one document loading, in order: the Tailwind CDN, React 18 UMD,
  ReactDOM UMD, lucide UMD, Babel standalone — all pinned versions — plus an inline
  bootstrap (memory-backed storage for the opaque origin, the lucide icon proxy, the boot flag).

The entry is then compiled by `saddleMountApp` (exported as `METAMORPHIC_MOUNT_SOURCE` so the
package spec and `scripts/verify-metamorphic-runtime.mjs` run the same code):

```js
window.Babel.transform(source, {
  filename: 'App.tsx',
  sourceType: 'script',
  presets: [['react', { runtime: 'classic' }], 'typescript'],
})
```

Two details are load-bearing and regression-guarded:

- **`runtime: 'classic'`.** Babel's automatic JSX runtime emits
  `import ... from "react/jsx-runtime"`, and nothing in this document resolves modules.
- **`sourceType: 'script'`**, with every `import`/`export` already resolved by
  `prepareMetamorphicEntry`, so the compiled output can be evaluated with `new Function`.

The wrapper puts the entry inside an inner function, and the React prelude is destructured in
the outer scope, so an entry that declares `const { useState } = React` shadows the prelude
instead of colliding with it.

## 3. What the entry may contain

| In the entry | Result |
| --- | --- |
| `import React`, `import { useState }`, `react-dom`, `react/jsx-runtime` | import removed; the name is in scope |
| `import { Sparkles } from 'lucide-react'` | rewritten to `__saddleLucide` |
| `import './styles.css'` | removed |
| `export default function App`, `export function App`, `export default Card` | mounted |
| `recharts`, `./Helper`, any other specifier | refused with an "Unsupported import" card |
| JSX, TypeScript annotations, hooks by name | compiled by the real Babel pass |

The canvas has no module graph: one entry file, no package resolution.

## 4. Failure catalogue

| Message | Cause | Fix |
| --- | --- | --- |
| **Unsupported import** (names the specifier) | The entry imports a package or relative module the canvas does not serve. | Inline the module, drop the dependency (render native SVG instead of a chart library), or ship `/index.html`. |
| **Compilation Error: <message>** | The compiler rejected the entry — a syntax error, or JSX/TS the presets cannot parse. | Fix the syntax. Use one entry file that parses as a script. |
| **No app component** | The entry declares no default export and no `App` component. | `export default function App() { ... }`. |
| **Application Error** (with *Retry Execution*) | The component threw while rendering. | Fix the component; the card is the error boundary, not a compile failure. |
| **Runtime assets did not load** | A pinned CDN asset never arrived (blocked network, proxy, or CSP). | The canvas cannot compile without them; unblock the CDN or report it. |
| **The app did not start** | Babel ran but nothing mounted. | Open the browser console for the error. |

## 5. Why `/index.html` is the escape hatch

The first line of the builder returns that file verbatim: the iframe simply becomes your
document. Nothing is rewritten, wrapped, compiled, or resolved — no React, no compiler, no CDN
— at the cost of the canvas's own conveniences. `references/app-shell.html` is a working
starting point.

`MetamorphicRow` mounts either shape in
`<iframe srcDoc={srcDoc} sandbox="allow-scripts allow-modals" />` and dispatches
`workbench:open-app` with `{ appId: 'metamorphic', params: { title, description, files, entryFile } }`
whenever `target === 'workbench'` and `fileCount > 0`. That is what docks the app;
`WorkbenchAppHost` picks it up through the `params?.files` branch.

## 6. Verifying a change to the canvas

- `packages/client/ui-primitives/tests/metamorphic-runtime.client.spec.ts` — the option
  contract, the import/export resolution, every diagnostic, with Babel stubbed.
- `node .agents/skills/saddle-apps/scripts/verify-metamorphic-runtime.mjs` — the same mount
  source through the **real** `@babel/standalone`, for canonical React/TSX entries and a
  deliberately broken one. Run it after touching the compile path.

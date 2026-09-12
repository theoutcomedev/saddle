# Metamorphic runtime internals

What the Workbench does with the files you pass to `mount_app`, why entries fail to compile, and which
error message means what. Source of truth: `buildMetamorphicSrcDoc` in
`@deepseek-ai/dsh-client-ui-app-store` (`lib/client.js`) and `MetamorphicRow` in
`@deepseek-ai/dsh-client-ui-tool`.

## 1. Where files go

`mount_app` writes every key of `files` as a real file under
`/root/<workspace>/.saddle/apps/<slug>/`, and returns the same map to the client as
`presentationMeta`:

```jsonc
{
  "appId": "app-<slug>-<epoch-ms>",
  "title": "...",
  "description": "...",
  "target": "workbench",
  "entryFile": "/App.tsx",
  "template": "react-ts",
  "fileCount": 1,
  "savedDir": "/root/<workspace>/.saddle/apps/<slug>",
  "files": { "/App.tsx": "<source>" }
}
```

Keys are taken literally. `"<//App.tsx"` creates a directory `<` containing `//App.tsx`; `"\\/App.tsx"`
creates a directory `\`. Those junk files stay on disk and are visible in the app directory listing.

The tool result text reports `(N files)` where N is the number of keys. If N is larger than the number of
distinct modules you intended, the entry module is emitted more than once into the same scope — which
surfaces as `Identifier '...' has already been declared` for whatever the entry declares first.

## 2. The React path

The tool card (`MetamorphicRow`) and the Workbench host (`SandpackMetamorphicCanvas`) both build the
iframe document through `buildMetamorphicSrcDoc(files, entryFile, title)`:

```js
function buildMetamorphicSrcDoc(files, entryFile = "/App.tsx", title = "Metamorphic App") {
  if (files["/index.html"] || files["index.html"]) return files["/index.html"] || files["index.html"] || "";
  let entryCode = files[entryFile] || files["/App.tsx"] || files["/App.jsx"] || files["/App.js"] || files["/index.tsx"] || "";
  if (!entryCode) {
    const firstKey = Object.keys(files)[0];
    if (firstKey !== undefined && files[firstKey] !== undefined) entryCode = files[firstKey];
  }
  let secondaryModules = "";
  // every other .ts/.tsx/.js/.jsx file is wrapped as window.__saddle_modules['<path>']
  ...
  return `<!DOCTYPE html> ... ${sectionWithEntryCode} ...`;
}
```

The generated document loads React 18 UMD, `lucide`, Tailwind and Babel standalone, defines an error
boundary, then runs the entry through this pipeline inside a `<script type="text/babel">`:

```js
let processedCode = ${JSON.stringify(entryCode)};

processedCode = processedCode.replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g,
  'const { $1 } = window.__lucideProxy;');
processedCode = processedCode.replace(/import\s+\*\s+as\s+([a-zA-Z0-9_$]+)\s+from\s+['"]lucide-react['"];?/g,
  'const $1 = window.__lucideProxy;');
processedCode = processedCode.replace(/import\s+React\s*(?:,\s*\{([^}]+)\})?\s*from\s+['"]react['"];?/g,
  (m, g1) => g1 ? 'const { ' + g1 + ' } = React;' : '');
processedCode = processedCode.replace(/import\s+\{([^}]+)\}\s+from\s+['"]react['"];?/g,
  'const { $1 } = React;');
processedCode = processedCode.replace(/import\s+['"][^'"]+\.css['"];?/g, '');

// `export default function App` -> `function App`; `export default App` -> `/* export default App */`

const evaluateModule = new Function(
  'React', 'useState', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'LucideIcons',
  processedCode + '; return typeof App !== "undefined" ? App : (typeof defaultExport !== "undefined" ? defaultExport : null);'
);
const AppComponent = evaluateModule(React, useState, useEffect, useMemo, useRef, useCallback, LucideIcons);
```

Two consequences:

- **The wrapper's parameters share scope with the body.** Any `const { useEffect } = React;` produced by
  the rewrite is a redeclaration of the parameter of the same name.
- **Anything reachable is only what the parameters provide**: `React`, `useState`, `useEffect`,
  `useMemo`, `useRef`, `useCallback`, `LucideIcons`. `useContext`, `useReducer`, `useLayoutEffect`,
  `ReactDOM` and friends are *not* in scope unless the entry imports them (and importing them is the
  thing that breaks).

## 3. Failure catalogue

| Message | Cause | Fix |
| --- | --- | --- |
| `Identifier 'useEffect' has already been declared` (or `useMemo`/`useRef`/`useState`/`React`) | Entry imports hooks by name; the rewrite declares them as consts inside `new Function`, whose parameters already have those names. | Ship `/index.html`. Or import only `React` and call `React.useState(...)`. |
| `Missing initializer in const declaration` | Follow-on from a mangled or truncated entry (e.g. a payload the client did not receive intact). | Ship `/index.html`; confirm the payload landed with `read-session-log.mjs`. |
| `Cannot use import statement outside a module` | An import survived the rewrites — e.g. `import * as React from "react"` (no rule covers it) or `react/jsx-runtime` from an automatic JSX transform. | Ship `/index.html`. |
| `Unexpected token '<'` | Raw JSX reached `new Function` (entry was not compiled). | Ship `/index.html`. |
| Card shows text, no app at all | `fileCount` is 0 or `files` is missing from the payload the client rendered from. | Check the tool result's `data.meta`; re-mount. |
| Blank iframe, no error | Sandbox flags missing, or a CDN the app depends on is unreachable from the iframe. | Use `sandbox="allow-scripts allow-modals"` and no external dependencies. |

## 4. Why `/index.html` is the escape hatch

The very first line returns the file verbatim. Nothing in it is rewritten, wrapped, compiled or resolved:
the iframe simply becomes your document. That removes the entire failure catalogue above at the cost of
not being able to use a framework — which, for a canvas/DOM app, costs nothing.

`MetamorphicRow` mounts it as:

```jsx
<iframe srcDoc={srcDoc} title={title} sandbox="allow-scripts allow-modals allow-same-origin" />
```

and also dispatches `workbench:open-app` with `{ appId: 'metamorphic', params: { title, description, files, dependencies, template, entryFile } }`
whenever `target === 'workbench'` and `fileCount > 0`. That is what docks the app; `WorkbenchAppHost`
picks it up through the `params?.files` branch.

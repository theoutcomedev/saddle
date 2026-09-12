#!/usr/bin/env node
/**
 * Decode a DSH session log and show what the client actually received.
 *
 * Usage:
 *   node read-session-log.mjs [workspace-dirname] [--last=N] [--grep=text]
 *
 *   workspace-dirname  defaults to the basename of the cwd (e.g. "Questions")
 *   --last=N           show only the last N matching records (default 5)
 *   --grep=text        only records whose JSON contains this text
 *
 * Why this exists: `session.jsonl.zstd` is NOT a single zstd stream — it is a
 * concatenation of one zstd frame per record (thousands of them). Reading it with a
 * normal decompressor returns only the first frame, and a streaming decoder stops at
 * the second "Unknown frame descriptor". Split on the zstd magic and decode each frame.
 *
 * The interesting records are `type: "tool/result"`, whose `data.meta` is the payload
 * the Workbench renders an app from: appId, title, template, entryFile, files,
 * fileCount, target, savedDir. When a mount "succeeds" but no app appears, check
 * whether `files` is present and whether each value is the length you sent.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import zlib from 'node:zlib'

const args = process.argv.slice(2)
const workspace = args.find((a) => !a.startsWith('--')) || process.cwd().split('/').pop()
const last = Number((args.find((a) => a.startsWith('--last=')) || '--last=5').slice('--last='.length)) || 5
const grep = (args.find((a) => a.startsWith('--grep=')) || '').slice(7)

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const dir = join('/root/.dsh/sessions', `--root-${workspace}--`)

let newest = null
try {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry, 'session.jsonl.zstd')
    try {
      const st = statSync(p)
      if (!newest || st.mtimeMs > newest.mtimeMs) newest = { path: p, mtimeMs: st.mtimeMs, size: st.size }
    } catch { /* not a session dir */ }
  }
} catch {
  console.error(`no session dir at ${dir}`)
  process.exit(1)
}
if (!newest) {
  console.error(`no session logs under ${dir}`)
  process.exit(1)
}

const buf = readFileSync(newest.path)
const offsets = []
for (let i = 0; ; ) {
  const found = buf.indexOf(MAGIC, i)
  if (found === -1) break
  offsets.push(found)
  i = found + 4
}

let decoded = 0
let failed = 0
const records = []
for (let k = 0; k < offsets.length; k++) {
  const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length
  try {
    const out = zlib.zstdDecompressSync(buf.subarray(offsets[k], end)).toString('utf8')
    decoded++
    for (const line of out.split('\n')) if (line.trim()) records.push(line)
  } catch { failed++ }
}

const outPath = '/tmp/session-decoded.jsonl'
writeFileSync(outPath, records.join('\n') + '\n')

console.log(`log        : ${newest.path}`)
console.log(`frames     : ${offsets.length} (${decoded} decoded, ${failed} failed)`)
console.log(`records    : ${records.length} -> ${outPath}`)

const matches = []
for (const line of records) {
  if (!line.includes('tool/result')) continue
  if (grep && !line.includes(grep)) continue
  try {
    const o = JSON.parse(line)
    const meta = o?.data?.meta
    if (meta && typeof meta === 'object' && (meta.files || meta.fileCount !== undefined)) matches.push({ line, meta })
  } catch { /* not JSON */ }
}

console.log(`mount payloads: ${matches.length}`)
for (const { meta } of matches.slice(-last)) {
  const files = meta.files || {}
  const keys = Object.keys(files)
  console.log('---')
  console.log(`  appId      : ${meta.appId}`)
  console.log(`  title      : ${meta.title}`)
  console.log(`  entryFile  : ${meta.entryFile}   template: ${meta.template}   target: ${meta.target}`)
  console.log(`  fileCount  : ${meta.fileCount}   savedDir: ${meta.savedDir}`)
  console.log(`  files      : ${keys.length === 0 ? '(NONE — the card can render nothing)' : keys.map((k) => `${k} [${String(files[k]).length} chars]`).join(', ')}`)
  for (const k of keys) {
    const v = String(files[k])
    console.log(`    ${k} head: ${JSON.stringify(v.slice(0, 50))}`)
    console.log(`    ${k} tail: ${JSON.stringify(v.slice(-30))}`)
  }
}

const errors = records.filter((l) => /Compilation Error|has already been declared|Missing initializer/.test(l))
if (errors.length) {
  console.log(`\ncompile-error mentions: ${errors.length} (usually the model's own text; confirm against the payload above)`)
}

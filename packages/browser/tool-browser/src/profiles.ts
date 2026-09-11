import fs from 'node:fs/promises'
import path from 'node:path'

export function sanitizeProfileName(name: string): string {
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  return sanitized || 'default'
}

export function getProfilesDir(): string {
  if (process.env.SADDLE_PROFILES_DIR) {
    return process.env.SADDLE_PROFILES_DIR
  }
  if (process.env.SADDLE_DATA_DIR) {
    return path.join(process.env.SADDLE_DATA_DIR, 'browser-profiles')
  }
  // Check if /app/data exists in production Docker container
  try {
    const isDocker = process.cwd().startsWith('/app')
    if (isDocker) {
      return '/app/data/browser-profiles'
    }
  } catch {}
  return path.resolve(process.cwd(), 'data/browser-profiles')
}

export async function saveProfile(name: string, context: Record<string, unknown>): Promise<string> {
  const cleanName = sanitizeProfileName(name)
  const dir = getProfilesDir()
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${cleanName}.json`)
  const payload = {
    name: cleanName,
    savedAt: new Date().toISOString(),
    context,
  }
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return cleanName
}

export async function loadProfile(name: string): Promise<Record<string, unknown> | null> {
  const cleanName = sanitizeProfileName(name)
  const dir = getProfilesDir()
  const filePath = path.join(dir, `${cleanName}.json`)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as { context?: Record<string, unknown> }
    return parsed.context ?? null
  } catch {
    return null
  }
}

export async function listProfiles(): Promise<string[]> {
  const dir = getProfilesDir()
  try {
    const files = await fs.readdir(dir)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5))
  } catch {
    return []
  }
}

export async function deleteProfile(name: string): Promise<boolean> {
  const cleanName = sanitizeProfileName(name)
  const dir = getProfilesDir()
  const filePath = path.join(dir, `${cleanName}.json`)
  try {
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Workspace modes, node half. Pure UI plugin: the empty apply exists so the
 * plugin appears in the host roster; the browser half ships via
 * exports["./client"], discovered through the package.json dsh.client
 * declaration. What the agent may do with a mode — the tool and the durable
 * event behind it — belongs to `@deepseek-ai/dsh-workspace-modes`, composed
 * independently on the host side.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}

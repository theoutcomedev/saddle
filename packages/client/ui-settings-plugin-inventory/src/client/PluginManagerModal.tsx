import { useEffect, useState, useMemo } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconCloseOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { PluginInventorySettingsTabInjected } from './PluginInventorySettingsTab.tsx'
import { IconPuzzleOutline16 } from './PluginManagerButton.tsx'
import css from './PluginManagerModal.module.css'

export interface PluginManagerModalProps {
  onClose: () => void
  list?: PluginInventorySettingsTabInjected['list']
  toggle?: (entryId: string, enabled: boolean) => Promise<void>
}

function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return unscoped.replace(/^cordis:/, '').replace(/^cordis-plugin-/, '').replace(/^dsh-(?:host-|client-)?/, '')
}

export function PluginManagerModal({ onClose, list, toggle }: PluginManagerModalProps) {
  const [snapshot, setSnapshot] = useState<PluginInventorySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All Plugins')

  const refresh = () => {
    if (!list) return
    setLoading(true)
    list().then((s) => {
      setSnapshot(s)
      setLoading(false)
    }).catch((e) => {
      console.error(e)
      setLoading(false)
    })
  }

  useEffect(() => {
    refresh()
  }, [list])

  const entries = snapshot?.entries || []

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const e of entries) {
      if (e.categories) {
        for (const c of e.categories) cats.add(c)
      }
    }
    return ['All Plugins', ...Array.from(cats).sort()]
  }, [entries])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (activeCategory !== 'All Plugins') {
        if (!e.categories?.includes(activeCategory)) return false
      }
      if (query.trim()) {
        const q = query.toLowerCase()
        if (!e.moduleName.toLowerCase().includes(q) && !e.description?.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => moduleShortName(a.moduleName).localeCompare(moduleShortName(b.moduleName)))
  }, [entries, activeCategory, query])

  const handleToggle = async (entryId: string, enabled: boolean) => {
    if (!toggle) return
    try {
      await toggle(entryId, enabled)
      refresh() // reload to see new phase
    } catch (e) {
      console.error('Failed to toggle plugin', e)
    }
  }

  return (
    <div className={css.modal} role="dialog" aria-modal="true" aria-labelledby="plugin-manager-title">
      <div className={css.header}>
        <div className={css.titleArea}>
          <IconPuzzleOutline16 size={18} />
          <h2 id="plugin-manager-title" className={css.title}>Plugins</h2>
        </div>
        <div className={css.headerControls}>
          <Button variant="outline" size="sm" disabled={loading} onClick={refresh} title="Refresh">
            <IconRefreshOutline16 size={14} className={loading ? css.spin : undefined} />
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} title="Close">
            <IconCloseOutline16 size={14} />
          </Button>
        </div>
      </div>
      <div className={css.content}>
        <div className={css.sidebar}>
          {categories.map(cat => (
            <button
              key={cat}
              className={css.categoryButton}
              data-active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className={css.mainArea}>
          <div className={css.searchBar}>
            <input
              type="search"
              className={css.searchInput}
              placeholder="Search plugins..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className={css.grid}>
            {filtered.map(entry => (
              <div key={entry.entryId} className={css.card}>
                <div className={css.cardHeader}>
                  <div className={css.iconWrapper}>
                    {entry.icon ? (
                      <div dangerouslySetInnerHTML={{ __html: entry.icon }} />
                    ) : (
                      <IconPuzzleOutline16 size={20} />
                    )}
                  </div>
                  <div className={css.cardTitleArea}>
                    <h3 className={css.cardTitle}>{moduleShortName(entry.moduleName)}</h3>
                    {entry.developer && <p className={css.cardAuthor}>by {entry.developer}</p>}
                  </div>
                </div>
                <p className={css.cardDesc}>
                  {entry.description || 'No description provided.'}
                </p>
                <div className={css.cardFooter}>
                  <div className={css.tags}>
                    {entry.tags?.slice(0, 3).map(t => (
                      <span key={t} className={css.tag}>{t}</span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={css.toggleSwitch}
                    aria-checked={entry.enabled}
                    onClick={() => handleToggle(entry.entryId, !entry.enabled)}
                  >
                    {entry.enabled ? 'Enabled' : 'Disabled'}
                    <div className={css.switchTrack}>
                      <div className={css.switchThumb} />
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

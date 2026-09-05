// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilesPane } from '../src/client/files-pane.tsx'

afterEach(cleanup)

describe('FilesPane', () => {
  const dummyT = ((key: string) => key) as unknown as Parameters<typeof FilesPane>[0]['t']
  const dummyUseSessions = (<T,>(selector: (state: { byId: Record<string, { cwd: string }> }) => T): T =>
    selector({ byId: { 's-1': { cwd: '/workspace/my-project' } } })) as unknown as Parameters<typeof FilesPane>[0]['useSessions']

  it('renders directory entries and breadcrumbs', async () => {
    const listFiles = vi.fn().mockResolvedValue({
      path: '/workspace/my-project',
      entries: [
        { name: 'src', path: '/workspace/my-project/src', isDir: true },
        { name: 'README.md', path: '/workspace/my-project/README.md', isDir: false, sizeBytes: 1024 },
      ],
      truncated: false,
    })
    const readFile = vi.fn().mockResolvedValue({ path: '/workspace/my-project/README.md', text: '# Hello World' })
    const openPath = vi.fn().mockResolvedValue(undefined)

    await act(async () => {
      render(
        <FilesPane
          sessionId={'s-1' as unknown as Parameters<typeof FilesPane>[0]['sessionId']}
          useSessions={dummyUseSessions}
          listFiles={listFiles}
          readFile={readFile}
          openPath={openPath}
          t={dummyT}
        />,
      )
    })

    expect(listFiles).toHaveBeenCalledWith('/workspace/my-project', expect.any(AbortSignal))
    expect(screen.getByText('src')).toBeDefined()
    expect(screen.getByText('README.md')).toBeDefined()
    expect(screen.getByText('1.0 KB')).toBeDefined()
    expect(screen.getByText('my-project')).toBeDefined()
  })

  it('supports quick jump presets to VPS root and apps', async () => {
    const listFiles = vi.fn().mockResolvedValue({
      path: '/host',
      entries: [
        { name: 'root', path: '/host/root', isDir: true },
      ],
      truncated: false,
    })
    const readFile = vi.fn()
    const openPath = vi.fn()

    await act(async () => {
      render(
        <FilesPane
          sessionId={'s-1' as unknown as Parameters<typeof FilesPane>[0]['sessionId']}
          useSessions={dummyUseSessions}
          listFiles={listFiles}
          readFile={readFile}
          openPath={openPath}
          t={dummyT}
        />,
      )
    })

    const vpsRootBtn = screen.getByRole('button', { name: /VPS Root/i })
    await act(async () => {
      fireEvent.click(vpsRootBtn)
    })

    expect(listFiles).toHaveBeenCalledWith('/host', expect.any(AbortSignal))
  })
})

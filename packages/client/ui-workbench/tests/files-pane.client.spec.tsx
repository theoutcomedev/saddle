// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilesPane, type FilesPaneProps } from '../src/client/files-pane.tsx'

afterEach(cleanup)

describe('FilesPane', () => {
  const dummyUseSessions = (<T,>(selector: (state: { byId: Record<string, { cwd: string }> }) => T): T =>
    selector({ byId: { 's-1': { cwd: '/workspace/my-project' } } })) as unknown as FilesPaneProps['useSessions']

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

    const props = {
      sessionId: 's-1',
      useSessions: dummyUseSessions,
      listFiles,
      readFile,
      openPath,
    } as unknown as FilesPaneProps

    await act(async () => {
      render(<FilesPane {...props} />)
    })

    expect(listFiles).toHaveBeenCalledWith('/workspace/my-project', expect.any(AbortSignal))
    expect(screen.getByText('src')).toBeDefined()
    expect(screen.getByText('README.md')).toBeDefined()
    expect(screen.getByText('1.0 KB')).toBeDefined()
    expect(screen.getByText('my-project')).toBeDefined()
  })

  it('supports quick jump presets to Workspace and System Root', async () => {
    const listFiles = vi.fn().mockResolvedValue({
      path: '/',
      entries: [
        { name: 'etc', path: '/etc', isDir: true },
      ],
      truncated: false,
    })
    const readFile = vi.fn()
    const openPath = vi.fn()

    const props = {
      sessionId: 's-1',
      useSessions: dummyUseSessions,
      listFiles,
      readFile,
      openPath,
    } as unknown as FilesPaneProps

    await act(async () => {
      render(<FilesPane {...props} />)
    })

    const rootBtn = screen.getByRole('button', { name: /\/ Root/i })
    await act(async () => {
      fireEvent.click(rootBtn)
    })

    expect(listFiles).toHaveBeenCalledWith('/', expect.any(AbortSignal))
  })

  it('portals quick presets into #workbench-strip-subrow when present in document', async () => {
    const subrow = document.createElement('div')
    subrow.id = 'workbench-strip-subrow'
    document.body.appendChild(subrow)

    const listFiles = vi.fn().mockResolvedValue({
      path: '/workspace/my-project',
      entries: [],
      truncated: false,
    })
    const readFile = vi.fn()
    const openPath = vi.fn()

    const props = {
      sessionId: 's-1',
      useSessions: dummyUseSessions,
      listFiles,
      readFile,
      openPath,
    } as unknown as FilesPaneProps

    await act(async () => {
      render(<FilesPane {...props} />)
    })

    expect(subrow.querySelector('button')).toBeDefined()
    expect(subrow.textContent).toContain('Workspace')
    expect(subrow.textContent).toContain('Root')

    document.body.removeChild(subrow)
  })

  it('handles dropped files with progress tracking and refreshes directory', async () => {
    const listFiles = vi.fn().mockResolvedValue({
      path: '/workspace/my-project',
      entries: [],
      truncated: false,
    })
    const readFile = vi.fn()
    const openPath = vi.fn()
    const writeFile = vi.fn().mockResolvedValue({ path: '/workspace/my-project/test.txt', bytesWritten: 12 })

    const props = {
      sessionId: 's-1',
      useSessions: dummyUseSessions,
      listFiles,
      readFile,
      openPath,
      writeFile,
    } as unknown as FilesPaneProps

    const view = render(<FilesPane {...props} />)

    const file = new File(['hello world!'], 'test.txt', { type: 'text/plain' })
    const dropTarget = view.container.querySelector('[class*="dropTarget"]')
    expect(dropTarget).toBeDefined()

    if (dropTarget) {
      fireEvent.dragEnter(dropTarget, {
        dataTransfer: { types: ['Files'] },
      })
      expect(view.getByText(/Drop files or folders to upload/i)).toBeDefined()

      await act(async () => {
        fireEvent.drop(dropTarget, {
          dataTransfer: {
            types: ['Files'],
            files: [file],
            items: [],
          },
        })
      })

      expect(writeFile).toHaveBeenCalledWith(
        '/workspace/my-project/test.txt',
        'hello world!',
        'utf8',
      )
      expect(listFiles).toHaveBeenCalledWith('/workspace/my-project', expect.any(AbortSignal))
    }
  })
})

import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createLayoutStore } from './stores.ts'
/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps = PropsRuntime<'root'> & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay' | 'shell.mobile_trigger'> & PropsStore<ReturnType<typeof createLayoutStore>>
export declare function AppFrame(props: AppFrameProps): import('react').JSX.Element | null
//# sourceMappingURL=AppFrame.d.ts.map

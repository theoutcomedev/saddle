import { IconPanelLeftOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './WorkbenchHeaderToggle.module.css'

export interface WorkbenchHeaderToggleProps {
  toggle: () => void
}

export function WorkbenchHeaderToggle({ toggle }: WorkbenchHeaderToggleProps) {
  return (
    <Tooltip label="Toggle workbench" delayMs={500}>
      <button
        type="button"
        className={css.button}
        aria-label="Toggle workbench"
        onClick={toggle}
      >
        <IconPanelLeftOutline16 className={css.icon} size={16} />
      </button>
    </Tooltip>
  )
}

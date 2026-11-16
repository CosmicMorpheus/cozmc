/* Whether a key press belongs to someone typing or using the page, not to the game. The games listen to the
   whole window (so a run keeps its controls wherever focus drifts), which means they must step aside when a
   visitor types into the site search or any other field, uses a menu or dialog, or presses a shortcut such
   as Ctrl+S. */
type KeyTarget = { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown }

const AWAY = '[role="dialog"], .modal, .site-menu__panel'

export function notForTheGame(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  const target = e.target as KeyTarget | null
  if (!target) return false
  const tag = target.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true
  return Boolean(target.closest?.(AWAY))
}

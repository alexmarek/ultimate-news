/** A question mark opens help whether it requires Shift on the user's keyboard or not. */
export function isHelpShortcut(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>): boolean {
  return event.key === '?' && !event.altKey && !event.ctrlKey && !event.metaKey;
}

/** Shortcuts supported by useKeyboardNav, shared by the help dialog and footer. */
export const KEYBOARD_SHORTCUTS = [
  { key: 'j', desc: 'Next article' },
  { key: 'k', desc: 'Previous article' },
  { key: 'o', desc: 'Open detail view' },
  { key: 'm', desc: 'Mark as read' },
  { key: '/', desc: 'Focus search' },
  { key: 'Esc', desc: 'Clear focus' },
  { key: '?', desc: 'Show / hide shortcuts' },
] as const;

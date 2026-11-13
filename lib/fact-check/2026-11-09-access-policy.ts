export type FactCheckRole = 'owner' | 'editor';
export type FactCheckAction = 'manage-users' | 'manage-fact-checks';

/** Call with the current database record on every protected request. */
export function isAllowed(
  user: { googleSubject: string; role: FactCheckRole; active: boolean } | null,
  authenticatedGoogleSubject: string | null,
  action: FactCheckAction,
): boolean {
  if (!user || !user.active || !authenticatedGoogleSubject || user.googleSubject !== authenticatedGoogleSubject) return false;
  return action === 'manage-fact-checks' || user.role === 'owner';
}

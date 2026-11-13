import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { FactCheckActionButton } from '@/components/2026-11-13-fact-check-action-button';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/fact-check/2026-11-09-auth';
import { addUser, removeUser } from './actions';

export const dynamic = 'force-dynamic';

export default async function ManageUsersPage() {
  if (process.env.FACT_CHECK_ENABLED !== 'true') notFound();
  if (!await canAccess('manage-users')) notFound();
  const users = await prisma.$queryRaw<Array<{ id: string; email: string; active: boolean; googleSubject: string | null }>>`
    SELECT "id", "email", "active", "googleSubject" FROM "FactCheckUser" WHERE "role" = 'editor' ORDER BY "email"`;
  return (
    <>
      <SiteHeader />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <Link href="/admin/fact-check" className="text-[var(--text-muted)] underline">Back to fact checks</Link>
        <h1 className="mt-6 font-serif text-3xl font-bold">Manage users</h1>
        <p className="mt-3 text-[var(--text-muted)]">Add a Google account email to let someone manage fact checks. Only you can manage users.</p>
        <form action={addUser} className="mt-6 flex flex-wrap gap-3">
          <label htmlFor="email" className="sr-only">Google account email</label>
          <input id="email" name="email" type="email" required placeholder="Google account email" className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-4 py-3 text-[var(--text)]" />
          <FactCheckActionButton label="Add user" pendingLabel="Adding user…" />
        </form>
        <ul className="mt-8 divide-y divide-[var(--border)]">
          {users.map((user) => <li key={user.id} className="flex items-center justify-between gap-4 py-4">
            <div><div>{user.email}</div><div className="text-sm text-[var(--text-muted)]">{!user.active ? 'Removed' : user.googleSubject ? 'Active' : 'Awaiting first sign-in'}</div></div>
            {user.active && <form action={removeUser}>
              <input type="hidden" name="id" value={user.id} />
              <FactCheckActionButton label="Remove" pendingLabel="Removing user…" secondary />
            </form>}
          </li>)}
        </ul>
      </main>
    </>
  );
}

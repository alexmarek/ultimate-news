import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { prisma } from '@/lib/db';
import { isAllowed, type FactCheckAction, type FactCheckRole } from './2026-11-09-access-policy';

interface UserRow {
  googleSubject: string | null;
  role: string;
  active: boolean;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile }) {
      if (process.env.FACT_CHECK_ENABLED !== 'true') return false;
      if (account?.provider !== 'google' || !account.providerAccountId || profile?.email_verified !== true || typeof profile.email !== 'string') return false;
      const subject = account.providerAccountId;
      const email = profile.email.trim().toLowerCase();
      const ownerSubject = process.env.FACT_CHECK_OWNER_GOOGLE_SUBJECT;
      if (!ownerSubject) return false;
      if (subject === ownerSubject) {
        // The configured subject is the only owner, regardless of database edits.
        await prisma.$executeRaw`INSERT INTO "FactCheckUser" ("id", "email", "googleSubject", "role", "active", "createdAt", "updatedAt")
          VALUES (${`owner:${subject}`}, ${email}, ${subject}, 'owner', true, NOW(), NOW())
          ON CONFLICT ("googleSubject") DO UPDATE SET "role" = 'owner', "active" = true, "updatedAt" = NOW()`;
        return true;
      }
      // An invitation is bound once to the Google subject from a verified Google login.
      await prisma.$executeRaw`UPDATE "FactCheckUser" SET "googleSubject" = ${subject}, "updatedAt" = NOW()
        WHERE "email" = ${email} AND "googleSubject" IS NULL AND "role" = 'editor' AND "active" = true`;
      const users = await prisma.$queryRaw<UserRow[]>`SELECT "googleSubject", "role", "active" FROM "FactCheckUser"
        WHERE "googleSubject" = ${subject} AND "role" = 'editor' AND "active" = true LIMIT 1`;
      return users.length === 1;
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google') token.googleSubject = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      return { ...session, googleSubject: typeof token.googleSubject === 'string' ? token.googleSubject : null };
    },
  },
});

/** Looks up current permissions on every request; revocation does not wait for session expiry. */
export async function canAccess(action: FactCheckAction): Promise<boolean> {
  if (process.env.FACT_CHECK_ENABLED !== 'true') return false;
  const session = await auth();
  const subject = (session as typeof session & { googleSubject?: string | null })?.googleSubject;
  if (!subject) return false;
  const users = await prisma.$queryRaw<UserRow[]>`SELECT "googleSubject", "role", "active" FROM "FactCheckUser"
    WHERE "googleSubject" = ${subject} LIMIT 1`;
  const row = users[0];
  if (!row?.googleSubject || (row.role !== 'owner' && row.role !== 'editor')) return false;
  // A database role alone cannot make a second owner.
  if (row.role === 'owner' && subject !== process.env.FACT_CHECK_OWNER_GOOGLE_SUBJECT) return false;
  return isAllowed({ googleSubject: row.googleSubject, role: row.role as FactCheckRole, active: row.active }, subject, action);
}

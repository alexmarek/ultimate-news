'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/fact-check/2026-11-09-auth';

export async function addUser(form: FormData): Promise<void> {
  if (!await canAccess('manage-users')) throw new Error('Unauthorized');
  const input = form.get('email');
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "FactCheckUser" ("id", "email", "role", "active", "createdAt", "updatedAt")
    VALUES (${id}, ${email}, 'editor', true, NOW(), NOW())
    ON CONFLICT ("email") DO UPDATE SET "active" = true, "updatedAt" = NOW()
    WHERE "FactCheckUser"."role" = 'editor'`;
  revalidatePath('/admin/fact-check/users');
}

export async function removeUser(form: FormData): Promise<void> {
  if (!await canAccess('manage-users')) throw new Error('Unauthorized');
  const id = form.get('id');
  if (typeof id !== 'string' || !id) throw new Error('Invalid user.');
  await prisma.$executeRaw`UPDATE "FactCheckUser" SET "active" = false, "updatedAt" = NOW()
    WHERE "id" = ${id} AND "role" = 'editor'`;
  revalidatePath('/admin/fact-check/users');
}

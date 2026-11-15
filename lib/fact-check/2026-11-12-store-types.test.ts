import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import type { createClaimResearchStore } from './2026-11-12-claim-store';

type PrismaCanBackStore = PrismaClient extends Parameters<typeof createClaimResearchStore>[0] ? true : false;
const prismaCanBackStore: PrismaCanBackStore = true;

test('the claim store accepts the existing Prisma client type', () => {
  assert.equal(prismaCanBackStore, true);
});

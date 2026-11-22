import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetClusters } from '@/lib/dedup/cluster';

test('resetClusters unassigns every article, then deletes every cluster row, in one transaction', async () => {
  const calls: string[] = [];
  const db = {
    $transaction: async (operations: unknown[]) => {
      calls.push(`transaction(${operations.join(',')})`);
    },
    article: {
      updateMany: (args: { where: { clusterId: { not: null } }; data: { clusterId: null } }) => {
        calls.push(`updateMany ${JSON.stringify(args)}`);
        return 'unassign';
      },
    },
    cluster: {
      deleteMany: () => {
        calls.push('deleteMany');
        return 'delete';
      },
    },
  };

  await resetClusters(db);

  assert.deepEqual(calls, [
    'updateMany {"where":{"clusterId":{"not":null}},"data":{"clusterId":null}}',
    'deleteMany',
    'transaction(unassign,delete)',
  ]);
});

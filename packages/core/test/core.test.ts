import assert from 'node:assert/strict';
import test from 'node:test';
import { createSuperGooseCore, SuperGooseError } from '../src';

test('SuperGooseCore starts with a minimal health snapshot', () => {
  const core = createSuperGooseCore({
    now: () => new Date('2026-08-10T00:00:00.000Z')
  });

  const health = core.health();

  assert.equal(health.ok, true);
  assert.equal(health.service, 'supergoose-core');
  assert.equal(health.version, '0.0.1');
  assert.equal(health.timestamp, '2026-08-10T00:00:00.000Z');
  assert.equal(health.mongodb, undefined);
});

test('SuperGooseCore can merge infrastructure health into its snapshot', () => {
  const core = createSuperGooseCore({
    now: () => new Date('2026-08-10T00:00:00.000Z')
  });

  const health = core.health({
    mongodb: {
      status: 'connected',
      databaseName: 'supergoose'
    }
  });

  assert.deepEqual(health.mongodb, {
    status: 'connected',
    databaseName: 'supergoose'
  });
});

test('SuperGooseCore rejects reserved collections', async () => {
  const store = {
    async ensureCollection() {
      return undefined;
    },
    async findOne() {
      return null;
    },
    async findMany() {
      return {
        documents: [],
        total: 0,
        limit: 0,
        skip: 0
      };
    },
    async insertOne() {
      return { _id: '000000000000000000000001' };
    },
    async replaceOne() {
      return null;
    },
    async updateOne() {
      return null;
    },
    async deleteOne() {
      return false;
    }
  };

  const core = createSuperGooseCore();
  core.setDocumentStore(store);

  await assert.rejects(
    () =>
      core.createDocument('api_keys', {
        name: 'hidden'
      }),
    (error: unknown) => error instanceof SuperGooseError && error.code === 'ReservedCollection'
  );
});

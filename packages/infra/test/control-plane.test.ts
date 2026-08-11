import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { createMongoConnectionManager, createMongoControlPlane, type MongoClientLike } from '../src';

type MemoryDatabaseState = Map<string, unknown[]>;

/**
 * Normalizes an `_id` value to a string for comparisons in the memory store.
 */
function stringifyId(value: unknown): string {
  if (value instanceof ObjectId) {
    return value.toHexString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
}

/**
 * Creates a minimal in-memory Mongo client for control-plane tests.
 */
function createMemoryMongoClient(state: Map<string, MemoryDatabaseState>): MongoClientLike {
  return {
    async connect() {
      return this;
    },
    async close() {
      return undefined;
    },
    db(databaseName = 'default') {
      const dbState = state.get(databaseName) ?? new Map<string, unknown[]>();
      state.set(databaseName, dbState);

      return {
        collection(collectionName: string) {
          const documents = dbState.get(collectionName) ?? [];
          dbState.set(collectionName, documents);

          return {
            async findOne(filter: { _id?: unknown }) {
              const id = filter._id ? stringifyId(filter._id) : undefined;
              const document = documents.find((entry) => id !== undefined && stringifyId((entry as { _id?: unknown })._id) === id);
              return document ?? null;
            },
            find(filter: Record<string, unknown>) {
              const matching = documents.filter((entry) =>
                Object.entries(filter).every(([key, value]) => (entry as Record<string, unknown>)[key] === value)
              );

              return {
                async toArray() {
                  return matching;
                }
              };
            },
            async insertOne(document: Record<string, unknown>) {
              documents.push(document);
              return { insertedId: (document as { _id?: unknown })._id ?? new ObjectId() };
            },
            async replaceOne(filter: { _id?: unknown }, document: Record<string, unknown>) {
              const id = filter._id ? stringifyId(filter._id) : undefined;
              const index = documents.findIndex((entry) => id !== undefined && stringifyId((entry as { _id?: unknown })._id) === id);

              if (index < 0) {
                return { matchedCount: 0 };
              }

              documents[index] = document;
              return { matchedCount: 1 };
            },
            async updateOne(filter: { _id?: unknown }, update: { $set: Record<string, unknown> }) {
              const id = filter._id ? stringifyId(filter._id) : undefined;
              const existing = documents.find((entry) => id !== undefined && stringifyId((entry as { _id?: unknown })._id) === id);

              if (!existing) {
                return { matchedCount: 0 };
              }

              Object.assign(existing as Record<string, unknown>, update.$set);
              return { matchedCount: 1 };
            },
            async deleteOne(filter: { _id?: unknown }) {
              const id = filter._id ? stringifyId(filter._id) : undefined;
              const index = documents.findIndex((entry) => id !== undefined && stringifyId((entry as { _id?: unknown })._id) === id);

              if (index < 0) {
                return { deletedCount: 0 };
              }

              documents.splice(index, 1);
              return { deletedCount: 1 };
            }
          };
        },
        async createCollection(name: string) {
          if (!dbState.has(name)) {
            dbState.set(name, []);
          }
        },
        listCollections(filter?: { name?: string }) {
          const hasName = filter?.name ? dbState.has(filter.name) : dbState.size > 0;

          return {
            async hasNext() {
              return hasName;
            }
          };
        }
      };
    }
  };
}

test('MongoControlPlane creates and resolves API keys inside the same cluster', async () => {
  const state = new Map<string, MemoryDatabaseState>();
  const mongo = createMongoConnectionManager({
    mongoClientFactory: () => createMemoryMongoClient(state)
  });

  await mongo.connect({
    mongoDbUri: 'mongodb://localhost:27017/supergoose',
    databaseName: 'project_alpha'
  });

  const controlPlane = createMongoControlPlane(mongo, 'supergoose_control', () => new Date('2026-08-10T00:00:00.000Z'));
  const project = await controlPlane.createProject({
    name: 'Alpha',
    slug: 'alpha',
    databaseName: 'project_alpha'
  });
  const apiKey = await controlPlane.createApiKey({
    projectId: project._id,
    databaseName: project.databaseName
  });

  const tenant = await controlPlane.resolveTenant(apiKey.key);

  assert.ok(tenant);
  assert.equal(tenant?.projectId, project._id);
  assert.equal(tenant?.databaseName, 'project_alpha');
  assert.equal(tenant?.project.slug, 'alpha');
  assert.equal(tenant?.apiKey.keyPrefix, apiKey.record.keyPrefix);

  const revoked = await controlPlane.revokeApiKey(apiKey.record._id);
  assert.equal(revoked?.revokedAt, '2026-08-10T00:00:00.000Z');

  const afterRevocation = await controlPlane.resolveTenant(apiKey.key);
  assert.equal(afterRevocation, null);
});

test('MongoControlPlane lists only safe API key metadata', async () => {
  const state = new Map<string, MemoryDatabaseState>();
  const mongo = createMongoConnectionManager({
    mongoClientFactory: () => createMemoryMongoClient(state)
  });

  await mongo.connect({
    mongoDbUri: 'mongodb://localhost:27017/supergoose',
    databaseName: 'project_alpha'
  });

  const controlPlane = createMongoControlPlane(mongo, 'supergoose_control', () => new Date('2026-08-10T00:00:00.000Z'));
  const project = await controlPlane.createProject({
    name: 'Alpha',
    slug: 'alpha',
    databaseName: 'project_alpha'
  });
  await controlPlane.createApiKey({
    projectId: project._id,
    databaseName: project.databaseName
  });

  const apiKeys = await controlPlane.listApiKeys(project._id);

  assert.equal(apiKeys.length, 1);
  assert.deepEqual(apiKeys[0], {
    _id: apiKeys[0]._id,
    projectId: project._id,
    databaseName: 'project_alpha',
    keyPrefix: apiKeys[0].keyPrefix,
    scopes: ['documents:*'],
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z'
  });
  assert.ok(!('keyHash' in apiKeys[0]));
  assert.ok(!('keySalt' in apiKeys[0]));
});

test('MongoControlPlane rotates API keys and revokes the previous secret', async () => {
  const state = new Map<string, MemoryDatabaseState>();
  const mongo = createMongoConnectionManager({
    mongoClientFactory: () => createMemoryMongoClient(state)
  });

  await mongo.connect({
    mongoDbUri: 'mongodb://localhost:27017/supergoose',
    databaseName: 'project_alpha'
  });

  const controlPlane = createMongoControlPlane(mongo, 'supergoose_control', () => new Date('2026-08-10T00:00:00.000Z'));
  const project = await controlPlane.createProject({
    name: 'Alpha',
    slug: 'alpha',
    databaseName: 'project_alpha'
  });
  const original = await controlPlane.createApiKey({
    projectId: project._id,
    databaseName: project.databaseName
  });

  const rotated = await controlPlane.rotateApiKey(project._id);

  assert.notEqual(rotated.key, original.key);
  assert.equal(rotated.record.projectId, project._id);
  assert.equal(rotated.record.databaseName, 'project_alpha');
  assert.equal(rotated.record.scopes[0], 'documents:*');

  const oldTenant = await controlPlane.resolveTenant(original.key);
  assert.equal(oldTenant, null);

  const newTenant = await controlPlane.resolveTenant(rotated.key);
  assert.ok(newTenant);
  assert.equal(newTenant?.projectId, project._id);

  const apiKeys = await controlPlane.listApiKeys(project._id);
  assert.equal(apiKeys.length, 2);
  assert.ok(apiKeys.some((apiKeyRecord) => apiKeyRecord.revokedAt));
  assert.ok(apiKeys.some((apiKeyRecord) => !apiKeyRecord.revokedAt));
});

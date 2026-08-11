import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app';
import { createTenantAuthMiddleware } from '../src/auth';
import { createProjectRouter } from '../src/routes/projects';
import { createSuperGooseCore } from '../../core/src/core';
import { createMongoConnectionManager, type MongoClientLike } from '../../infra/src/mongo';
import { createMongoControlPlane, type MongoControlPlane } from '../../infra/src/control-plane';

type MemoryDatabaseState = Map<string, unknown[]>;

function stringifyId(value: unknown): string {
  if (value instanceof ObjectId) {
    return value.toHexString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

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
            find(filter: Record<string, unknown>, options?: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> }) {
              const matching = documents.filter((entry) =>
                Object.entries(filter).every(([key, value]) => (entry as Record<string, unknown>)[key] === value)
              );

              const sorted = options?.sort
                ? [...matching].sort((left, right) => {
                    for (const [field, direction] of Object.entries(options.sort ?? {})) {
                      const diff = compareValues(
                        (left as Record<string, unknown>)[field],
                        (right as Record<string, unknown>)[field]
                      );

                      if (diff !== 0) {
                        return diff * direction;
                      }
                    }

                    return 0;
                  })
                : matching;

              const start = options?.skip ?? 0;
              const end = options?.limit !== undefined ? start + options.limit : undefined;
              const sliced = sorted.slice(start, end);

              return {
                async toArray() {
                  return sliced;
                }
              };
            },
            async insertOne(document: Record<string, unknown>) {
              const insertedId = stringifyId((document as { _id?: unknown })._id ?? new ObjectId());
              documents.push({
                ...document,
                _id: insertedId
              });
              return { insertedId };
            },
            async replaceOne(filter: { _id?: unknown }, document: Record<string, unknown>) {
              const id = filter._id ? stringifyId(filter._id) : undefined;
              const index = documents.findIndex((entry) => id !== undefined && stringifyId((entry as { _id?: unknown })._id) === id);

              if (index < 0) {
                return { matchedCount: 0 };
              }

              documents[index] = {
                ...document,
                _id: id
              };
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

interface IntegrationFixture {
  baseUrl: string;
  controlPlane: {
    listApiKeys(projectId: string): Promise<Array<{ revokedAt?: string; keyPrefix: string; keyHash?: string; keySalt?: string }>>;
    rotateApiKey(projectId: string, scopes?: string[]): Promise<{ key: string }>;
  };
  close(): Promise<void>;
}

async function createIntegrationFixture(): Promise<IntegrationFixture> {
  const state = new Map<string, MemoryDatabaseState>();
  const mongo = createMongoConnectionManager({
    mongoClientFactory: () => createMemoryMongoClient(state)
  });

  await mongo.connect({
    mongoDbUri: 'mongodb://localhost:27017/supergoose',
    databaseName: 'supergoose_control'
  });

  const core = createSuperGooseCore({
    now: () => new Date('2026-08-11T00:00:00.000Z')
  });
  const controlPlane: MongoControlPlane = createMongoControlPlane(mongo, 'supergoose_control', () => new Date('2026-08-11T00:00:00.000Z'));
  await controlPlane.ensureCollections();

  const app = createApp(
    {
      health: () => core.health({ mongodb: mongo.health() })
    },
    mongo,
    core,
    createTenantAuthMiddleware(controlPlane),
    createProjectRouter(controlPlane)
  );

  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine integration test port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    controlPlane: {
      listApiKeys: (projectId: string) => controlPlane.listApiKeys(projectId),
      rotateApiKey: (projectId: string, scopes?: string[]) => controlPlane.rotateApiKey(projectId, scopes)
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      await mongo.disconnect();
    }
  };
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: unknown; text: string }> {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  });

  const text = await response.text();

  return {
    status: response.status,
    text,
    body: text ? JSON.parse(text) as unknown : undefined
  };
}

test('SuperGoose integrates auth, CRUD and tenant isolation end to end', async (t) => {
  const fixture = await createIntegrationFixture();
  t.after(async () => {
    await fixture.close();
  });

  const health = await requestJson(fixture.baseUrl, '/health');
  assert.equal(health.status, 200);
  assert.equal((health.body as { version?: string }).version, '0.0.1');

  const ready = await requestJson(fixture.baseUrl, '/ready');
  assert.equal(ready.status, 200);
  assert.equal((ready.body as { ok?: boolean }).ok, true);

  const unauthorized = await requestJson(fixture.baseUrl, '/api/warehouse/products');
  assert.equal(unauthorized.status, 401);

  const projectResponse = await requestJson(fixture.baseUrl, '/projects', {
    method: 'POST',
    body: {
      name: 'Warehouse',
      slug: 'warehouse'
    }
  });

  assert.equal(projectResponse.status, 201);
  const project = projectResponse.body as {
    project: { _id: string; databaseName: string };
    apiKey: { key: string };
  };

  const apiKey = project.apiKey.key;

  const createResponse = await requestJson(fixture.baseUrl, `/api/${project.project.databaseName}/products`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    body: {
      name: 'Campera',
      price: 199.99,
      status: 'draft'
    }
  });

  assert.equal(createResponse.status, 201);
  const created = createResponse.body as { _id: string; name: string; price: number; status: string };
  assert.equal(created.name, 'Campera');

  const listResponse = await requestJson(fixture.baseUrl, `/api/${project.project.databaseName}/products`, {
    headers: {
      'x-api-key': apiKey
    }
  });

  assert.equal(listResponse.status, 200, listResponse.text);
  const listed = listResponse.body as {
    total: number;
    documents: Array<{ _id: string; name: string; price: number; status: string }>;
  };
  assert.equal(listed.total, 1);
  assert.equal(listed.documents[0]._id, created._id);

  const getByIdResponse = await requestJson(
    fixture.baseUrl,
    `/api/${project.project.databaseName}/products/${created._id}`,
    {
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    }
  );

  assert.equal(getByIdResponse.status, 200);
  assert.equal((getByIdResponse.body as { _id?: string })._id, created._id);

  const patchResponse = await requestJson(
    fixture.baseUrl,
    `/api/${project.project.databaseName}/products/${created._id}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${apiKey}`
      },
      body: {
        status: 'published'
      }
    }
  );

  assert.equal(patchResponse.status, 200);
  assert.equal((patchResponse.body as { status?: string }).status, 'published');

  const deleteResponse = await requestJson(
    fixture.baseUrl,
    `/api/${project.project.databaseName}/products/${created._id}`,
    {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey
      }
    }
  );

  assert.equal(deleteResponse.status, 200);
  assert.deepEqual(deleteResponse.body, { deleted: true });

  const secondProjectResponse = await requestJson(fixture.baseUrl, '/projects', {
    method: 'POST',
    body: {
      name: 'Outlet',
      slug: 'outlet'
    }
  });

  assert.equal(secondProjectResponse.status, 201);
  const secondProject = secondProjectResponse.body as {
    project: { databaseName: string };
  };

  const forbiddenResponse = await requestJson(
    fixture.baseUrl,
    `/api/${secondProject.project.databaseName}/products`,
    {
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    }
  );

  assert.equal(forbiddenResponse.status, 403);
});

test('SuperGoose keeps API key metadata safe and supports rotation', async (t) => {
  const fixture = await createIntegrationFixture();
  t.after(async () => {
    await fixture.close();
  });

  const projectResponse = await requestJson(fixture.baseUrl, '/projects', {
    method: 'POST',
    body: {
      name: 'Warehouse',
      slug: 'warehouse'
    }
  });

  assert.equal(projectResponse.status, 201);
  const project = projectResponse.body as {
    project: { _id: string };
    apiKey: { key: string };
  };

  const listed = await fixture.controlPlane.listApiKeys(project.project._id);
  assert.equal(listed.length, 1);
  assert.equal((listed[0] as { key?: unknown }).key, undefined);
  assert.equal((listed[0] as { keyHash?: unknown }).keyHash, undefined);
  assert.equal((listed[0] as { keySalt?: unknown }).keySalt, undefined);

  const rotated = await fixture.controlPlane.rotateApiKey(project.project._id, ['documents:*']);
  assert.notEqual(rotated.key, project.apiKey.key);

  const afterRotate = await fixture.controlPlane.listApiKeys(project.project._id);
  assert.equal(afterRotate.length, 2);
  assert.ok(afterRotate.some((apiKey) => apiKey.revokedAt));
  assert.ok(afterRotate.some((apiKey) => !apiKey.revokedAt));
});

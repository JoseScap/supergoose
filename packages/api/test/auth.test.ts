import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createTenantAuthMiddleware } from '../src/auth';

/**
 * Creates a lightweight mock response for handler tests.
 */
function createMockResponse() {
  const result: { statusCode?: number; body?: unknown } = {};

  const res = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    }
  } as Response;

  return { res, result };
}

/**
 * Creates a spy-friendly `next` function for middleware tests.
 */
function createNextSpy() {
  const calls: unknown[] = [];

  const next = ((error?: unknown) => {
    if (error !== undefined) {
      calls.push(error);
    }
  }) as NextFunction;

  return { next, calls };
}

test('tenant auth middleware returns 401 when no key is provided', async () => {
  const { res } = createMockResponse();
  const { next, calls } = createNextSpy();

  const middleware = createTenantAuthMiddleware({
    async ensureCollections() {
      return undefined;
    },
    async resolveTenant() {
      return null;
    }
  } as never);

  await middleware({} as Request, res, next);

  assert.equal(calls.length, 1);
  assert.equal((calls[0] as Error).message, 'Missing API key');
});

test('tenant auth middleware attaches resolved tenant context', async () => {
  const { res } = createMockResponse();
  const { next, calls } = createNextSpy();
  const tenant = {
    apiKeyId: '000000000000000000000001',
    projectId: '000000000000000000000002',
    databaseName: 'project_alpha',
    scopes: ['documents:*'],
    keyPrefix: 'abcd',
    project: {
      _id: '000000000000000000000002',
      name: 'Alpha',
      slug: 'alpha',
      status: 'active',
      databaseName: 'project_alpha',
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z'
    },
    apiKey: {
      _id: '000000000000000000000001',
      projectId: '000000000000000000000002',
      databaseName: 'project_alpha',
      keyPrefix: 'abcd',
      keyHash: 'hash',
      keySalt: 'salt',
      scopes: ['documents:*'],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z'
    },
    documentStore: {
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
        return { _id: '000000000000000000000003' };
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
    }
  };

  const middleware = createTenantAuthMiddleware({
    async ensureCollections() {
      return undefined;
    },
    async resolveTenant() {
      return tenant;
    }
  } as never);

  const request = {
    header(name: string) {
      return name.toLowerCase() === 'authorization' ? 'Bearer sgk.live.abcd.secret' : undefined;
    }
  } as Request;

  await middleware(request, res, next);

  assert.equal(calls.length, 0);
  assert.equal((request as Request & { supergooseTenant?: typeof tenant }).supergooseTenant?.databaseName, 'project_alpha');
});

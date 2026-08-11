import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import {
  handleCreateProject,
  handleListProjectApiKeys,
  handleRotateProjectApiKey
} from '../src/routes/projects';

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

test('POST /projects creates a project and initial API key', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  const controlPlane = {
    async createProject(input: { name: string; slug: string; databaseName: string }) {
      assert.deepEqual(input, {
        name: 'Warehouse',
        slug: 'warehouse',
        databaseName: 'warehouse'
      });

      return {
        _id: '000000000000000000000001',
        name: 'Warehouse',
        slug: 'warehouse',
        status: 'active' as const,
        databaseName: 'warehouse',
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z'
      };
    },
    async createApiKey(input: { projectId: string; databaseName: string; scopes?: string[] }) {
      assert.deepEqual(input, {
        projectId: '000000000000000000000001',
        databaseName: 'warehouse',
        scopes: ['documents:*']
      });

      return {
        key: 'sgk.live.abcd.secret',
        record: {
          _id: '000000000000000000000002',
          projectId: '000000000000000000000001',
          databaseName: 'warehouse',
          keyPrefix: 'abcd',
          keyHash: 'hash',
          keySalt: 'salt',
          scopes: ['documents:*'],
          createdAt: '2026-08-11T00:00:00.000Z',
          updatedAt: '2026-08-11T00:00:00.000Z'
        }
      };
    }
  } as never;

  await handleCreateProject(
    {
      body: {
        name: 'Warehouse',
        slug: 'warehouse'
      }
    } as Request,
    res,
    next,
    controlPlane
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, {
    project: {
      _id: '000000000000000000000001',
      name: 'Warehouse',
      slug: 'warehouse',
      status: 'active',
      databaseName: 'warehouse',
      createdAt: '2026-08-11T00:00:00.000Z',
      updatedAt: '2026-08-11T00:00:00.000Z'
    },
    apiKey: {
      id: '000000000000000000000002',
      key: 'sgk.live.abcd.secret',
      keyPrefix: 'abcd',
      scopes: ['documents:*']
    }
  });
});

test('GET /projects/:projectId/api-keys returns metadata only', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  const controlPlane = {
    async listApiKeys(projectId: string) {
      assert.equal(projectId, '000000000000000000000001');

      return [
        {
          _id: '000000000000000000000002',
          projectId: '000000000000000000000001',
          databaseName: 'warehouse',
          keyPrefix: 'abcd',
          scopes: ['documents:*'],
          createdAt: '2026-08-11T00:00:00.000Z',
          updatedAt: '2026-08-11T00:00:00.000Z',
          revokedAt: '2026-08-11T00:05:00.000Z'
        }
      ];
    }
  } as never;

  await handleListProjectApiKeys(
    {
      params: { projectId: '000000000000000000000001' }
    } as Request,
    res,
    next,
    controlPlane
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    projectId: '000000000000000000000001',
    apiKeys: [
      {
        id: '000000000000000000000002',
        projectId: '000000000000000000000001',
        databaseName: 'warehouse',
        keyPrefix: 'abcd',
        scopes: ['documents:*'],
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z',
        revokedAt: '2026-08-11T00:05:00.000Z'
      }
    ]
  });
});

test('POST /projects/:projectId/api-keys/rotate returns a fresh secret once', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  const controlPlane = {
    async rotateApiKey(projectId: string, scopes?: string[]) {
      assert.equal(projectId, '000000000000000000000001');
      assert.equal(scopes, undefined);

      return {
        key: 'sgk.live.new.secret',
        record: {
          _id: '000000000000000000000003',
          projectId: '000000000000000000000001',
          databaseName: 'warehouse',
          keyPrefix: 'wxyz',
          keyHash: 'hash',
          keySalt: 'salt',
          scopes: ['documents:*'],
          createdAt: '2026-08-11T00:10:00.000Z',
          updatedAt: '2026-08-11T00:10:00.000Z'
        }
      };
    }
  } as never;

  await handleRotateProjectApiKey(
    {
      params: { projectId: '000000000000000000000001' },
      body: {}
    } as Request,
    res,
    next,
    controlPlane
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, {
    projectId: '000000000000000000000001',
    apiKey: {
      id: '000000000000000000000003',
      key: 'sgk.live.new.secret',
      keyPrefix: 'wxyz',
      scopes: ['documents:*']
    }
  });
});

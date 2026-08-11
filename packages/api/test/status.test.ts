import assert from 'node:assert/strict';
import test from 'node:test';
import { handleHealth, handleReady } from '../src/routes/health';
import type { Request, Response, NextFunction } from 'express';

/**
 * Creates a lightweight mock response for handler tests.
 */
function createMockResponse() {
  const result: {
    statusCode?: number;
    body?: unknown;
  } = {};

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

test('GET /health returns core and mongo status', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleHealth({} as Request, res, next, {
    health() {
      return {
        ok: true,
        service: 'supergoose-core',
        version: '0.0.1',
        timestamp: '2026-08-10T00:00:00.000Z',
        mongodb: {
          status: 'connected',
          databaseName: 'supergoose'
        }
      };
    }
  });

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    ok: true,
    service: 'supergoose-core',
    version: '0.0.1',
    timestamp: '2026-08-10T00:00:00.000Z',
    mongodb: {
      status: 'connected',
      databaseName: 'supergoose'
    }
  });
});

test('GET /ready returns ready when Mongo is connected', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleReady({} as Request, res, next, {
    health() {
      return {
        status: 'connected',
        databaseName: 'supergoose'
      };
    },
    isConnected() {
      return true;
    }
  });

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    ok: true,
    status: 'ready',
    mongodb: {
      status: 'connected',
      databaseName: 'supergoose'
    }
  });
});

test('GET /ready returns not ready when Mongo is disconnected', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleReady({} as Request, res, next, {
    health() {
      return {
        status: 'disconnected'
      };
    },
    isConnected() {
      return false;
    }
  });

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.body, {
    ok: false,
    status: 'not_ready',
    mongodb: {
      status: 'disconnected'
    }
  });
});

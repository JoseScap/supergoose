import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApiError } from '../src/errors';
import {
  handleCreateDocument,
  handleDeleteDocument,
  handleGetDocument,
  handleListDocuments,
  handlePatchDocument,
  handleReplaceDocument,
  parseCollectionQuery
} from '../src/routes/resources';
import { SuperGooseError } from 'supergoose-core';
import type { Request, Response, NextFunction } from 'express';
import type { ApiDocumentRecord, SuperGooseDataPort } from '../src/types';

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

/**
 * Builds a minimal data port with overridable method implementations.
 */
function createDataPort(overrides: Partial<SuperGooseDataPort> = {}): SuperGooseDataPort {
  const base: SuperGooseDataPort = {
    async listDocuments() {
      return {
        documents: [],
        total: 0,
        limit: 0,
        skip: 0
      };
    },
    async getDocumentById() {
      return { _id: '000000000000000000000001' } as ApiDocumentRecord;
    },
    async createDocument() {
      return { _id: '000000000000000000000001' } as ApiDocumentRecord;
    },
    async replaceDocument() {
      return { _id: '000000000000000000000001' } as ApiDocumentRecord;
    },
    async patchDocument() {
      return { _id: '000000000000000000000001' } as ApiDocumentRecord;
    },
    async deleteDocument() {
      return { deleted: true };
    }
  };

  return {
    ...base,
    ...overrides
  };
}

test('parseCollectionQuery normalizes safe filter and paging params', () => {
  const query = parseCollectionQuery({
    status: 'published',
    active: 'true',
    count: '3',
    limit: '10',
    skip: '5',
    sort: '-order,name'
  });

  assert.deepEqual(query, {
    filter: {
      status: 'published',
      active: true,
      count: 3
    },
    limit: 10,
    skip: 5,
    sort: {
      order: -1,
      name: 1
    }
  });
});

test('parseCollectionQuery rejects dangerous keys', () => {
  assert.throws(
    () =>
      parseCollectionQuery({
        '$where': 'sleep(1)'
      }),
    (error: unknown) => error instanceof SuperGooseError && error.code === 'InvalidQuery'
  );
});

test('GET /api/:project/:collection forwards parsed query to the core', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();
  const port = createDataPort({
    async listDocuments(collection, query) {
      assert.equal(collection, 'widgets');
      assert.deepEqual(query, {
        filter: {
          status: 'published',
          active: true,
          count: 3
        },
        limit: 10,
        skip: 5,
        sort: {
          order: -1
        }
      });

      return {
        documents: [],
        total: 0,
        limit: 10,
        skip: 5
      };
    }
  });

  await handleListDocuments(
    {
      params: { project: 'project_alpha', collection: 'widgets' },
      query: {
        status: 'published',
        active: 'true',
        count: '3',
        limit: '10',
        skip: '5',
        sort: '-order'
      }
    } as Request,
    res,
    next,
    port
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    documents: [],
    total: 0,
    limit: 10,
    skip: 5
  });
});

test('POST /api/:collection validates payload and returns 201', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();
  const port = createDataPort({
    async createDocument(collection, payload) {
      assert.equal(collection, 'widgets');
      assert.deepEqual(payload, {
        name: 'Widget',
        active: true
      });

      return {
        _id: '000000000000000000000099',
        name: 'Widget',
        active: true
      };
    }
  });

  await handleCreateDocument(
    {
      params: { project: 'project_alpha', collection: 'widgets' },
      body: {
        name: 'Widget',
        active: true
      }
    } as Request,
    res,
    next,
    port
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, {
    _id: '000000000000000000000099',
    name: 'Widget',
    active: true
  });
});

test('POST /api/:project/:collection allows creating a new collection', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();
  const port = createDataPort({
    async createDocument(collection, payload) {
      assert.equal(collection, 'products');
      assert.deepEqual(payload, {
        name: 'Campera',
        price: 199.99
      });

      return {
        _id: '000000000000000000000111',
        name: 'Campera',
        price: 199.99
      };
    }
  });

  await handleCreateDocument(
    {
      params: { project: 'project_alpha', collection: 'products' },
      body: {
        name: 'Campera',
        price: 199.99
      }
    } as Request,
    res,
    next,
    port
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, {
    _id: '000000000000000000000111',
    name: 'Campera',
    price: 199.99
  });
});

test('POST /api/:project/:collection rejects dangerous payload fields', async () => {
  const { res } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleCreateDocument(
    {
      params: { project: 'project_alpha', collection: 'products' },
      body: {
        name: 'Campera',
        meta: {
          $where: 'sleep(1)'
        }
      }
    } as Request,
    res,
    next,
    createDataPort()
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0] instanceof SuperGooseError);
  assert.equal((calls[0] as SuperGooseError).code, 'InvalidPayload');
});

test('POST /api/:project/:collection rejects reserved internal collections', async () => {
  const { res } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleCreateDocument(
    {
      params: { project: 'project_alpha', collection: 'api_keys' },
      body: {
        name: 'Campera'
      }
    } as Request,
    res,
    next,
    createDataPort()
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0] instanceof SuperGooseError);
  assert.equal((calls[0] as SuperGooseError).code, 'ReservedCollection');
  assert.equal((calls[0] as SuperGooseError).statusCode, 403);
});

test('GET /api/:project/:collection/:id rejects invalid ObjectId values', async () => {
  const { res } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleGetDocument(
    {
      params: { project: 'project_alpha', collection: 'widgets', id: 'bad-id' }
    } as Request,
    res,
    next,
    createDataPort()
  );

  assert.equal(calls.length, 1);
  assert.ok(calls[0] instanceof SuperGooseError);
  assert.equal((calls[0] as SuperGooseError).code, 'InvalidObjectId');
});

test('PUT /api/:project/:collection/:id returns updated document', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleReplaceDocument(
    {
      params: { project: 'project_alpha', collection: 'widgets', id: '000000000000000000000001' },
      body: {
        name: 'Widget v2'
      }
    } as Request,
    res,
    next,
    createDataPort({
      async replaceDocument() {
        return {
          _id: '000000000000000000000001',
          name: 'Widget v2'
        };
      }
    })
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    _id: '000000000000000000000001',
    name: 'Widget v2'
  });
});

test('PATCH /api/:project/:collection/:id returns updated document', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handlePatchDocument(
    {
      params: { project: 'project_alpha', collection: 'widgets', id: '000000000000000000000001' },
      body: {
        active: false
      }
    } as Request,
    res,
    next,
    createDataPort({
      async patchDocument() {
        return {
          _id: '000000000000000000000001',
          active: false
        };
      }
    })
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    _id: '000000000000000000000001',
    active: false
  });
});

test('DELETE /api/:project/:collection/:id returns deletion confirmation', async () => {
  const { res, result } = createMockResponse();
  const { next, calls } = createNextSpy();

  await handleDeleteDocument(
    {
      params: { project: 'project_alpha', collection: 'widgets', id: '000000000000000000000001' }
    } as Request,
    res,
    next,
    createDataPort({
      async deleteDocument() {
        return { deleted: true };
      }
    })
  );

  assert.equal(calls.length, 0);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    deleted: true
  });
});

test('API error handler maps Core errors to HTTP responses', () => {
  const { res, result } = createMockResponse();

  handleApiError(
    new SuperGooseError('Collection not found: widgets', 'CollectionNotFound', 404),
    {} as Request,
    res,
    (() => undefined) as NextFunction
  );

  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.body, {
    error: 'CollectionNotFound',
    message: 'Collection not found: widgets'
  });
});

test('API error handler does not leak internal error details on 500s', () => {
  const { res, result } = createMockResponse();

  handleApiError(
    new Error('mongodb+srv://user:pass@cluster.example.com/db'),
    {} as Request,
    res,
    (() => undefined) as NextFunction
  );

  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, {
    error: 'InternalServerError',
    message: 'Internal Server Error'
  });
});

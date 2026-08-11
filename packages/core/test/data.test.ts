import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DatabaseDisconnectedError,
  DocumentNotFoundError,
  InvalidObjectIdError
} from '../src/errors';
import { createSuperGooseCore } from '../src/core';
import type { DocumentData, DocumentListQuery, DocumentListResult, DocumentRecord, DocumentStore } from '../src/data';

type CollectionState = Record<string, DocumentRecord[]>;

/**
 * Creates a record with a stable ObjectId-shaped identifier.
 */
function createRecord(id: string, data: DocumentData = {}): DocumentRecord {
  return {
    _id: id,
    ...data
  };
}

/**
 * Clones a document record so mutations do not leak between assertions.
 */
function cloneRecord(record: DocumentRecord): DocumentRecord {
  return {
    ...record
  };
}

/**
 * Creates an in-memory document store used by core tests.
 */
function createInMemoryStore(initialCollections: CollectionState = {}): DocumentStore & { lastQuery?: DocumentListQuery } {
  const collections: CollectionState = Object.fromEntries(
    Object.entries(initialCollections).map(([collectionName, documents]) => [
      collectionName,
      documents.map((document) => cloneRecord(document))
    ])
  );

  const store: DocumentStore & { lastQuery?: DocumentListQuery } = {
    lastQuery: undefined,
    async ensureCollection(collectionName: string) {
      collections[collectionName] ??= [];
    },
    async findOne(collectionName: string, objectId: string) {
      const documents = collections[collectionName];
      const document = documents?.find((entry) => entry._id === objectId);
      return document ? cloneRecord(document) : null;
    },
    async findMany(collectionName: string, query: DocumentListQuery = {}) {
      store.lastQuery = query;
      const documents = collections[collectionName] ?? [];
      const filtered = documents.filter((document) => {
        const filter = query.filter ?? {};
        return Object.entries(filter).every(([key, value]) => document[key] === value);
      });

      const sorted = query.sort
        ? [...filtered].sort((left, right) => {
            for (const [field, direction] of Object.entries(query.sort ?? {})) {
              const leftValue = left[field];
              const rightValue = right[field];

              if (leftValue === rightValue) {
                continue;
              }

              if (leftValue === undefined) {
                return -1 * direction;
              }

              if (rightValue === undefined) {
                return direction;
              }

              if (leftValue < rightValue) {
                return -1 * direction;
              }

              if (leftValue > rightValue) {
                return direction;
              }
            }

            return 0;
          })
        : filtered;

      const skip = query.skip ?? 0;
      const limit = query.limit ?? sorted.length;
      const documentsPage = sorted.slice(skip, skip + limit).map((document) => cloneRecord(document));

      return {
        documents: documentsPage,
        total: filtered.length,
        limit,
        skip
      };
    },
    async insertOne(collectionName: string, document: DocumentData) {
      const documents = collections[collectionName] ?? (collections[collectionName] = []);

      const nextId = String(documents.length + 1).padStart(24, '0');
      const record = createRecord(nextId, document);
      documents.push(record);

      return cloneRecord(record);
    },
    async replaceOne(collectionName: string, objectId: string, document: DocumentData) {
      const documents = collections[collectionName];
      const index = documents?.findIndex((entry) => entry._id === objectId) ?? -1;

      if (index < 0 || !documents) {
        return null;
      }

      const record = createRecord(objectId, document);
      documents[index] = record;
      return cloneRecord(record);
    },
    async updateOne(collectionName: string, objectId: string, patch: DocumentData) {
      const documents = collections[collectionName];
      const existing = documents?.find((entry) => entry._id === objectId);

      if (!existing || !documents) {
        return null;
      }

      Object.assign(existing, patch);
      return cloneRecord(existing);
    },
    async deleteOne(collectionName: string, objectId: string) {
      const documents = collections[collectionName];
      const index = documents?.findIndex((entry) => entry._id === objectId) ?? -1;

      if (index < 0 || !documents) {
        return false;
      }

      documents.splice(index, 1);
      return true;
    }
  };

  return store;
}

test('core throws when no document store is attached', async () => {
  const core = createSuperGooseCore();

  await assert.rejects(
    () => core.listDocuments('widgets'),
    (error: unknown) => error instanceof DatabaseDisconnectedError
  );
});

test('core validates ObjectId values before reading', async () => {
  const store = createInMemoryStore({
    widgets: [createRecord('000000000000000000000001', { name: 'widget-a' })]
  });
  const core = createSuperGooseCore();
  core.setDocumentStore(store);

  await assert.rejects(
    () => core.getDocumentById('widgets', 'invalid'),
    (error: unknown) => error instanceof InvalidObjectIdError
  );
});

test('core creates missing collections before listing them', async () => {
  const store = createInMemoryStore();
  const core = createSuperGooseCore();
  core.setDocumentStore(store);

  const list = await core.listDocuments('widgets');

  assert.deepEqual(list, {
    documents: [],
    total: 0,
    limit: 100,
    skip: 0
  });
});

test('core reads, creates, updates, patches and deletes documents generically', async () => {
  const store = createInMemoryStore({
    widgets: [createRecord('000000000000000000000001', { name: 'widget-a', status: 'draft', order: 2 }), createRecord('000000000000000000000002', { name: 'widget-b', status: 'published', order: 1 })]
  });
  const core = createSuperGooseCore();
  core.setDocumentStore(store);

  const found = await core.getDocumentById('widgets', '000000000000000000000001');
  assert.deepEqual(found, {
    _id: '000000000000000000000001',
    name: 'widget-a',
    status: 'draft',
    order: 2
  });

  const list = await core.listDocuments('widgets', {
    filter: { status: 'published' },
    limit: 1,
    skip: 0,
    sort: { order: 1 }
  });

  assert.deepEqual(list, {
    documents: [
      {
        _id: '000000000000000000000002',
        name: 'widget-b',
        status: 'published',
        order: 1
      }
    ],
    total: 1,
    limit: 1,
    skip: 0
  });
  assert.deepEqual(store.lastQuery, {
    filter: { status: 'published' },
    limit: 1,
    skip: 0,
    sort: { order: 1 }
  });

  const created = await core.createDocument('widgets', {
    name: 'widget-c',
    status: 'draft'
  });

  assert.equal(created.name, 'widget-c');
  assert.equal(created.status, 'draft');
  assert.equal(created._id.length, 24);

  const createdInNewCollection = await core.createDocument('gadgets', {
    name: 'gadget-a'
  });

  assert.equal(createdInNewCollection.name, 'gadget-a');
  assert.equal(createdInNewCollection._id.length, 24);

  const replaced = await core.replaceDocument('widgets', '000000000000000000000001', {
    name: 'widget-a-2',
    status: 'archived'
  });

  assert.deepEqual(replaced, {
    _id: '000000000000000000000001',
    name: 'widget-a-2',
    status: 'archived'
  });

  const patched = await core.patchDocument('widgets', '000000000000000000000001', {
    status: 'live'
  });

  assert.deepEqual(patched, {
    _id: '000000000000000000000001',
    name: 'widget-a-2',
    status: 'live'
  });

  const deleted = await core.deleteDocument('widgets', '000000000000000000000002');
  assert.deepEqual(deleted, { deleted: true });

  await assert.rejects(
    () => core.getDocumentById('widgets', '000000000000000000000002'),
    (error: unknown) => error instanceof DocumentNotFoundError
  );
});

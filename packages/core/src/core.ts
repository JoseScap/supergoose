import {
  DatabaseDisconnectedError,
  DocumentNotFoundError,
  InvalidObjectIdError,
  SuperGooseError
} from './errors';
import type { DocumentData, DocumentListQuery, DocumentListResult, DocumentRecord, DocumentStore } from './data';
import type { InfrastructureHealthSnapshot, SuperGooseCoreHealth, SuperGooseCoreOptions } from './types';
import { assertSafeDocumentData, isDangerousKey, normalizeCollectionName } from './security';

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const DEFAULT_LIMIT = 100;

/**
 * Validates that an id string is a valid MongoDB ObjectId.
 */
function normalizeObjectId(objectId: string): string {
  const trimmed = objectId.trim();

  if (!OBJECT_ID_PATTERN.test(trimmed)) {
    throw new InvalidObjectIdError(objectId);
  }

  return trimmed;
}

/**
 * Normalizes pagination parameters and rejects invalid numbers.
 */
function normalizeNumber(value: number | undefined, fallback: number, name: string): number {
  const normalized = value ?? fallback;

  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new SuperGooseError(`Invalid ${name}: ${value}`, 'InvalidQuery', 400);
  }

  return normalized;
}

/**
 * Validates sort directions and returns a normalized sort object.
 */
function normalizeSort(sort: Record<string, 1 | -1> | undefined): Record<string, 1 | -1> | undefined {
  if (!sort) {
    return undefined;
  }

  const entries = Object.entries(sort).map(([key, direction]) => {
    if (isDangerousKey(key)) {
      throw new SuperGooseError(`Invalid sort field: ${key}`, 'InvalidQuery', 400);
    }

    if (direction !== 1 && direction !== -1) {
      throw new SuperGooseError(`Invalid sort direction for ${key}: ${direction}`, 'InvalidQuery', 400);
    }

    return [key, direction] as const;
  });

  return Object.fromEntries(entries);
}

/**
 * Normalizes the list query and fills in defaults for paging.
 */
function normalizeListQuery(query: DocumentListQuery | undefined): DocumentListQuery {
  assertSafeDocumentData(query?.filter ?? {}, 'InvalidQuery');

  const normalized: DocumentListQuery = {
    filter: query?.filter ?? {},
    limit: normalizeNumber(query?.limit, DEFAULT_LIMIT, 'limit'),
    skip: normalizeNumber(query?.skip, 0, 'skip')
  };

  const sort = normalizeSort(query?.sort);

  if (sort) {
    normalized.sort = sort;
  }

  return normalized;
}

/**
 * Converts a Mongo document into the public record shape.
 */
function stripMongoId<T extends DocumentData>(document: T & { _id?: unknown }): DocumentRecord {
  const { _id, ...rest } = document;
  return {
    ...rest,
    _id: String(_id)
  } as DocumentRecord;
}

/**
 * Coordinates validation and CRUD operations for the application data model.
 */
export class SuperGooseCore {
  private documentStore: DocumentStore | undefined;

  /**
   * Creates a core instance with optional clock and version overrides.
   */
  constructor(private readonly options: SuperGooseCoreOptions = {}) {}

  /**
   * Attaches or clears the default document store used by the core.
   */
  setDocumentStore(store: DocumentStore | undefined): void {
    this.documentStore = store;
  }

  /**
   * Resolves the active document store, preferring the request-scoped store.
   */
  private getDocumentStore(store?: DocumentStore): DocumentStore {
    const resolvedStore = store ?? this.documentStore;

    if (!resolvedStore) {
      throw new DatabaseDisconnectedError();
    }

    return resolvedStore;
  }

  /**
   * Ensures the requested collection exists before using it.
   */
  private async ensureCollection(collectionName: string, store: DocumentStore): Promise<void> {
    await store.ensureCollection(collectionName);
  }

  /**
   * Returns a health snapshot for the core service.
   */
  health(snapshot?: InfrastructureHealthSnapshot): SuperGooseCoreHealth {
    const now = this.options.now ?? (() => new Date());

    return {
      ok: true,
      service: 'supergoose-core',
      version: this.options.version ?? '0.0.1',
      timestamp: now().toISOString(),
      ...(snapshot ? { mongodb: snapshot.mongodb } : {})
    };
  }

  /**
   * Lists documents from the requested collection using the active store.
   */
  async listDocuments(collectionName: string, query?: DocumentListQuery, store?: DocumentStore): Promise<DocumentListResult> {
    const resolvedStore = this.getDocumentStore(store);
    const collection = normalizeCollectionName(collectionName);
    await this.ensureCollection(collection, resolvedStore);
    return resolvedStore.findMany(collection, normalizeListQuery(query));
  }

  /**
   * Retrieves a single document by id from the requested collection.
   */
  async getDocumentById(collectionName: string, objectId: string, store?: DocumentStore): Promise<DocumentRecord> {
    const resolvedStore = this.getDocumentStore(store);
    const collection = normalizeCollectionName(collectionName);
    const id = normalizeObjectId(objectId);

    await this.ensureCollection(collection, resolvedStore);

    const document = await resolvedStore.findOne(collection, id);

    if (!document) {
      throw new DocumentNotFoundError(collection, id);
    }

    return document;
  }

  /**
   * Creates a document in the requested collection.
   */
  async createDocument(collectionName: string, document: DocumentData, store?: DocumentStore): Promise<DocumentRecord> {
    const resolvedStore = this.getDocumentStore(store);
    const collection = normalizeCollectionName(collectionName);
    assertSafeDocumentData(document, 'InvalidPayload');

    await this.ensureCollection(collection, resolvedStore);
    return resolvedStore.insertOne(collection, document);
  }

  /**
   * Replaces an existing document in the requested collection.
   */
  async replaceDocument(collectionName: string, objectId: string, document: DocumentData, store?: DocumentStore): Promise<DocumentRecord> {
    const resolvedStore = this.getDocumentStore(store);
    const collection = normalizeCollectionName(collectionName);
    const id = normalizeObjectId(objectId);
    assertSafeDocumentData(document, 'InvalidPayload');

    await this.ensureCollection(collection, resolvedStore);

    const updatedDocument = await resolvedStore.replaceOne(collection, id, document);

    if (!updatedDocument) {
      throw new DocumentNotFoundError(collection, id);
    }

    return updatedDocument;
  }

  /**
   * Applies a partial update to a document in the requested collection.
   */
  async patchDocument(collectionName: string, objectId: string, patch: DocumentData, store?: DocumentStore): Promise<DocumentRecord> {
    const resolvedStore = this.getDocumentStore(store);
    const collection = normalizeCollectionName(collectionName);
    const id = normalizeObjectId(objectId);
    assertSafeDocumentData(patch, 'InvalidPayload');

    await this.ensureCollection(collection, resolvedStore);

    const updatedDocument = await resolvedStore.updateOne(collection, id, patch);

    if (!updatedDocument) {
      throw new DocumentNotFoundError(collection, id);
    }

    return updatedDocument;
  }

  /**
   * Deletes a document from the requested collection.
   */
  async deleteDocument(collectionName: string, objectId: string, store?: DocumentStore): Promise<{ deleted: true }> {
    const resolvedStore = this.getDocumentStore(store);
    const collection = normalizeCollectionName(collectionName);
    const id = normalizeObjectId(objectId);

    await this.ensureCollection(collection, resolvedStore);

    const deleted = await resolvedStore.deleteOne(collection, id);

    if (!deleted) {
      throw new DocumentNotFoundError(collection, id);
    }

    return { deleted: true };
  }
}

/**
 * Creates a new core instance.
 */
export function createSuperGooseCore(options: SuperGooseCoreOptions = {}): SuperGooseCore {
  return new SuperGooseCore(options);
}

/**
 * Re-exports the Mongo id normalizer for consumers that need it.
 */
export { stripMongoId };

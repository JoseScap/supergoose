import { MongoClient, ObjectId, type Filter, type FindOptions, type MongoClientOptions, type OptionalId, type WithId } from 'mongodb';
import { DatabaseDisconnectedError, type DocumentData, type DocumentListQuery, type DocumentListResult, type DocumentRecord, type DocumentStore, stripMongoId } from 'supergoose-core';
import type { MongoConnectionHealth } from 'supergoose-core';

export interface MongoConnectionConfig {
  mongoDbUri: string;
  databaseName: string;
}

export interface MongoCursorLike {
  toArray(): Promise<unknown[]>;
}

export interface MongoCollectionLike {
  findOne(filter: Filter<DocumentData>): Promise<unknown | null>;
  find(filter: Filter<DocumentData>, options?: FindOptions): MongoCursorLike;
  insertOne(document: OptionalId<DocumentData>): Promise<{ insertedId: unknown }>;
  replaceOne(filter: Filter<DocumentData>, document: OptionalId<DocumentData>): Promise<{ matchedCount: number }>;
  updateOne(filter: Filter<DocumentData>, update: { $set: DocumentData }): Promise<{ matchedCount: number }>;
  deleteOne(filter: Filter<DocumentData>): Promise<{ deletedCount: number }>;
}

export interface MongoDatabaseLike {
  collection(name: string): MongoCollectionLike;
  createCollection(name: string): Promise<unknown>;
  listCollections(filter?: { name?: string }, options?: { nameOnly?: boolean }): { hasNext(): Promise<boolean> };
}

export interface MongoClientLike {
  connect(): Promise<MongoClientLike>;
  close(): Promise<void>;
  db(databaseName?: string): MongoDatabaseLike;
}

export type MongoClientFactory = (uri: string, options?: MongoClientOptions) => MongoClientLike;

export interface MongoConnectionManagerOptions {
  mongoClientFactory?: MongoClientFactory;
  mongoClientOptions?: MongoClientOptions;
}

const defaultMongoClientFactory: MongoClientFactory = (uri, options) => new MongoClient(uri, options);

/**
 * Converts a Mongo document into the public core record shape.
 */
function normalizeDocument(document: WithId<DocumentData> | DocumentData): DocumentRecord {
  return stripMongoId(document as DocumentData & { _id?: unknown });
}

/**
 * Creates a MongoDB ObjectId from a string.
 */
function toObjectId(objectId: string): ObjectId {
  return new ObjectId(objectId);
}

/**
 * Manages a single MongoDB cluster connection and exposes document-store helpers.
 */
export class MongoConnectionManager {
  private mongoClient: MongoClientLike | undefined;
  private connectionState: MongoConnectionHealth['status'] = 'disconnected';
  private databaseName: string | undefined;

  /**
   * Creates a connection manager with optional client factory overrides.
   */
  constructor(private readonly options: MongoConnectionManagerOptions = {}) {}

  /**
   * Connects the shared Mongo client to the configured cluster and database.
   */
  async connect(config: MongoConnectionConfig): Promise<void> {
    if (this.connectionState === 'connected' && this.databaseName === config.databaseName) {
      return;
    }

    if (this.mongoClient) {
      await this.disconnect();
    }

    this.connectionState = 'connecting';

    const createClient = this.options.mongoClientFactory ?? defaultMongoClientFactory;
    const client = createClient(config.mongoDbUri, this.options.mongoClientOptions);

    try {
      await client.connect();
      this.mongoClient = client;
      this.databaseName = config.databaseName;
      this.connectionState = 'connected';
    } catch (error) {
      this.mongoClient = undefined;
      this.databaseName = undefined;
      this.connectionState = 'disconnected';
      throw error;
    }
  }

  /**
   * Disconnects the shared Mongo client.
   */
  async disconnect(): Promise<void> {
    const client = this.mongoClient;

    this.mongoClient = undefined;
    this.databaseName = undefined;
    this.connectionState = 'disconnected';

    if (client) {
      await client.close();
    }
  }

  /**
   * Returns the current connection health snapshot.
   */
  health(): MongoConnectionHealth {
    return {
      status: this.connectionState,
      ...(this.databaseName ? { databaseName: this.databaseName } : {})
    };
  }

  /**
   * Returns true when the manager is connected to MongoDB.
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Returns a database handle for the connected cluster.
   */
  private getDatabase(databaseName?: string): MongoDatabaseLike {
    if (!this.mongoClient || this.connectionState !== 'connected') {
      throw new DatabaseDisconnectedError();
    }

    const resolvedDatabaseName = databaseName ?? this.databaseName;

    if (!resolvedDatabaseName) {
      throw new DatabaseDisconnectedError();
    }

    return this.mongoClient.db(resolvedDatabaseName);
  }

  /**
   * Checks whether a collection exists in the active database.
   */
  async hasCollection(collectionName: string): Promise<boolean> {
    const database = this.getDatabase();
    const cursor = database.listCollections({ name: collectionName }, { nameOnly: true });
    return cursor.hasNext();
  }

  /**
   * Creates a collection if it does not already exist.
   */
  async ensureCollection(collectionName: string): Promise<void> {
    const database = this.getDatabase();
    const exists = await this.hasCollection(collectionName);

    if (!exists) {
      await database.createCollection(collectionName);
    }
  }

  /**
   * Creates a document store bound to a specific database.
   */
  createDocumentStore(databaseName: string): DocumentStore {
    const getDatabase = () => this.getDatabase(databaseName);

    return {
      async ensureCollection(collectionName: string) {
        const database = getDatabase();
        const exists = await database.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();

        if (!exists) {
          await database.createCollection(collectionName);
        }
      },
      async findOne(collectionName: string, objectId: string) {
        const database = getDatabase();
        const collection = database.collection(collectionName);
        const document = await collection.findOne({ _id: toObjectId(objectId) });

        return document ? normalizeDocument(document as WithId<DocumentData>) : null;
      },
      async findMany(collectionName: string, query: DocumentListQuery = {}) {
        const database = getDatabase();
        const collection = database.collection(collectionName);
        const findOptions: FindOptions = {};

        if (query.limit !== undefined) {
          findOptions.limit = query.limit;
        }

        if (query.skip !== undefined) {
          findOptions.skip = query.skip;
        }

        if (query.sort !== undefined) {
          findOptions.sort = query.sort;
        }

        const cursor = collection.find(query.filter ?? {}, findOptions);
        const documents = await cursor.toArray();

        return {
          documents: documents.map((document) => normalizeDocument(document as WithId<DocumentData>)),
          total: documents.length,
          limit: query.limit ?? documents.length,
          skip: query.skip ?? 0
        };
      },
      async insertOne(collectionName: string, document: DocumentData) {
        const database = getDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.insertOne(document as OptionalId<DocumentData>);

        return {
          ...document,
          _id: String(result.insertedId)
        };
      },
      async replaceOne(collectionName: string, objectId: string, document: DocumentData) {
        const database = getDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.replaceOne({ _id: toObjectId(objectId) }, document as OptionalId<DocumentData>);

        if (result.matchedCount === 0) {
          return null;
        }

        return {
          ...document,
          _id: objectId
        };
      },
      async updateOne(collectionName: string, objectId: string, patch: DocumentData) {
        const database = getDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.updateOne({ _id: toObjectId(objectId) }, { $set: patch });

        if (result.matchedCount === 0) {
          return null;
        }

        const updatedDocument = await collection.findOne({ _id: toObjectId(objectId) });

        return updatedDocument
          ? normalizeDocument(updatedDocument as WithId<DocumentData>)
          : {
              ...patch,
              _id: objectId
            };
      },
      async deleteOne(collectionName: string, objectId: string) {
        const database = getDatabase();
        const collection = database.collection(collectionName);
        const result = await collection.deleteOne({ _id: toObjectId(objectId) });

        return result.deletedCount > 0;
      }
    };
  }

  /**
   * Reads a single document from the active database.
   */
  async findOne(collectionName: string, objectId: string): Promise<DocumentRecord | null> {
    return this.createDocumentStore(this.databaseName ?? '').findOne(collectionName, objectId);
  }

  /**
   * Lists documents from the active database.
   */
  async findMany(collectionName: string, query: DocumentListQuery = {}): Promise<DocumentListResult> {
    return this.createDocumentStore(this.databaseName ?? '').findMany(collectionName, query);
  }

  /**
   * Inserts a document into the active database.
   */
  async insertOne(collectionName: string, document: DocumentData): Promise<DocumentRecord> {
    return this.createDocumentStore(this.databaseName ?? '').insertOne(collectionName, document);
  }

  /**
   * Replaces a document in the active database.
   */
  async replaceOne(collectionName: string, objectId: string, document: DocumentData): Promise<DocumentRecord | null> {
    return this.createDocumentStore(this.databaseName ?? '').replaceOne(collectionName, objectId, document);
  }

  /**
   * Applies a partial update to a document in the active database.
   */
  async updateOne(collectionName: string, objectId: string, patch: DocumentData): Promise<DocumentRecord | null> {
    return this.createDocumentStore(this.databaseName ?? '').updateOne(collectionName, objectId, patch);
  }

  /**
   * Deletes a document from the active database.
   */
  async deleteOne(collectionName: string, objectId: string): Promise<boolean> {
    return this.createDocumentStore(this.databaseName ?? '').deleteOne(collectionName, objectId);
  }
}

/**
 * Creates a Mongo connection manager.
 */
export function createMongoConnectionManager(options: MongoConnectionManagerOptions = {}): MongoConnectionManager {
  return new MongoConnectionManager(options);
}

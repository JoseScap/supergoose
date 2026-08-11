import { ObjectId } from 'mongodb';
import type { DocumentStore } from 'supergoose-core';
import { generateApiKeyMaterial, parseApiKey, SuperGooseError, verifyApiKey } from 'supergoose-core';
import type { MongoConnectionManager } from './mongo';

export const DEFAULT_CONTROL_DATABASE_NAME = 'supergoose_control';
export const PROJECTS_COLLECTION = 'projects';
export const API_KEYS_COLLECTION = 'api_keys';
export const PROJECT_CONNECTIONS_COLLECTION = 'project_connections';

export interface ControlPlaneTimestamps {
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord extends ControlPlaneTimestamps {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  databaseName: string;
  allowedCollections?: string[];
}

export interface ApiKeyRecord extends ControlPlaneTimestamps {
  _id: string;
  projectId: string;
  databaseName: string;
  keyPrefix: string;
  keyHash: string;
  keySalt: string;
  scopes: string[];
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface ApiKeySummary extends ControlPlaneTimestamps {
  _id: string;
  projectId: string;
  databaseName: string;
  keyPrefix: string;
  scopes: string[];
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface ProjectConnectionRecord extends ControlPlaneTimestamps {
  _id: string;
  projectId: string;
  uri: string;
  databaseName: string;
  status: 'active' | 'inactive';
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  databaseName: string;
  allowedCollections?: string[];
}

export interface CreateApiKeyInput {
  projectId: string;
  databaseName: string;
  scopes?: string[];
}

export interface ResolvedTenantContext {
  apiKeyId: string;
  projectId: string;
  databaseName: string;
  scopes: string[];
  keyPrefix: string;
  project: ProjectRecord;
  apiKey: ApiKeyRecord;
  documentStore: DocumentStore;
}

/**
 * Returns the current timestamp in ISO-8601 format.
 */
function nowIso(now: () => Date = () => new Date()): string {
  return now().toISOString();
}

/**
 * Checks whether a string is a MongoDB ObjectId.
 */
function isObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

/**
 * Maps a stored API key record to a safe metadata summary.
 */
function toApiKeySummary(record: ApiKeyRecord): ApiKeySummary {
  const {
    _id,
    projectId,
    databaseName,
    keyPrefix,
    scopes,
    createdAt,
    updatedAt,
    revokedAt,
    lastUsedAt
  } = record;

  return {
    _id,
    projectId,
    databaseName,
    keyPrefix,
    scopes,
    createdAt,
    updatedAt,
    ...(revokedAt ? { revokedAt } : {}),
    ...(lastUsedAt ? { lastUsedAt } : {})
  };
}

/**
 * Coordinates control-plane storage and tenant resolution for a cluster.
 */
export class MongoControlPlane {
  /**
   * Creates a control plane bound to a Mongo connection manager and metadata database.
   */
  constructor(
    private readonly mongo: MongoConnectionManager,
    private readonly controlDatabaseName = DEFAULT_CONTROL_DATABASE_NAME,
    private readonly now: () => Date = () => new Date()
  ) {}

  /**
   * Returns the database name used for control-plane metadata.
   */
  get controlDbName(): string {
    return this.controlDatabaseName;
  }

  /**
   * Returns a document store for the control-plane database.
   */
  private get controlStore(): DocumentStore {
    return this.mongo.createDocumentStore(this.controlDatabaseName);
  }

  /**
   * Returns a document store for a project database.
   */
  private getProjectStore(databaseName: string): DocumentStore {
    return this.mongo.createDocumentStore(databaseName);
  }

  /**
   * Ensures the control-plane collections exist.
   */
  async ensureCollections(): Promise<void> {
    const store = this.controlStore;

    await store.ensureCollection(PROJECTS_COLLECTION);
    await store.ensureCollection(API_KEYS_COLLECTION);
    await store.ensureCollection(PROJECT_CONNECTIONS_COLLECTION);
  }

  /**
   * Creates a new project record in the control plane.
   */
  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    await this.ensureCollections();

    const timestamp = nowIso(this.now);
    const _id = new ObjectId();
    const record: ProjectRecord = {
      _id: _id.toHexString(),
      name: input.name,
      slug: input.slug,
      status: 'active',
      databaseName: input.databaseName,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (input.allowedCollections) {
      record.allowedCollections = input.allowedCollections;
    }

    await this.controlStore.insertOne(PROJECTS_COLLECTION, {
      ...record,
      _id
    });

    return record;
  }

  /**
   * Creates a new API key for a project and returns the plaintext key once.
   */
  async createApiKey(input: CreateApiKeyInput): Promise<{ key: string; record: ApiKeyRecord }> {
    await this.ensureCollections();

    const material = generateApiKeyMaterial();
    const timestamp = nowIso(this.now);
    const _id = new ObjectId();
    const record: ApiKeyRecord = {
      _id: _id.toHexString(),
      projectId: input.projectId,
      databaseName: input.databaseName,
      keyPrefix: material.keyPrefix,
      keyHash: material.keyHash,
      keySalt: material.keySalt,
      scopes: input.scopes ?? ['documents:*'],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.controlStore.insertOne(API_KEYS_COLLECTION, {
      ...record,
      _id
    });

    return {
      key: material.key,
      record
    };
  }

  /**
   * Lists API key metadata for a project without exposing the secret key material.
   */
  async listApiKeys(projectId: string): Promise<ApiKeySummary[]> {
    await this.ensureCollections();

    if (!isObjectId(projectId)) {
      throw new SuperGooseError(`Invalid ProjectId: ${projectId}`, 'InvalidObjectId', 400);
    }

    const project = await this.controlStore.findOne(PROJECTS_COLLECTION, projectId);

    if (!project) {
      throw new SuperGooseError(`Project not found: ${projectId}`, 'ProjectNotFound', 404);
    }

    const keys = await this.controlStore.findMany(API_KEYS_COLLECTION, {
      filter: {
        projectId
      },
      sort: {
        createdAt: -1
      },
      limit: 100
    });

    return keys.documents.map((record) => toApiKeySummary(record as unknown as ApiKeyRecord));
  }

  /**
   * Rotates the active API keys for a project and returns a fresh secret once.
   */
  async rotateApiKey(
    projectId: string,
    scopes?: string[]
  ): Promise<{ key: string; record: ApiKeyRecord }> {
    await this.ensureCollections();

    if (!isObjectId(projectId)) {
      throw new SuperGooseError(`Invalid ProjectId: ${projectId}`, 'InvalidObjectId', 400);
    }

    const project = await this.controlStore.findOne(PROJECTS_COLLECTION, projectId);

    if (!project) {
      throw new SuperGooseError(`Project not found: ${projectId}`, 'ProjectNotFound', 404);
    }

    const projectRecord = project as unknown as ProjectRecord;
    const existingKeys = await this.controlStore.findMany(API_KEYS_COLLECTION, {
      filter: {
        projectId
      },
      sort: {
        createdAt: -1
      },
      limit: 100
    });

    let effectiveScopes = scopes;

    if (!effectiveScopes || effectiveScopes.length === 0) {
      const mostRecentActiveKey = existingKeys.documents
        .map((record) => record as unknown as ApiKeyRecord)
        .find((record) => !record.revokedAt);

      effectiveScopes = mostRecentActiveKey?.scopes ?? ['documents:*'];
    }

    for (const candidate of existingKeys.documents) {
      const apiKeyRecord = candidate as unknown as ApiKeyRecord;

      if (apiKeyRecord.revokedAt) {
        continue;
      }

      const nowValue = nowIso(this.now);
      await this.controlStore.updateOne(API_KEYS_COLLECTION, apiKeyRecord._id, {
        revokedAt: nowValue,
        updatedAt: nowValue
      });
    }

    return this.createApiKey({
      projectId: projectRecord._id,
      databaseName: projectRecord.databaseName,
      scopes: effectiveScopes
    });
  }

  /**
   * Marks an API key as revoked in the control plane.
   */
  async revokeApiKey(apiKeyId: string): Promise<ApiKeyRecord | null> {
    await this.ensureCollections();

    if (!/^[a-fA-F0-9]{24}$/.test(apiKeyId)) {
      return null;
    }

    const record = await this.controlStore.findOne(API_KEYS_COLLECTION, apiKeyId);

    if (!record) {
      return null;
    }

    const nowValue = nowIso(this.now);
    const revokedRecord = await this.controlStore.updateOne(API_KEYS_COLLECTION, apiKeyId, {
      revokedAt: nowValue,
      updatedAt: nowValue
    });

    return revokedRecord as unknown as ApiKeyRecord | null;
  }

  /**
   * Resolves a request API key into a tenant context and project store.
   */
  async resolveTenant(apiKey: string): Promise<ResolvedTenantContext | null> {
    await this.ensureCollections();

    const parsed = parseApiKey(apiKey);

    if (!parsed) {
      return null;
    }

    const candidates = await this.controlStore.findMany(API_KEYS_COLLECTION, {
      filter: {
        keyPrefix: parsed.keyPrefix
      },
      limit: 50
    });

    for (const candidate of candidates.documents) {
      const apiKeyRecord = candidate as unknown as ApiKeyRecord;

      if (apiKeyRecord.revokedAt) {
        continue;
      }

      if (!verifyApiKey(apiKey, apiKeyRecord.keySalt, apiKeyRecord.keyHash)) {
        continue;
      }

      const project = await this.controlStore.findOne(PROJECTS_COLLECTION, apiKeyRecord.projectId);

      if (!project) {
        continue;
      }

      const projectRecord = project as unknown as ProjectRecord;

      if (projectRecord.status !== 'active') {
        continue;
      }

      const lastUsedAt = nowIso(this.now);
      const updatedApiKey = await this.controlStore.updateOne(API_KEYS_COLLECTION, apiKeyRecord._id, {
        lastUsedAt,
        updatedAt: lastUsedAt
      });

      return {
        apiKeyId: apiKeyRecord._id,
        projectId: apiKeyRecord.projectId,
        databaseName: apiKeyRecord.databaseName,
        scopes: apiKeyRecord.scopes,
        keyPrefix: apiKeyRecord.keyPrefix,
        project: projectRecord,
        apiKey: (updatedApiKey ?? {
          ...apiKeyRecord,
          lastUsedAt,
          updatedAt: lastUsedAt
        }) as unknown as ApiKeyRecord,
        documentStore: this.getProjectStore(apiKeyRecord.databaseName)
      };
    }

    return null;
  }
}

/**
 * Creates a control-plane helper bound to the provided Mongo manager.
 */
export function createMongoControlPlane(
  mongo: MongoConnectionManager,
  controlDatabaseName = DEFAULT_CONTROL_DATABASE_NAME,
  now?: () => Date
): MongoControlPlane {
  return new MongoControlPlane(mongo, controlDatabaseName, now);
}

import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { DocumentStore } from 'supergoose-core';
import { generateApiKeyMaterial, parseApiKey, SuperGooseError, verifyApiKey } from 'supergoose-core';
import type { MongoConnectionManager } from './mongo';

export const DEFAULT_CONTROL_DATABASE_NAME = 'supergoose_control';
export const PROJECTS_COLLECTION = 'projects';
export const API_KEYS_COLLECTION = 'api_keys';
export const PROJECT_CONNECTIONS_COLLECTION = 'project_connections';
export const ROOT_USERS_COLLECTION = 'root_users';
export const DASHBOARD_SESSIONS_COLLECTION = 'dashboard_sessions';
export const DEFAULT_DASHBOARD_SESSION_TTL_HOURS = 2;
export const MAX_DASHBOARD_SESSION_TTL_HOURS = 2;

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

export interface RootUserRecord extends ControlPlaneTimestamps {
  _id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  status: 'active' | 'inactive';
  lastLoginAt?: string;
}

export interface DashboardSessionRecord extends ControlPlaneTimestamps {
  _id: string;
  rootUserId: string;
  tokenHash: string;
  tokenSalt: string;
  ttlSeconds: number;
  expiresAt: string;
  lastSeenAt?: string;
  revokedAt?: string;
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

export interface RootUserSummary {
  _id: string;
  username: string;
  lastLoginAt?: string;
}

export interface DashboardSessionSummary {
  _id: string;
  rootUserId: string;
  ttlSeconds: number;
  expiresAt: string;
  lastSeenAt?: string;
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
 * Hashes a password with Argon2id using the provided salt.
 */
function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('base64url');
}

/**
 * Verifies a stored password hash using a derived candidate hash.
 */
function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derivedHash = hashPassword(password, salt);
  const expected = Buffer.from(expectedHash, 'base64url');
  const actual = Buffer.from(derivedHash, 'base64url');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

/**
 * Hashes a dashboard session token for safe storage.
 */
function hashSessionToken(token: string, salt: string): string {
  return createHash('sha256').update(token).update(salt).digest('base64url');
}

/**
 * Creates a compact session token string.
 */
function generateSessionToken(): { token: string; salt: string } {
  return {
    token: randomBytes(32).toString('base64url'),
    salt: randomBytes(16).toString('base64url')
  };
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
 * Maps a root user record into a safe summary.
 */
function toRootUserSummary(record: RootUserRecord): RootUserSummary {
  const { _id, username, lastLoginAt } = record;
  return {
    _id,
    username,
    ...(lastLoginAt ? { lastLoginAt } : {})
  };
}

/**
 * Maps a dashboard session into a safe summary.
 */
function toDashboardSessionSummary(record: DashboardSessionRecord): DashboardSessionSummary {
  const { _id, rootUserId, ttlSeconds, expiresAt, lastSeenAt } = record;
  return {
    _id,
    rootUserId,
    ttlSeconds,
    expiresAt,
    ...(lastSeenAt ? { lastSeenAt } : {})
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
    await store.ensureCollection(ROOT_USERS_COLLECTION);
    await store.ensureCollection(DASHBOARD_SESSIONS_COLLECTION);
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
   * Lists projects in the control plane.
   */
  async listProjects(): Promise<ProjectRecord[]> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(PROJECTS_COLLECTION, {
      sort: {
        createdAt: -1
      },
      limit: 100
    });

    return result.documents.map((record) => record as unknown as ProjectRecord);
  }

  /**
   * Finds a project by its slug.
   */
  async findProjectBySlug(slug: string): Promise<ProjectRecord | null> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(PROJECTS_COLLECTION, {
      filter: {
        slug
      },
      limit: 1
    });

    const project = result.documents[0];
    return project ? (project as unknown as ProjectRecord) : null;
  }

  /**
   * Finds a project by its id.
   */
  async findProjectById(projectId: string): Promise<ProjectRecord | null> {
    await this.ensureCollections();

    if (!isObjectId(projectId)) {
      return null;
    }

    const project = await this.controlStore.findOne(PROJECTS_COLLECTION, projectId);

    return project ? (project as unknown as ProjectRecord) : null;
  }

  /**
   * Updates a project metadata record.
   */
  async updateProject(
    projectId: string,
    updates: Partial<Pick<ProjectRecord, 'name' | 'slug' | 'status' | 'databaseName' | 'allowedCollections'>>
  ): Promise<ProjectRecord | null> {
    await this.ensureCollections();

    if (!isObjectId(projectId)) {
      return null;
    }

    const current = await this.findProjectById(projectId);

    if (!current) {
      return null;
    }

    const timestamp = nowIso(this.now);
    const nextRecord: ProjectRecord = {
      ...current,
      ...updates,
      updatedAt: timestamp
    };

    await this.controlStore.updateOne(PROJECTS_COLLECTION, projectId, {
      ...nextRecord,
      _id: current._id
    });

    return nextRecord;
  }

  /**
   * Marks a project as inactive.
   */
  async deactivateProject(projectId: string): Promise<ProjectRecord | null> {
    return this.updateProject(projectId, { status: 'inactive' });
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
   * Creates the first API key for a project if none exist yet.
   */
  async createFirstApiKey(projectId: string, scopes?: string[]): Promise<{ key: string; record: ApiKeyRecord } | null> {
    const project = await this.findProjectById(projectId);

    if (!project) {
      return null;
    }

    const existingKeys = await this.listApiKeys(projectId);

    if (existingKeys.some((record) => !record.revokedAt)) {
      throw new SuperGooseError('Project already has an API key', 'ApiKeyAlreadyExists', 409);
    }

    return this.createApiKey({
      projectId: project._id,
      databaseName: project.databaseName,
      ...(scopes ? { scopes } : {})
    });
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
   * Creates a root user in the control plane.
   */
  async createRootUser(username: string, password: string): Promise<RootUserSummary> {
    await this.ensureCollections();

    const timestamp = nowIso(this.now);
    const _id = new ObjectId();
    const passwordSalt = randomBytes(16).toString('base64url');
    const record: RootUserRecord = {
      _id: _id.toHexString(),
      username,
      passwordSalt,
      passwordHash: hashPassword(password, passwordSalt),
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.controlStore.insertOne(ROOT_USERS_COLLECTION, {
      ...record,
      _id
    });

    return toRootUserSummary(record);
  }

  /**
   * Finds a root user by username.
   */
  async findRootUserByUsername(username: string): Promise<RootUserSummary | null> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(ROOT_USERS_COLLECTION, {
      filter: {
        username
      },
      limit: 1
    });

    const user = result.documents[0] as unknown as RootUserRecord | undefined;

    return user ? toRootUserSummary(user) : null;
  }

  /**
   * Bootstraps a root user when that username does not exist yet.
   */
  async bootstrapRootUser(username: string, password: string): Promise<RootUserSummary | null> {
    await this.ensureCollections();

    const existing = await this.findRootUserByUsername(username);

    if (existing) {
      return existing;
    }

    return this.createRootUser(username, password);
  }

  /**
   * Lists root users without exposing password material.
   */
  async listRootUsers(): Promise<RootUserSummary[]> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(ROOT_USERS_COLLECTION, {
      sort: {
        createdAt: -1
      },
      limit: 100
    });

    return result.documents.map((record) => toRootUserSummary(record as unknown as RootUserRecord));
  }

  /**
   * Verifies root credentials and returns a safe user summary.
   */
  async verifyRootUserCredentials(username: string, password: string): Promise<RootUserSummary | null> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(ROOT_USERS_COLLECTION, {
      filter: {
        username
      },
      limit: 1
    });

    const candidate = result.documents[0] as unknown as RootUserRecord | undefined;

    if (!candidate || candidate.status !== 'active') {
      return null;
    }

    if (!verifyPassword(password, candidate.passwordSalt, candidate.passwordHash)) {
      return null;
    }

    const timestamp = nowIso(this.now);
    await this.controlStore.updateOne(ROOT_USERS_COLLECTION, candidate._id, {
      lastLoginAt: timestamp,
      updatedAt: timestamp
    });

    return toRootUserSummary({
      ...candidate,
      lastLoginAt: timestamp,
      updatedAt: timestamp
    });
  }

  /**
   * Creates a root dashboard session token.
   */
  async createDashboardSession(rootUserId: string, ttlHours = DEFAULT_DASHBOARD_SESSION_TTL_HOURS): Promise<{ token: string; session: DashboardSessionSummary }> {
    await this.ensureCollections();

    const user = await this.controlStore.findOne(ROOT_USERS_COLLECTION, rootUserId);

    if (!user) {
      throw new SuperGooseError('Root user not found', 'RootUserNotFound', 404);
    }

    const sessionMaterial = generateSessionToken();
    const timestamp = nowIso(this.now);
    const resolvedTtlHours = Math.min(Math.max(ttlHours, 0), MAX_DASHBOARD_SESSION_TTL_HOURS);
    const ttlSeconds = resolvedTtlHours * 60 * 60;
    const expiresAt = new Date(this.now().getTime() + ttlSeconds * 1000).toISOString();
    const _id = new ObjectId();
    const record: DashboardSessionRecord = {
      _id: _id.toHexString(),
      rootUserId,
      tokenHash: hashSessionToken(sessionMaterial.token, sessionMaterial.salt),
      tokenSalt: sessionMaterial.salt,
      ttlSeconds,
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.controlStore.insertOne(DASHBOARD_SESSIONS_COLLECTION, {
      ...record,
      _id
    });

    return {
      token: sessionMaterial.token,
      session: toDashboardSessionSummary(record)
    };
  }

  /**
   * Resolves a dashboard session token into a root user summary.
   */
  async resolveDashboardSession(token: string): Promise<RootUserSummary | null> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(DASHBOARD_SESSIONS_COLLECTION, {
      limit: 100
    });

    for (const candidate of result.documents) {
      const session = candidate as unknown as DashboardSessionRecord;

      if (session.revokedAt) {
        continue;
      }

      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        continue;
      }

      if (hashSessionToken(token, session.tokenSalt) !== session.tokenHash) {
        continue;
      }

      const user = await this.controlStore.findOne(ROOT_USERS_COLLECTION, session.rootUserId);

      if (!user) {
        continue;
      }

      const rootUser = user as unknown as RootUserRecord;

      if (rootUser.status !== 'active') {
        continue;
      }

      const timestamp = nowIso(this.now);
      await this.controlStore.updateOne(DASHBOARD_SESSIONS_COLLECTION, session._id, {
        lastSeenAt: timestamp,
        updatedAt: timestamp
      });

      return toRootUserSummary(rootUser);
    }

    return null;
  }

  /**
   * Revokes a dashboard session token.
   */
  async revokeDashboardSession(token: string): Promise<boolean> {
    await this.ensureCollections();

    const result = await this.controlStore.findMany(DASHBOARD_SESSIONS_COLLECTION, {
      limit: 100
    });

    for (const candidate of result.documents) {
      const session = candidate as unknown as DashboardSessionRecord;

      if (session.revokedAt) {
        continue;
      }

      if (hashSessionToken(token, session.tokenSalt) !== session.tokenHash) {
        continue;
      }

      const timestamp = nowIso(this.now);
      await this.controlStore.updateOne(DASHBOARD_SESSIONS_COLLECTION, session._id, {
        revokedAt: timestamp,
        updatedAt: timestamp
      });
      return true;
    }

    return false;
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

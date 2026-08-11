import { Router, type NextFunction, type Request, type Response } from 'express';
import { SuperGooseError } from 'supergoose-core';
import type { MongoControlPlane } from 'supergoose-infra';

interface CreateProjectBody {
  name?: unknown;
  slug?: unknown;
  databaseName?: unknown;
  scopes?: unknown;
}

interface RotateApiKeyBody {
  scopes?: unknown;
}

interface CreateProjectResponse {
  project: unknown;
  apiKey: {
    id: string;
    key: string;
    keyPrefix: string;
    scopes: string[];
  };
}

interface ApiKeyMetadataResponse {
  id: string;
  projectId: string;
  databaseName: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

interface ListApiKeysResponse {
  projectId: string;
  apiKeys: ApiKeyMetadataResponse[];
}

interface RotateApiKeyResponse {
  projectId: string;
  apiKey: {
    id: string;
    key: string;
    keyPrefix: string;
    scopes: string[];
  };
}

/**
 * Validates the incoming project creation payload.
 */
function validateCreateProjectBody(body: unknown): CreateProjectBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  return body as CreateProjectBody;
}

/**
 * Normalizes a project slug into a database name when one is not provided.
 */
function normalizeDatabaseName(slug: string, databaseName?: unknown): string {
  if (typeof databaseName === 'string' && databaseName.trim()) {
    return databaseName.trim();
  }

  const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

  if (!normalized) {
    throw new SuperGooseError('Database name could not be derived from slug', 'InvalidPayload', 400);
  }

  return normalized;
}

/**
 * Validates that a project identifier looks like a MongoDB ObjectId.
 */
function validateProjectId(projectId: string): string {
  const trimmed = projectId.trim();

  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    throw new SuperGooseError(`Invalid ProjectId: ${projectId}`, 'InvalidObjectId', 400);
  }

  return trimmed;
}

/**
 * Validates an optional scopes payload.
 */
function parseOptionalScopes(scopes: unknown): string[] | undefined {
  if (scopes === undefined) {
    return undefined;
  }

  if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === 'string' && scope.trim())) {
    throw new SuperGooseError('scopes must be an array of non-empty strings', 'InvalidPayload', 400);
  }

  return scopes.map((scope) => scope.trim());
}

/**
 * Validates the API key rotation payload.
 */
function validateRotateApiKeyBody(body: unknown): RotateApiKeyBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  return body as RotateApiKeyBody;
}

/**
 * Creates a public endpoint that bootstraps a new project and its initial API key.
 */
export function createProjectRouter(controlPlane: MongoControlPlane): Router {
  const router = Router();

  router.post('/projects', (req, res, next) => {
    void handleCreateProject(req, res, next, controlPlane);
  });

  router.get('/projects/:projectId/api-keys', (req, res, next) => {
    void handleListProjectApiKeys(req, res, next, controlPlane);
  });

  router.post('/projects/:projectId/api-keys/rotate', (req, res, next) => {
    void handleRotateProjectApiKey(req, res, next, controlPlane);
  });

  return router;
}

/**
 * Handles public project creation and returns the first API key for the new project.
 */
export async function handleCreateProject(
  req: Request,
  res: Response,
  next: NextFunction,
  controlPlane: MongoControlPlane
): Promise<void> {
  try {
    const body = validateCreateProjectBody(req.body as CreateProjectBody);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

    if (!name) {
      throw new SuperGooseError('Missing field: name', 'InvalidPayload', 400);
    }

    if (!slug) {
      throw new SuperGooseError('Missing field: slug', 'InvalidPayload', 400);
    }

    const project = await controlPlane.createProject({
      name,
      slug,
      databaseName: normalizeDatabaseName(slug, body.databaseName)
    });

    const apiKeyResult = await controlPlane.createApiKey({
      projectId: project._id,
      databaseName: project.databaseName,
      scopes: Array.isArray(body.scopes) && body.scopes.every((scope) => typeof scope === 'string')
        ? (body.scopes as string[])
        : ['documents:*']
    });

    const response: CreateProjectResponse = {
      project,
      apiKey: {
        id: apiKeyResult.record._id,
        key: apiKeyResult.key,
        keyPrefix: apiKeyResult.record.keyPrefix,
        scopes: apiKeyResult.record.scopes
      }
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles API key metadata listing for a project without revealing the secret key.
 */
export async function handleListProjectApiKeys(
  req: Request,
  res: Response,
  next: NextFunction,
  controlPlane: MongoControlPlane
): Promise<void> {
  try {
    const projectId = validateProjectId(String(req.params.projectId ?? ''));
    const apiKeys = await controlPlane.listApiKeys(projectId);

    const response: ListApiKeysResponse = {
      projectId,
      apiKeys: apiKeys.map((record) => ({
        id: record._id,
        projectId: record.projectId,
        databaseName: record.databaseName,
        keyPrefix: record.keyPrefix,
        scopes: record.scopes,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...(record.revokedAt ? { revokedAt: record.revokedAt } : {}),
        ...(record.lastUsedAt ? { lastUsedAt: record.lastUsedAt } : {})
      }))
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles safe API key rotation for a project.
 */
export async function handleRotateProjectApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
  controlPlane: MongoControlPlane
): Promise<void> {
  try {
    const projectId = validateProjectId(String(req.params.projectId ?? ''));
    const body = validateRotateApiKeyBody(req.body);
    const scopes = parseOptionalScopes(body?.scopes);
    const apiKeyResult = await controlPlane.rotateApiKey(projectId, scopes);

    const response: RotateApiKeyResponse = {
      projectId,
      apiKey: {
        id: apiKeyResult.record._id,
        key: apiKeyResult.key,
        keyPrefix: apiKeyResult.record.keyPrefix,
        scopes: apiKeyResult.record.scopes
      }
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

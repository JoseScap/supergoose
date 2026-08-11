import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { SuperGooseError, assertSafeDocumentData, isDangerousKey, normalizeCollectionName } from 'supergoose-core';
import type { ApiDocument, ApiDocumentListQuery, ApiDocumentRecord, SuperGooseDataPort, SuperGooseTenantContext } from '../types';

type QueryValue = string | string[] | undefined;
type ParsedQuery = Record<string, QueryValue>;

/**
 * Converts query-string primitives into booleans, numbers or trimmed strings.
 */
function parsePrimitive(value: string): string | number | boolean {
  const trimmed = value.trim();

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numberValue = Number(trimmed);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return trimmed;
}

/**
 * Normalizes collection query parameters into the core list-query format.
 */
export function parseCollectionQuery(query: ParsedQuery): ApiDocumentListQuery {
  const filter: Record<string, string | number | boolean> = {};
  let limit: number | undefined;
  let skip: number | undefined;
  let sort: Record<string, 1 | -1> | undefined;

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) {
      continue;
    }

    if (key === 'limit') {
      if (Array.isArray(rawValue)) {
        throw new SuperGooseError('limit must be a single value', 'InvalidQuery', 400);
      }

      const parsed = Number(rawValue);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new SuperGooseError(`Invalid limit: ${rawValue}`, 'InvalidQuery', 400);
      }

      limit = parsed;
      continue;
    }

    if (key === 'skip') {
      if (Array.isArray(rawValue)) {
        throw new SuperGooseError('skip must be a single value', 'InvalidQuery', 400);
      }

      const parsed = Number(rawValue);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new SuperGooseError(`Invalid skip: ${rawValue}`, 'InvalidQuery', 400);
      }

      skip = parsed;
      continue;
    }

    if (key === 'sort') {
      if (Array.isArray(rawValue)) {
        throw new SuperGooseError('sort must be a single value', 'InvalidQuery', 400);
      }

      const fields = rawValue.split(',').map((entry) => entry.trim()).filter(Boolean);
      if (fields.length === 0) {
        throw new SuperGooseError('sort cannot be empty', 'InvalidQuery', 400);
      }

      sort = {};

      for (const field of fields) {
        const direction = field.startsWith('-') ? -1 : 1;
        const fieldName = field.replace(/^-/, '');

        if (isDangerousKey(fieldName)) {
          throw new SuperGooseError(`Invalid sort field: ${fieldName}`, 'InvalidQuery', 400);
        }

        sort[fieldName] = direction;
      }

      continue;
    }

    if (isDangerousKey(key)) {
      throw new SuperGooseError(`Invalid query field: ${key}`, 'InvalidQuery', 400);
    }

    if (Array.isArray(rawValue)) {
      filter[key] = rawValue.map((entry) => parsePrimitive(entry)).join(',');
      continue;
    }

    filter[key] = parsePrimitive(rawValue);
  }

  const normalized: ApiDocumentListQuery = { filter };

  assertSafeDocumentData(filter, 'InvalidQuery');

  if (limit !== undefined) {
    normalized.limit = limit;
  }

  if (skip !== undefined) {
    normalized.skip = skip;
  }

  if (sort) {
    normalized.sort = sort;
  }

  return normalized;
}

/**
 * Validates that the request body is a plain JSON document.
 */
function validateDocumentPayload(body: unknown): ApiDocument {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  const payload = body as Record<string, unknown>;

  if ('_id' in payload) {
    throw new SuperGooseError('Request body cannot include _id', 'InvalidPayload', 400);
  }

  assertSafeDocumentData(payload, 'InvalidPayload');

  return payload;
}

/**
 * Validates collection names and rejects dangerous identifiers.
 */
function validateCollectionName(collectionName: string): string {
  return normalizeCollectionName(collectionName);
}

/**
 * Validates the project segment in the collection URL.
 */
function validateProjectName(projectName: string): string {
  const trimmed = projectName.trim();

  if (!trimmed) {
    throw new SuperGooseError('Project name cannot be empty', 'InvalidCollectionName', 400);
  }

  if (trimmed.startsWith('$') || trimmed.includes('.') || trimmed === '__proto__' || trimmed === 'constructor' || trimmed === 'prototype') {
    throw new SuperGooseError(`Invalid project name: ${projectName}`, 'InvalidCollectionName', 400);
  }

  return trimmed;
}

/**
 * Validates that a route parameter is present and is a single scalar value.
 */
function extractParam(value: string | string[] | undefined, paramName: string): string {
  if (Array.isArray(value)) {
    throw new SuperGooseError(`Parameter ${paramName} must be a single value`, 'InvalidParam', 400);
  }

  if (value === undefined) {
    throw new SuperGooseError(`Missing parameter: ${paramName}`, 'InvalidParam', 400);
  }

  return value;
}

/**
 * Validates that the provided string is a MongoDB ObjectId.
 */
function validateObjectId(objectId: string): string {
  const trimmed = objectId.trim();

  if (!/^[a-fA-F0-9]{24}$/.test(trimmed)) {
    throw new SuperGooseError(`Invalid ObjectId: ${objectId}`, 'InvalidObjectId', 400);
  }

  return trimmed;
}

/**
 * Sends a created document using the `201 Created` status.
 */
function sendCreatedDocument(res: Response, document: ApiDocumentRecord): void {
  res.status(201).json(document);
}

/**
 * Reads the tenant document store attached by the auth middleware.
 */
function getTenantStore(req: Request): SuperGooseTenantContext['documentStore'] | undefined {
  return (req as Request & { supergooseTenant?: SuperGooseTenantContext }).supergooseTenant?.documentStore;
}

/**
 * Ensures the requested project matches the authenticated tenant.
 */
function validateTenantProject(req: Request, projectName: string): void {
  const tenant = (req as Request & { supergooseTenant?: SuperGooseTenantContext }).supergooseTenant;

  if (!tenant) {
    return;
  }

  if (tenant.databaseName !== projectName) {
    throw new SuperGooseError('API key does not grant access to this project', 'Forbidden', 403);
  }
}

/**
 * Handles document listing for a collection.
 */
export async function handleListDocuments(req: Request, res: Response, next: NextFunction, core: SuperGooseDataPort): Promise<void> {
  try {
    const project = validateProjectName(extractParam(req.params.project, 'project'));
    const collection = validateCollectionName(extractParam(req.params.collection, 'collection'));
    validateTenantProject(req, project);
    const query = parseCollectionQuery(req.query as ParsedQuery);
    const result = await core.listDocuments(collection, query, getTenantStore(req));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles document creation for a collection.
 */
export async function handleCreateDocument(req: Request, res: Response, next: NextFunction, core: SuperGooseDataPort): Promise<void> {
  try {
    const project = validateProjectName(extractParam(req.params.project, 'project'));
    const collection = validateCollectionName(extractParam(req.params.collection, 'collection'));
    validateTenantProject(req, project);
    const payload = validateDocumentPayload(req.body);
    const document = await core.createDocument(collection, payload, getTenantStore(req));
    sendCreatedDocument(res, document);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles reading a single document by id.
 */
export async function handleGetDocument(req: Request, res: Response, next: NextFunction, core: SuperGooseDataPort): Promise<void> {
  try {
    const project = validateProjectName(extractParam(req.params.project, 'project'));
    const collection = validateCollectionName(extractParam(req.params.collection, 'collection'));
    validateTenantProject(req, project);
    const objectId = validateObjectId(extractParam(req.params.id, 'id'));
    const document = await core.getDocumentById(collection, objectId, getTenantStore(req));
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles full replacement of a document.
 */
export async function handleReplaceDocument(req: Request, res: Response, next: NextFunction, core: SuperGooseDataPort): Promise<void> {
  try {
    const project = validateProjectName(extractParam(req.params.project, 'project'));
    const collection = validateCollectionName(extractParam(req.params.collection, 'collection'));
    validateTenantProject(req, project);
    const objectId = validateObjectId(extractParam(req.params.id, 'id'));
    const payload = validateDocumentPayload(req.body);
    const document = await core.replaceDocument(collection, objectId, payload, getTenantStore(req));
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles partial updates for a document.
 */
export async function handlePatchDocument(req: Request, res: Response, next: NextFunction, core: SuperGooseDataPort): Promise<void> {
  try {
    const project = validateProjectName(extractParam(req.params.project, 'project'));
    const collection = validateCollectionName(extractParam(req.params.collection, 'collection'));
    validateTenantProject(req, project);
    const objectId = validateObjectId(extractParam(req.params.id, 'id'));
    const payload = validateDocumentPayload(req.body);
    const document = await core.patchDocument(collection, objectId, payload, getTenantStore(req));
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles document deletion.
 */
export async function handleDeleteDocument(req: Request, res: Response, next: NextFunction, core: SuperGooseDataPort): Promise<void> {
  try {
    const project = validateProjectName(extractParam(req.params.project, 'project'));
    const collection = validateCollectionName(extractParam(req.params.collection, 'collection'));
    validateTenantProject(req, project);
    const objectId = validateObjectId(extractParam(req.params.id, 'id'));
    const result = await core.deleteDocument(collection, objectId, getTenantStore(req));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Builds the generic CRUD router, optionally protected by auth middleware.
 */
export function createResourceRouter(core: SuperGooseDataPort, authMiddleware?: RequestHandler): Router {
  const router = Router();

  if (authMiddleware) {
    router.use(authMiddleware);
  }

  router.get('/api/:project/:collection', (req, res, next) => {
    void handleListDocuments(req, res, next, core);
  });

  router.post('/api/:project/:collection', (req, res, next) => {
    void handleCreateDocument(req, res, next, core);
  });

  router.get('/api/:project/:collection/:id', (req, res, next) => {
    void handleGetDocument(req, res, next, core);
  });

  router.put('/api/:project/:collection/:id', (req, res, next) => {
    void handleReplaceDocument(req, res, next, core);
  });

  router.patch('/api/:project/:collection/:id', (req, res, next) => {
    void handlePatchDocument(req, res, next, core);
  });

  router.delete('/api/:project/:collection/:id', (req, res, next) => {
    void handleDeleteDocument(req, res, next, core);
  });

  return router;
}

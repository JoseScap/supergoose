import { Router, type NextFunction, type Request, type Response } from 'express';
import { SuperGooseError } from 'supergoose-core';
import type { MongoConnectionManager, MongoControlPlane, ProjectRecord, ApiKeySummary } from 'supergoose-infra';
import { MAX_DASHBOARD_SESSION_TTL_HOURS } from 'supergoose-infra';
import type { SuperGooseDataPort } from '../types';

const DASHBOARD_SESSION_COOKIE = 'supergoose_dashboard_session';

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

interface CreateProjectBody {
  name?: unknown;
  slug?: unknown;
  databaseName?: unknown;
  allowedCollections?: unknown;
}

interface UpdateProjectBody {
  name?: unknown;
  slug?: unknown;
  status?: unknown;
  allowedCollections?: unknown;
}

interface ApiKeyBody {
  scopes?: unknown;
}

interface RootUserResponse {
  _id: string;
  username: string;
  lastLoginAt?: string;
}

interface DashboardProjectSummaryResponse {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  databaseName: string;
  createdAt: string;
  updatedAt: string;
  apiKeyCount: number;
  activeApiKeyPrefix?: string;
}

interface DashboardApiKeyResponse {
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

interface DashboardApiKeyCreatedResponse {
  projectId: string;
  apiKey: {
    id: string;
    key: string;
    keyPrefix: string;
    scopes: string[];
  };
}

interface DashboardExplorerCollection {
  name: string;
  updatedAt: string;
  indexes: number;
  documents: Array<Record<string, unknown> & { _id: string }>;
}

interface DashboardExplorerResponse {
  project: DashboardProjectSummaryResponse;
  collections: DashboardExplorerCollection[];
}

type DashboardAuthedRequest = Request & {
  dashboardRootUser?: RootUserResponse;
};

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.header('cookie');

  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');

    if (rawName === name) {
      return rest.join('=').trim();
    }
  }

  return undefined;
}

function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${DASHBOARD_SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_DASHBOARD_SESSION_TTL_HOURS * 60 * 60}`
  ];

  if (secure) {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${DASHBOARD_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];

  if (secure) {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

function validateLoginBody(body: unknown): LoginBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  return body as LoginBody;
}

function validateProjectBody(body: unknown): CreateProjectBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  return body as CreateProjectBody;
}

function validateUpdateProjectBody(body: unknown): UpdateProjectBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  return body as UpdateProjectBody;
}

function validateApiKeyBody(body: unknown): ApiKeyBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new SuperGooseError('Request body must be a JSON object', 'InvalidPayload', 400);
  }

  return body as ApiKeyBody;
}

function validateSlug(slug: string): string {
  const trimmed = slug.trim();

  if (!trimmed) {
    throw new SuperGooseError('Missing project slug', 'InvalidPayload', 400);
  }

  return trimmed;
}

function parseOptionalScopes(scopes: unknown): string[] | undefined {
  if (scopes === undefined) {
    return undefined;
  }

  if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === 'string' && scope.trim())) {
    throw new SuperGooseError('scopes must be an array of non-empty strings', 'InvalidPayload', 400);
  }

  return scopes.map((scope) => scope.trim());
}

function mapRootUserSummary(rootUser: { _id: string; username: string; lastLoginAt?: string }): RootUserResponse {
  return {
    _id: rootUser._id,
    username: rootUser.username,
    ...(rootUser.lastLoginAt ? { lastLoginAt: rootUser.lastLoginAt } : {})
  };
}

function countActiveKeys(keys: ApiKeySummary[]): number {
  return keys.filter((key) => !key.revokedAt).length;
}

function getActiveKeyPrefix(keys: ApiKeySummary[]): string | undefined {
  return keys.find((key) => !key.revokedAt)?.keyPrefix;
}

async function summarizeProject(
  project: ProjectRecord,
  controlPlane: MongoControlPlane
): Promise<DashboardProjectSummaryResponse> {
  const keys = await controlPlane.listApiKeys(project._id);
  const activeApiKeyPrefix = getActiveKeyPrefix(keys);

  return {
    id: project._id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    databaseName: project.databaseName,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    apiKeyCount: countActiveKeys(keys),
    ...(activeApiKeyPrefix ? { activeApiKeyPrefix } : {})
  };
}

async function requireDashboardSession(
  req: Request,
  controlPlane: MongoControlPlane
): Promise<RootUserResponse | null> {
  const token = readCookie(req, DASHBOARD_SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const rootUser = await controlPlane.resolveDashboardSession(token);

  return rootUser ? mapRootUserSummary(rootUser) : null;
}

function attachRootUser(req: DashboardAuthedRequest, rootUser: RootUserResponse): void {
  req.dashboardRootUser = rootUser;
}

async function getProjectOrThrow(controlPlane: MongoControlPlane, slug: string): Promise<ProjectRecord> {
  const project = await controlPlane.findProjectBySlug(slug);

  if (!project) {
    throw new SuperGooseError(`Project not found: ${slug}`, 'ProjectNotFound', 404);
  }

  return project;
}

async function handleAuth(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const body = validateLoginBody(req.body);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      throw new SuperGooseError('Missing username or password', 'InvalidPayload', 400);
    }

    const rootUser = await controlPlane.verifyRootUserCredentials(username, password);

    if (!rootUser) {
      throw new SuperGooseError('Invalid root credentials', 'Unauthorized', 401);
    }

    const session = await controlPlane.createDashboardSession(rootUser._id);
    setSessionCookie(res, session.token);
    res.status(200).json({ rootUser });
  } catch (error) {
    next(error);
  }
}

async function handleMe(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    res.status(200).json({ rootUser });
  } catch (error) {
    next(error);
  }
}

async function handleLogout(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const token = readCookie(req, DASHBOARD_SESSION_COOKIE);

    if (token) {
      await controlPlane.revokeDashboardSession(token);
    }

    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function handleListProjects(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const projects = await controlPlane.listProjects();
    const summaries = await Promise.all(projects.map((project) => summarizeProject(project, controlPlane)));

    res.status(200).json({ projects: summaries });
  } catch (error) {
    next(error);
  }
}

async function handleCreateProject(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const body = validateProjectBody(req.body);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const allowedCollections = Array.isArray(body.allowedCollections)
      ? body.allowedCollections.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())
      : undefined;

    if (!name) {
      throw new SuperGooseError('Missing field: name', 'InvalidPayload', 400);
    }

    if (!slug) {
      throw new SuperGooseError('Missing field: slug', 'InvalidPayload', 400);
    }

    const project = await controlPlane.createProject({
      name,
      slug,
      databaseName: typeof body.databaseName === 'string' && body.databaseName.trim() ? body.databaseName.trim() : slug,
      ...(allowedCollections ? { allowedCollections } : {})
    });

    const summary = await summarizeProject(project, controlPlane);
    res.status(201).json({ project: summary });
  } catch (error) {
    next(error);
  }
}

async function handleGetProject(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const summary = await summarizeProject(project, controlPlane);

    res.status(200).json({ project: summary });
  } catch (error) {
    next(error);
  }
}

async function handleUpdateProject(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const body = validateUpdateProjectBody(req.body);
    const updated = await controlPlane.updateProject(project._id, {
      ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
      ...(typeof body.slug === 'string' && body.slug.trim() ? { slug: body.slug.trim() } : {}),
      ...(typeof body.status === 'string' && (body.status === 'active' || body.status === 'inactive') ? { status: body.status } : {}),
      ...(Array.isArray(body.allowedCollections)
        ? {
            allowedCollections: body.allowedCollections
              .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
              .map((value) => value.trim())
          }
        : {})
    });

    if (!updated) {
      throw new SuperGooseError('Project not found', 'ProjectNotFound', 404);
    }

    const summary = await summarizeProject(updated, controlPlane);
    res.status(200).json({ project: summary });
  } catch (error) {
    next(error);
  }
}

async function handleDeleteProject(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const updated = await controlPlane.deactivateProject(project._id);

    if (!updated) {
      throw new SuperGooseError('Project not found', 'ProjectNotFound', 404);
    }

    const summary = await summarizeProject(updated, controlPlane);
    res.status(200).json({ project: summary });
  } catch (error) {
    next(error);
  }
}

async function handleListApiKeys(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const apiKeys = await controlPlane.listApiKeys(project._id);

    const response = {
      projectId: project._id,
      apiKeys: apiKeys.map((record): DashboardApiKeyResponse => ({
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

async function handleCreateApiKey(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const body = validateApiKeyBody(req.body);
    const scopes = parseOptionalScopes(body.scopes);
    const created = await controlPlane.createFirstApiKey(project._id, scopes);

    if (!created) {
      throw new SuperGooseError('Project not found', 'ProjectNotFound', 404);
    }

    const response: DashboardApiKeyCreatedResponse = {
      projectId: project._id,
      apiKey: {
        id: created.record._id,
        key: created.key,
        keyPrefix: created.record.keyPrefix,
        scopes: created.record.scopes
      }
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

async function handleRotateApiKey(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const body = validateApiKeyBody(req.body);
    const scopes = parseOptionalScopes(body.scopes);
    const rotated = await controlPlane.rotateApiKey(project._id, scopes);

    const response: DashboardApiKeyCreatedResponse = {
      projectId: project._id,
      apiKey: {
        id: rotated.record._id,
        key: rotated.key,
        keyPrefix: rotated.record.keyPrefix,
        scopes: rotated.record.scopes
      }
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

async function handleRevokeApiKey(req: Request, res: Response, next: NextFunction, controlPlane: MongoControlPlane): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const apiKeyId = String(req.params.apiKeyId ?? '').trim();
    const revoked = await controlPlane.revokeApiKey(apiKeyId);

    if (!revoked) {
      throw new SuperGooseError('API key not found', 'ApiKeyNotFound', 404);
    }

    res.status(200).json({ revoked: true });
  } catch (error) {
    next(error);
  }
}

async function handleGetExplorer(
  req: Request,
  res: Response,
  next: NextFunction,
  controlPlane: MongoControlPlane,
  mongo: MongoConnectionManager,
  core: SuperGooseDataPort
): Promise<void> {
  try {
    const rootUser = await requireDashboardSession(req, controlPlane);

    if (!rootUser) {
      throw new SuperGooseError('Unauthorized', 'Unauthorized', 401);
    }

    const slug = validateSlug(String(req.params.slug ?? ''));
    const project = await getProjectOrThrow(controlPlane, slug);
    const summary = await summarizeProject(project, controlPlane);
    const store = mongo.createDocumentStore(project.databaseName);
    const collectionNames = await mongo.listCollectionNames(project.databaseName);

    const collections = await Promise.all(
      collectionNames.map(async (collectionName) => {
        const documentsResult = await core.listDocuments(collectionName, { limit: 100 }, store);
        const documents = documentsResult.documents as Array<Record<string, unknown> & { _id: string }>;
        const updatedAt = documents.reduce<string | undefined>((latest, document) => {
          const candidate = typeof document.updatedAt === 'string' ? document.updatedAt : undefined;

          if (!candidate) {
            return latest;
          }

          if (!latest) {
            return candidate;
          }

          return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest;
        }, undefined) ?? summary.updatedAt;

        return {
          name: collectionName,
          updatedAt,
          indexes: documents.length,
          documents
        } satisfies DashboardExplorerCollection;
      })
    );

    const response: DashboardExplorerResponse = {
      project: summary,
      collections
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Builds the dashboard router for root sessions and project administration.
 */
export function createDashboardRouter(
  controlPlane: MongoControlPlane,
  mongo: MongoConnectionManager,
  core: SuperGooseDataPort
): Router {
  const router = Router();

  router.post('/dashboard/auth', (req, res, next) => {
    void handleAuth(req, res, next, controlPlane);
  });

  router.get('/dashboard/me', (req, res, next) => {
    void handleMe(req, res, next, controlPlane);
  });

  router.post('/dashboard/logout', (req, res, next) => {
    void handleLogout(req, res, next, controlPlane);
  });

  router.get('/dashboard/projects', (req, res, next) => {
    void handleListProjects(req, res, next, controlPlane);
  });

  router.post('/dashboard/projects', (req, res, next) => {
    void handleCreateProject(req, res, next, controlPlane);
  });

  router.get('/dashboard/projects/:slug', (req, res, next) => {
    void handleGetProject(req, res, next, controlPlane);
  });

  router.patch('/dashboard/projects/:slug', (req, res, next) => {
    void handleUpdateProject(req, res, next, controlPlane);
  });

  router.delete('/dashboard/projects/:slug', (req, res, next) => {
    void handleDeleteProject(req, res, next, controlPlane);
  });

  router.get('/dashboard/projects/:slug/api-keys', (req, res, next) => {
    void handleListApiKeys(req, res, next, controlPlane);
  });

  router.post('/dashboard/projects/:slug/api-keys', (req, res, next) => {
    void handleCreateApiKey(req, res, next, controlPlane);
  });

  router.post('/dashboard/projects/:slug/api-keys/rotate', (req, res, next) => {
    void handleRotateApiKey(req, res, next, controlPlane);
  });

  router.post('/dashboard/projects/:slug/api-keys/:apiKeyId/revoke', (req, res, next) => {
    void handleRevokeApiKey(req, res, next, controlPlane);
  });

  router.get('/dashboard/projects/:slug/explorer', (req, res, next) => {
    void handleGetExplorer(req, res, next, controlPlane, mongo, core);
  });

  return router;
}

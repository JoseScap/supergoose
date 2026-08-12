export interface DashboardRootUser {
  _id: string;
  username: string;
  lastLoginAt?: string;
}

export interface DashboardProjectSummary {
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

export interface DashboardApiKey {
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

export interface DashboardApiKeyCreatedResponse {
  projectId: string;
  apiKey: {
    id: string;
    key: string;
    keyPrefix: string;
    scopes: string[];
  };
}

export interface DashboardExplorerCollection {
  name: string;
  updatedAt: string;
  indexes: number;
  documents: Array<Record<string, unknown> & { _id: string }>;
}

export interface DashboardExplorerResponse {
  project: DashboardProjectSummary;
  collections: DashboardExplorerCollection[];
}

export interface DashboardProjectResponse {
  project: DashboardProjectSummary;
}

export interface DashboardProjectsResponse {
  projects: DashboardProjectSummary[];
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

function getApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  return window.location.origin;
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function dashboardFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = await parseJson<ApiErrorBody>(response).catch(() => ({}));
    const error = new Error(errorBody.message ?? `Request failed with status ${response.status}`);
    (error as Error & { status?: number; code?: string }).status = response.status;
    (error as Error & { status?: number; code?: string }).code = errorBody.error;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return parseJson<T>(response);
}

export async function getDashboardMe(): Promise<DashboardRootUser> {
  const result = await dashboardFetch<{ rootUser: DashboardRootUser }>('/dashboard/me', {
    method: 'GET',
    headers: {}
  });

  return result.rootUser;
}

export async function loginDashboard(username: string, password: string): Promise<DashboardRootUser> {
  const result = await dashboardFetch<{ rootUser: DashboardRootUser }>('/dashboard/auth', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });

  return result.rootUser;
}

export async function logoutDashboard(): Promise<void> {
  await dashboardFetch('/dashboard/logout', {
    method: 'POST',
    headers: {}
  });
}

export async function listDashboardProjects(): Promise<DashboardProjectSummary[]> {
  const result = await dashboardFetch<DashboardProjectsResponse>('/dashboard/projects', {
    method: 'GET',
    headers: {}
  });

  return result.projects;
}

export async function createDashboardProject(input: { name: string; slug: string }): Promise<DashboardProjectSummary> {
  const result = await dashboardFetch<DashboardProjectResponse>('/dashboard/projects', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  return result.project;
}

export async function getDashboardProject(slug: string): Promise<DashboardProjectSummary> {
  const result = await dashboardFetch<DashboardProjectResponse>(`/dashboard/projects/${slug}`, {
    method: 'GET',
    headers: {}
  });

  return result.project;
}

export async function updateDashboardProject(
  slug: string,
  input: Partial<Pick<DashboardProjectSummary, 'name' | 'slug' | 'status'>>
): Promise<DashboardProjectSummary> {
  const result = await dashboardFetch<DashboardProjectResponse>(`/dashboard/projects/${slug}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });

  return result.project;
}

export async function deleteDashboardProject(slug: string): Promise<DashboardProjectSummary> {
  const result = await dashboardFetch<DashboardProjectResponse>(`/dashboard/projects/${slug}`, {
    method: 'DELETE',
    headers: {}
  });

  return result.project;
}

export async function listDashboardApiKeys(slug: string): Promise<DashboardApiKey[]> {
  const result = await dashboardFetch<{ projectId: string; apiKeys: DashboardApiKey[] }>(`/dashboard/projects/${slug}/api-keys`, {
    method: 'GET',
    headers: {}
  });

  return result.apiKeys;
}

export async function createDashboardApiKey(
  slug: string,
  input: { scopes?: string[] }
): Promise<DashboardApiKeyCreatedResponse> {
  return dashboardFetch<DashboardApiKeyCreatedResponse>(`/dashboard/projects/${slug}/api-keys`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function rotateDashboardApiKey(
  slug: string,
  input: { scopes?: string[] }
): Promise<DashboardApiKeyCreatedResponse> {
  return dashboardFetch<DashboardApiKeyCreatedResponse>(`/dashboard/projects/${slug}/api-keys/rotate`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function revokeDashboardApiKey(slug: string, apiKeyId: string): Promise<void> {
  await dashboardFetch(`/dashboard/projects/${slug}/api-keys/${apiKeyId}/revoke`, {
    method: 'POST',
    headers: {}
  });
}

export async function getDashboardExplorer(slug: string): Promise<DashboardExplorerResponse> {
  return dashboardFetch<DashboardExplorerResponse>(`/dashboard/projects/${slug}/explorer`, {
    method: 'GET',
    headers: {}
  });
}

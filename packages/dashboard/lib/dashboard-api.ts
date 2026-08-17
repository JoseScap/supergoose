export interface RootUser {
  _id: string
  username: string
  lastLoginAt?: string
}

export interface DashboardAuthResponse {
  rootUser: RootUser
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:4000"

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "")
}

export function getApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL)
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Partial<DashboardAuthResponse> & { error?: string; message?: string }
    return payload.message ?? payload.error ?? `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

export async function loginRootUser(input: { username: string; password: string }): Promise<RootUser> {
  const response = await fetch(`${getApiBaseUrl()}/dashboard/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as Partial<DashboardAuthResponse>

  if (!payload.rootUser) {
    throw new Error("The API did not return the signed-in root user.")
  }

  return payload.rootUser
}

export async function getRootUserFromSession(cookieHeader?: string): Promise<RootUser | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/dashboard/me`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    })

    if (response.status === 401) {
      return null
    }

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as Partial<DashboardAuthResponse>
    return payload.rootUser ?? null
  } catch {
    return null
  }
}

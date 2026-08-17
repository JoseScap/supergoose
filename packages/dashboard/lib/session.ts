import "server-only"

import { cookies } from "next/headers"

import { getRootUserFromSession, type RootUser } from "@/lib/dashboard-api"

function serializeCookieHeader(cookieStore: Awaited<ReturnType<typeof cookies>>): string | undefined {
  const parts = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`)
  return parts.length > 0 ? parts.join("; ") : undefined
}

export async function getDashboardRootUser(): Promise<RootUser | null> {
  const cookieStore = await cookies()
  return getRootUserFromSession(serializeCookieHeader(cookieStore))
}

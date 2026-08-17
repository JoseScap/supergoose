import { NextRequest, NextResponse } from "next/server"

import { getApiBaseUrl } from "@/lib/dashboard-api"

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string }
    return payload.message ?? payload.error ?? `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const formData = await request.formData()
  const name = String(formData.get("name") ?? "").trim()
  const slug = String(formData.get("slug") ?? "").trim()
  const databaseName = String(formData.get("databaseName") ?? "").trim()
  const cookieHeader = request.headers.get("cookie") ?? undefined

  const targetUrl = new URL("/dashboard/projects", request.url)

  if (!name || !slug) {
    targetUrl.searchParams.set("error", "Enter both a project name and a slug.")
    return NextResponse.redirect(targetUrl, 303)
  }

  const response = await fetch(`${getApiBaseUrl()}/dashboard/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({
      name,
      slug,
      ...(databaseName ? { databaseName } : {}),
    }),
  })

  if (!response.ok) {
    targetUrl.searchParams.set("error", await readApiErrorMessage(response))
    return NextResponse.redirect(targetUrl, 303)
  }

  targetUrl.searchParams.set("created", "1")
  return NextResponse.redirect(targetUrl, 303)
}

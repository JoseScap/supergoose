import { NextResponse, type NextRequest } from "next/server"

import { getApiBaseUrl } from "@/lib/dashboard-api"

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text()

  const upstreamResponse = await fetch(`${getApiBaseUrl()}/dashboard/auth`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body,
  })

  const headers = new Headers()
  const contentType = upstreamResponse.headers.get("content-type")

  if (contentType) {
    headers.set("Content-Type", contentType)
  }

  const setCookieHeaders =
    typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : upstreamResponse.headers.get("set-cookie")
        ? [upstreamResponse.headers.get("set-cookie") as string]
        : []

  for (const cookie of setCookieHeaders) {
    headers.append("Set-Cookie", cookie)
  }

  return new NextResponse(await upstreamResponse.text(), {
    status: upstreamResponse.status,
    headers,
  })
}

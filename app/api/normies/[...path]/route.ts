import { NextRequest, NextResponse } from "next/server"

import { NORMIES_API_BASE } from "@/lib/contracts"

function resolveUpstream(segments: string[]): {
  url: string
  isText: boolean
} {
  if (segments.length === 2 && segments[0] === "holders") {
    return {
      url: `${NORMIES_API_BASE}/holders/${segments[1]}`,
      isText: false,
    }
  }

  // /api/normies/{id}/pixels|traits|metadata|...
  if (segments.length >= 2) {
    const id = segments[0]
    const rest = segments.slice(1).join("/")
    const isText =
      rest === "pixels" ||
      rest.endsWith("/pixels") ||
      rest === "traits/binary"
    return {
      url: `${NORMIES_API_BASE}/normie/${id}/${rest}`,
      isText,
    }
  }

  if (segments.length === 1) {
    return {
      url: `${NORMIES_API_BASE}/normie/${segments[0]}/metadata`,
      isText: false,
    }
  }

  return { url: `${NORMIES_API_BASE}/${segments.join("/")}`, isText: false }
}

/**
 * Read-only proxy for the public Normies API.
 * Avoids browser CORS and centralizes caching.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const segments = path ?? []
  const { url, isText } = resolveUpstream(segments)
  const cacheSeconds = segments[0] === "holders" ? 15 : 120

  try {
    const res = await fetch(url, {
      headers: {
        Accept: isText ? "text/plain" : "application/json",
      },
      next: { revalidate: cacheSeconds },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status },
      )
    }

    if (isText) {
      const text = await res.text()
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
        },
      })
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach Normies API", detail: String(err) },
      { status: 502 },
    )
  }
}

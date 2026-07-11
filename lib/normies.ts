import type { NormieTrait, NormieVoiceInput, VoiceRole } from "@/lib/types"

export function normieImageUrl(tokenId: number): string {
  return `https://api.normies.art/normie/${tokenId}/image.svg`
}

async function getProxy(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api/normies/${path}`, init)
  if (!res.ok) {
    throw new Error(`Normies API error (${res.status}) for ${path}`)
  }
  return res
}

export async function fetchPixels(tokenId: number): Promise<string> {
  const res = await getProxy(`${tokenId}/pixels`)
  const text = (await res.text()).trim()
  if (text.length !== 1600) {
    throw new Error(`Invalid pixel data for #${tokenId} (len=${text.length})`)
  }
  return text
}

export async function fetchTraits(
  tokenId: number,
): Promise<{ raw: string; attributes: NormieTrait[] }> {
  const res = await getProxy(`${tokenId}/traits`)
  return res.json()
}

export async function fetchMetadata(
  tokenId: number,
): Promise<{ name: string; attributes: NormieTrait[]; image?: string }> {
  const res = await getProxy(`${tokenId}/metadata`)
  return res.json()
}

export async function fetchOwnedIds(address: string): Promise<number[]> {
  const res = await getProxy(`holders/${address}`)
  const data = (await res.json()) as {
    address?: string
    tokenIds?: Array<number | string>
  }
  return (data.tokenIds ?? [])
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9999)
}

export async function fetchNormieVoice(
  tokenId: number,
  role: VoiceRole = "primary",
): Promise<NormieVoiceInput> {
  const [pixels, traits, metadata] = await Promise.all([
    fetchPixels(tokenId),
    fetchTraits(tokenId).catch(() => ({ raw: "", attributes: [] as NormieTrait[] })),
    fetchMetadata(tokenId).catch(() => ({
      name: `Normie #${tokenId}`,
      attributes: [] as NormieTrait[],
    })),
  ])

  return {
    tokenId,
    name: metadata.name || `Normie #${tokenId}`,
    pixels,
    traits: traits.attributes?.length
      ? traits.attributes
      : metadata.attributes ?? [],
    imageUrl: normieImageUrl(tokenId),
    role,
  }
}

export async function fetchNormieVoices(
  ids: number[],
): Promise<NormieVoiceInput[]> {
  const roles: VoiceRole[] = ["primary", "harmony", "counter"]
  return Promise.all(
    ids.slice(0, 3).map((id, i) => fetchNormieVoice(id, roles[i] ?? "harmony")),
  )
}

"use client"

import { Monitor } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SKIN_LABELS, type SkinId } from "@/lib/types"

const SKINS = Object.keys(SKIN_LABELS) as SkinId[]

export function SkinSwitcher({
  value,
  onChange,
}: {
  value: SkinId
  onChange: (skin: SkinId) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Monitor className="size-3.5 text-muted-foreground" aria-hidden />
      <Select
        value={value}
        onValueChange={(v) => {
          if (v && SKINS.includes(v as SkinId)) onChange(v as SkinId)
        }}
      >
        <SelectTrigger
          size="sm"
          className="btn-retro h-9 min-w-[10rem] border-0 bg-transparent shadow-none"
          aria-label="Skin"
        >
          <SelectValue placeholder="Skin" />
        </SelectTrigger>
        <SelectContent className="bevel border-border bg-card">
          {SKINS.map((id) => (
            <SelectItem key={id} value={id} className="font-mono text-xs">
              {SKIN_LABELS[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

"use client"

import Image from "next/image"
import { useState } from "react"

import { normieImageUrl } from "@/lib/normies"
import { cn } from "@/lib/utils"

export function NormiePicker({
  availableIds,
  selected,
  onChange,
  disabled,
}: {
  availableIds: number[]
  selected: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const [manualId, setManualId] = useState("")
  const allSelected =
    availableIds.length > 0 &&
    availableIds.every((id) => selected.includes(id))

  function toggle(id: number) {
    if (disabled) return
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
      return
    }
    onChange([...selected, id])
  }

  function selectAll() {
    if (disabled) return
    onChange([...availableIds])
  }

  function clearAll() {
    if (disabled) return
    onChange([])
  }

  function addManual() {
    const id = Number(manualId)
    if (!Number.isFinite(id) || id < 0 || id > 9999) return
    if (selected.includes(id)) return
    onChange([...selected, id])
    setManualId("")
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Select voices
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {selected.length} selected · 1st = primary
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn("btn-retro", allSelected && "btn-retro-active")}
          disabled={disabled || availableIds.length === 0}
          onClick={selectAll}
          title="Select all Normies"
        >
          ALL
        </button>
        <button
          type="button"
          className="btn-retro"
          disabled={disabled || selected.length === 0}
          onClick={clearAll}
        >
          Clear
        </button>
      </div>

      {availableIds.length > 0 ? (
        <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
          {availableIds.map((id) => {
            const idx = selected.indexOf(id)
            const isSelected = idx >= 0
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => toggle(id)}
                className={cn(
                  "bevel-inset relative aspect-square overflow-hidden p-0.5 transition",
                  isSelected && "glow-active ring-1 ring-primary",
                )}
                title={`Normie #${id}${isSelected ? ` (#${idx + 1})` : ""}`}
              >
                <Image
                  src={normieImageUrl(id)}
                  alt={`Normie #${id}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="size-full object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/80 text-center text-[9px] text-primary">
                    {idx === 0 ? "PRI" : idx + 1}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No owned Normies detected. Use sample mode or enter an ID.
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={9999}
          placeholder="Token ID"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          disabled={disabled}
          className="bevel-inset min-h-11 flex-1 bg-black px-3 font-mono text-sm text-foreground outline-none focus:glow-active"
        />
        <button
          type="button"
          className="btn-retro"
          disabled={disabled}
          onClick={addManual}
        >
          Add
        </button>
      </div>
    </div>
  )
}

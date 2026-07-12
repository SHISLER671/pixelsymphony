"use client"

import Image from "next/image"

import { cn } from "@/lib/utils"

export function LoadingIcon({
  label = "Tuning in…",
  className,
  size = 64,
}: {
  label?: string
  className?: string
  size?: number
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Image
        src="/normie-logo.svg"
        alt="Normie logo"
        width={size}
        height={size}
        className="normie-pulse pixelated"
        style={{ imageRendering: "pixelated" }}
        priority
      />
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

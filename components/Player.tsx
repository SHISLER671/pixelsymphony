"use client"

import { Pause, Play, Square, Volume2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { BlipShare } from "@/components/BlipShare"
import { LoadingIcon } from "@/components/LoadingIcon"
import { NormiePicker } from "@/components/NormiePicker"
import { SkinSwitcher } from "@/components/SkinSwitcher"
import { SynopsisPanel } from "@/components/SynopsisPanel"
import { Visualizer } from "@/components/Visualizer"
import { Slider } from "@/components/ui/slider"
import * as audio from "@/lib/audio"
import { fetchNormieVoices } from "@/lib/normies"
import type { NormieVoiceInput, SkinId, VoiceScore } from "@/lib/types"
import { translateToScore } from "@/lib/venice"

const SKIN_KEY = "pixelsymphony-skin"

export function Player({
  availableIds,
  initialSelected = [],
  sampleMode = false,
}: {
  availableIds: number[]
  initialSelected?: number[]
  sampleMode?: boolean
}) {
  const [skin, setSkin] = useState<SkinId>("classic")
  const [selected, setSelected] = useState<number[]>(initialSelected)
  const [voices, setVoices] = useState<NormieVoiceInput[]>([])
  const [score, setScore] = useState<VoiceScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [needsGesture, setNeedsGesture] = useState(true)
  const rafRef = useRef<number | null>(null)
  const visualCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SKIN_KEY) as SkinId | null
      if (saved && ["classic", "minimal", "crt", "pixel-forest"].includes(saved)) {
        setSkin(saved)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-skin", skin)
    try {
      localStorage.setItem(SKIN_KEY, skin)
    } catch {
      /* ignore */
    }
  }, [skin])

  useEffect(() => {
    audio.setVolume(volume)
  }, [volume])

  // progress loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const tick = () => {
      setProgress(audio.getTransportProgress())
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  // resume audio on visibility
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && playing) {
        void audio.play()
      }
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [playing])

  useEffect(() => {
    return () => {
      audio.disposeAudio()
    }
  }, [])

  const loadVoices = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      setVoices([])
      setScore(null)
      audio.stop()
      setPlaying(false)
      return
    }
    setLoading(true)
    try {
      const v = await fetchNormieVoices(ids)
      setVoices(v)
      const s = await translateToScore(v)
      setScore(s)
      await audio.loadScore(s)
      if (ids.length > 6) {
        toast.message(`Hive mix · ${ids.length} Normies`, {
          description: `${s.parts.length} audio layers · synthwave stack`,
        })
      } else if (s.source === "fallback") {
        toast.message("Synthwave from on-chain pixels", {
          description: "Deterministic hive arrangement (Venice optional)",
        })
      } else {
        toast.success("Venice arrangement ready")
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to load Normies", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
      setVoices([])
      setScore(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVoices(selected)
  }, [selected, loadVoices])

  async function handlePlay() {
    try {
      await audio.unlockAudio()
      setNeedsGesture(false)
      await audio.play()
      setPlaying(true)
    } catch (err) {
      toast.error("Audio blocked", {
        description: "Tap play again after interacting with the page.",
      })
      console.error(err)
    }
  }

  async function handlePause() {
    await audio.pause()
    setPlaying(false)
  }

  function handleStop() {
    audio.stop()
    setPlaying(false)
    setProgress(0)
  }

  return (
    <div className="bevel mx-auto w-full max-w-3xl space-y-4 p-3 sm:p-4">
      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-primary">
            PixelSymphony
          </h1>
          <p className="text-[10px] text-muted-foreground">
            {sampleMode ? "Sample mode · live on-chain data" : "Token-gated player"}
          </p>
        </div>
        <SkinSwitcher value={skin} onChange={setSkin} />
      </div>

      <NormiePicker
        availableIds={availableIds}
        selected={selected}
        onChange={setSelected}
        disabled={loading}
      />

      {loading ? (
        <LoadingIcon
          label={
            selected.length > 6
              ? `Tuning the hive (${selected.length} voices)…`
              : "Decoding pixels into song…"
          }
        />
      ) : (
        <Visualizer
          voices={voices}
          skin={skin}
          progress={progress}
          canvasRef={visualCanvasRef}
        />
      )}

      {/* Transport */}
      <div className="bevel-inset flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          {!playing ? (
            <button
              type="button"
              className="btn-retro btn-retro-active inline-flex items-center gap-2"
              disabled={!score || loading}
              onClick={handlePlay}
            >
              <Play className="size-3.5 fill-current" />
              Play
            </button>
          ) : (
            <button
              type="button"
              className="btn-retro inline-flex items-center gap-2"
              onClick={handlePause}
            >
              <Pause className="size-3.5" />
              Pause
            </button>
          )}
          <button
            type="button"
            className="btn-retro inline-flex items-center gap-2"
            disabled={!score}
            onClick={handleStop}
          >
            <Square className="size-3 fill-current" />
            Stop
          </button>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(v) => {
              const next = Array.isArray(v) ? v[0] : v
              setVolume(typeof next === "number" ? next : 0.7)
            }}
            className="w-full"
            aria-label="Volume"
          />
        </div>
      </div>

      {needsGesture && score && (
        <p className="text-center text-[10px] text-muted-foreground">
          Mobile: tap Play once to unlock audio (browser autoplay policy).
        </p>
      )}

      <SynopsisPanel score={score} voices={voices} />

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Share Blip
        </h3>
        <BlipShare
          disabled={!score || loading}
          getCanvas={() => visualCanvasRef.current}
          title={
            voices.length === 1
              ? `${voices[0]?.name ?? "Normie"} · PixelSymphony`
              : `Hive of ${voices.length} · PixelSymphony`
          }
          shareText={
            voices.length
              ? `${voices.length === 1 ? voices[0]?.name : `${voices.length} Normies`} singing on PixelSymphony — tune into the hive. #PixelSymphony #Normies`
              : undefined
          }
        />
      </div>
    </div>
  )
}

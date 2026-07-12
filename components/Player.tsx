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

  const statusLabel = loading
    ? "OPENING…"
    : playing
      ? "PLAYING"
      : score
        ? "READY"
        : "STOPPED"

  const trackLabel =
    voices.length === 0
      ? "No track loaded"
      : voices.length === 1
        ? (voices[0]?.name ?? `Normie #${voices[0]?.tokenId}`)
        : `Hive · ${voices.length} Normies`

  return (
    <div className="wmp-player mx-auto w-full max-w-3xl">
      {/* Outer Win98 chrome + CRT glass */}
      <div className="wmp-shell">
        <div className="wmp-crt-glow" aria-hidden />
        <div className="wmp-scanlines" aria-hidden />

        {/* Classic title bar */}
        <header className="wmp-titlebar">
          <div className="wmp-titlebar-scan" aria-hidden />
          <div className="wmp-titlebar-inner">
            <div className="wmp-titlebar-left">
              <span className="wmp-app-icon" aria-hidden>
                ▣
              </span>
              <div className="min-w-0">
                <h1 className="wmp-title">PixelSymphony</h1>
                <p className="wmp-subtitle">
                  {sampleMode
                    ? "Sample mode · live on-chain data"
                    : "Token-gated player"}
                </p>
              </div>
            </div>
            <div className="wmp-titlebar-right">
              <div className="wmp-skin-slot">
                <SkinSwitcher value={skin} onChange={setSkin} />
              </div>
              <div className="wmp-window-controls" aria-hidden>
                <span className="wmp-win-btn">_</span>
                <span className="wmp-win-btn">□</span>
                <span className="wmp-win-btn wmp-win-btn-close">×</span>
              </div>
            </div>
          </div>
        </header>

        {/* Body panels */}
        <div className="wmp-body">
          {/* Playlist / hive select */}
          <section className="wmp-panel">
            <div className="wmp-panel-label">
              <span>Playlist</span>
              <span className="wmp-panel-hint">select voices</span>
            </div>
            <div className="wmp-panel-inset">
              <NormiePicker
                availableIds={availableIds}
                selected={selected}
                onChange={setSelected}
                disabled={loading}
              />
            </div>
          </section>

          {/* Visualization “screen” */}
          <section className="wmp-panel wmp-viz-panel">
            <div className="wmp-panel-label">
              <span>Visualization</span>
              <span className="wmp-panel-hint">
                {playing ? "// LIVE" : "// STANDBY"}
              </span>
            </div>
            <div className="wmp-screen">
              <div className="wmp-screen-scan" aria-hidden />
              <div className="wmp-screen-vignette" aria-hidden />
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
            </div>
            {/* Seek / progress like WMP timeline */}
            <div className="wmp-seek">
              <div className="wmp-seek-track">
                <div
                  className="wmp-seek-fill"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span className="wmp-seek-pct">{Math.round(progress * 100)}%</span>
            </div>
          </section>

          {/* Transport */}
          <section className="wmp-panel">
            <div className="wmp-panel-label">
              <span>Transport</span>
              <span className="wmp-panel-hint">{statusLabel}</span>
            </div>
            <div className="wmp-transport bevel-inset">
              <div className="flex flex-wrap items-center gap-2">
                {!playing ? (
                  <button
                    type="button"
                    className="btn-retro btn-retro-active wmp-transport-btn inline-flex items-center gap-2"
                    disabled={!score || loading}
                    onClick={handlePlay}
                  >
                    <Play className="size-3.5 fill-current" />
                    Play
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-retro wmp-transport-btn inline-flex items-center gap-2"
                    onClick={handlePause}
                  >
                    <Pause className="size-3.5" />
                    Pause
                  </button>
                )}
                <button
                  type="button"
                  className="btn-retro wmp-transport-btn inline-flex items-center gap-2"
                  disabled={!score}
                  onClick={handleStop}
                >
                  <Square className="size-3 fill-current" />
                  Stop
                </button>
              </div>
              <div className="wmp-volume flex flex-1 items-center gap-2">
                <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="wmp-vol-label">Vol</span>
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
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Mobile: tap Play once to unlock audio (browser autoplay policy).
              </p>
            )}
          </section>

          {/* Synopsis */}
          <section className="wmp-panel">
            <div className="wmp-panel-label">
              <span>Now Playing Info</span>
              <span className="wmp-panel-hint">synopsis</span>
            </div>
            <div className="wmp-panel-inset">
              <SynopsisPanel score={score} voices={voices} />
            </div>
          </section>

          {/* Share */}
          <section className="wmp-panel">
            <div className="wmp-panel-label">
              <span>Media Library</span>
              <span className="wmp-panel-hint">share blip</span>
            </div>
            <div className="wmp-panel-inset space-y-2">
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
          </section>
        </div>

        {/* Status bar */}
        <footer className="wmp-statusbar">
          <span className="wmp-status-led" data-on={playing ? "1" : "0"} />
          <span className="wmp-status-text truncate">{trackLabel}</span>
          <span className="wmp-status-sep" aria-hidden>
            |
          </span>
          <span className="wmp-status-meta">
            {score ? `${score.bpm} BPM · ${score.root} ${score.scale}` : "—"}
          </span>
          <span className="wmp-status-sep" aria-hidden>
            |
          </span>
          <span className="wmp-status-meta uppercase tracking-wider">
            {statusLabel}
          </span>
        </footer>
      </div>
    </div>
  )
}

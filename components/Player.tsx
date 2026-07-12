"use client"

import {
  Disc3,
  Info,
  ListMusic,
  Pause,
  Play,
  Radio,
  Share2,
  Square,
  Volume2,
  Wand2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { BlipShare } from "@/components/BlipShare"
import { HowItWorks } from "@/components/HowItWorks"
import { LoadingIcon } from "@/components/LoadingIcon"
import { NormiePicker } from "@/components/NormiePicker"
import { SkinSwitcher } from "@/components/SkinSwitcher"
import { SynopsisPanel } from "@/components/SynopsisPanel"
import { Visualizer } from "@/components/Visualizer"
import { Slider } from "@/components/ui/slider"
import { composeScore } from "@/lib/compose"
import * as audio from "@/lib/audio"
import { fetchNormieVoices } from "@/lib/normies"
import type { NormieVoiceInput, SkinId, VoiceScore } from "@/lib/types"
import { cn } from "@/lib/utils"

const SKIN_KEY = "pixelsymphony-skin"

type PanelId = "playlist" | "controls" | "synopsis" | "skins" | "signal" | "share"

const PANEL_META: {
  id: PanelId
  label: string
  hint: string
  icon: React.ReactNode
  side: "left" | "right" | "bottom"
}[] = [
  {
    id: "playlist",
    label: "Playlist",
    hint: "Pick Normies",
    icon: <ListMusic className="size-3.5" />,
    side: "left",
  },
  {
    id: "controls",
    label: "Transport",
    hint: "Play / Vol",
    icon: <Radio className="size-3.5" />,
    side: "bottom",
  },
  {
    id: "synopsis",
    label: "Synopsis",
    hint: "Now playing",
    icon: <Disc3 className="size-3.5" />,
    side: "right",
  },
  {
    id: "skins",
    label: "Skins",
    hint: "Look & feel",
    icon: <Wand2 className="size-3.5" />,
    side: "right",
  },
  {
    id: "signal",
    label: "Signal",
    hint: "How it works",
    icon: <Info className="size-3.5" />,
    side: "left",
  },
  {
    id: "share",
    label: "Share",
    hint: "Blip / social",
    icon: <Share2 className="size-3.5" />,
    side: "bottom",
  },
]

export function Player({
  availableIds,
  initialSelected = [],
  sampleMode = false,
}: {
  availableIds: number[]
  initialSelected?: number[]
  sampleMode?: boolean
}) {
  const router = useRouter()
  const [skin, setSkin] = useState<SkinId>("classic")
  const [selected, setSelected] = useState<number[]>(initialSelected)
  const [voices, setVoices] = useState<NormieVoiceInput[]>([])
  const [score, setScore] = useState<VoiceScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [needsGesture, setNeedsGesture] = useState(true)
  const [openPanel, setOpenPanel] = useState<PanelId | null>("controls")
  const [menuHint, setMenuHint] = useState(true)
  const rafRef = useRef<number | null>(null)
  const visualCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SKIN_KEY) as SkinId | null
      if (
        saved &&
        ["classic", "minimal", "crt", "pixel-forest"].includes(saved)
      ) {
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

  // Dismiss discovery hint after first panel interaction
  useEffect(() => {
    if (openPanel && openPanel !== "controls") setMenuHint(false)
  }, [openPanel])

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
      const s = composeScore(v)
      setScore(s)
      await audio.loadScore(s)
      if (ids.length > 1) {
        toast.message(`Forest mix · ${ids.length} Normies`, {
          description: `${s.parts.length} layers from live pixels + traits`,
        })
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

  function togglePanel(id: PanelId) {
    setOpenPanel((cur) => (cur === id ? null : id))
    setMenuHint(false)
  }

  function handleClose() {
    handleStop()
    router.push("/")
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
        : `Ensemble · ${voices.length} Normies`

  const activeMeta = PANEL_META.find((p) => p.id === openPanel)

  return (
    <div className="ps-stage-root mx-auto w-full max-w-5xl">
      <div className="wmp-shell ps-stage-shell">
        <div className="wmp-crt-glow" aria-hidden />
        <div className="wmp-scanlines" aria-hidden />

        {/* —— Title bar —— */}
        <header className="wmp-titlebar ps-titlebar">
          <div className="wmp-titlebar-scan" aria-hidden />
          <div className="wmp-titlebar-inner">
            <button
              type="button"
              className="wmp-titlebar-left ps-title-hit"
              onClick={() => togglePanel("signal")}
              title="About the signal path"
            >
              <span className="wmp-app-icon" aria-hidden>
                ▣
              </span>
              <div className="min-w-0 text-left">
                <h1 className="wmp-title">PixelSymphony</h1>
                <p className="wmp-subtitle">
                  {sampleMode
                    ? "Sample mode · live on-chain data"
                    : "Token-gated player"}
                  {menuHint ? " · click panels to explore" : ""}
                </p>
              </div>
            </button>

            <div className="wmp-titlebar-right">
              <div className="wmp-window-controls">
                <button
                  type="button"
                  className="wmp-win-btn"
                  title="Minimize (decorative)"
                  onClick={() =>
                    toast.message("Minimized… not really", {
                      description: "Classic fake chrome. Try the drawer buttons!",
                    })
                  }
                >
                  _
                </button>
                <button
                  type="button"
                  className="wmp-win-btn"
                  title="Maximize (decorative)"
                  onClick={() =>
                    toast.message("Already maximized", {
                      description: "The stage is the whole world.",
                    })
                  }
                >
                  □
                </button>
                <button
                  type="button"
                  className="wmp-win-btn wmp-win-btn-close"
                  title="Close — back to landing"
                  onClick={handleClose}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* —— Stage body —— */}
        <div className="ps-stage-body">
          {/* Drawer rail */}
          <nav className="ps-drawer-rail" aria-label="Player panels">
            {PANEL_META.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "ps-drawer-btn",
                  openPanel === p.id && "ps-drawer-btn-on",
                )}
                onClick={() => togglePanel(p.id)}
                title={`${p.label} — ${p.hint}`}
              >
                {p.icon}
                <span className="ps-drawer-btn-label">{p.label}</span>
              </button>
            ))}
          </nav>

          {/* Center stage */}
          <div className="ps-stage-center">
            <div className="ps-stage-screen">
              <div className="wmp-screen-scan" aria-hidden />
              <div className="wmp-screen-vignette" aria-hidden />
              <div className="ps-stage-viz">
                {loading ? (
                  <LoadingIcon
                    label={
                      selected.length > 6
                        ? `Tuning the forest (${selected.length} voices)…`
                        : "Decoding pixels into song…"
                    }
                  />
                ) : (
                  <Visualizer
                    voices={voices}
                    skin={skin}
                    progress={progress}
                    canvasRef={visualCanvasRef}
                    className="ps-viz-fill"
                  />
                )}
              </div>
              <div className="ps-stage-live" data-on={playing ? "1" : "0"}>
                {playing ? "● LIVE" : "○ STANDBY"}
              </div>
            </div>

            {/* Always-visible mini transport + seek */}
            <div className="ps-dock">
              <div className="ps-dock-transport">
                {!playing ? (
                  <button
                    type="button"
                    className="btn-retro btn-retro-active ps-big-play"
                    disabled={!score || loading}
                    onClick={handlePlay}
                  >
                    <Play className="size-4 fill-current" />
                    Play
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-retro ps-big-play"
                    onClick={handlePause}
                  >
                    <Pause className="size-4" />
                    Pause
                  </button>
                )}
                <button
                  type="button"
                  className="btn-retro"
                  disabled={!score}
                  onClick={handleStop}
                >
                  <Square className="size-3 fill-current" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "btn-retro",
                    openPanel === "controls" && "btn-retro-active",
                  )}
                  onClick={() => togglePanel("controls")}
                  title="More controls"
                >
                  <Volume2 className="size-3.5" />
                </button>
              </div>
              <div className="wmp-seek ps-dock-seek">
                <div className="wmp-seek-track">
                  <div
                    className="wmp-seek-fill"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <span className="wmp-seek-pct">
                  {Math.round(progress * 100)}%
                </span>
              </div>
              {needsGesture && score && (
                <p className="ps-gesture-hint">
                  Mobile: tap Play once to unlock audio
                </p>
              )}
            </div>

            {menuHint && (
              <p className="ps-discover-hint">
                ✦ Click glowing tabs to unfold playlist, synopsis, skins & share
              </p>
            )}
          </div>

          {/* Slide-out panel */}
          <aside
            className={cn(
              "ps-slide-panel",
              openPanel && "ps-slide-panel-open",
              activeMeta && `ps-slide-${activeMeta.side}`,
            )}
            aria-hidden={!openPanel}
          >
            {openPanel && (
              <>
                <div className="ps-slide-head">
                  <div>
                    <h2 className="ps-slide-title">
                      {activeMeta?.label ?? "Panel"}
                    </h2>
                    <p className="ps-slide-hint">{activeMeta?.hint}</p>
                  </div>
                  <button
                    type="button"
                    className="wmp-win-btn wmp-win-btn-close"
                    onClick={() => setOpenPanel(null)}
                    title="Close panel"
                  >
                    ×
                  </button>
                </div>
                <div className="ps-slide-body">
                  {openPanel === "playlist" && (
                    <NormiePicker
                      availableIds={availableIds}
                      selected={selected}
                      onChange={setSelected}
                      disabled={loading}
                    />
                  )}
                  {openPanel === "controls" && (
                    <div className="space-y-4">
                      <div className="wmp-transport bevel-inset !flex-col !items-stretch">
                        <div className="flex flex-wrap items-center gap-2">
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
                          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                            {statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
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
                      <p className="text-[10px] text-muted-foreground">
                        Tip: double-click the stage title bar for signal path.
                      </p>
                    </div>
                  )}
                  {openPanel === "synopsis" && (
                    <SynopsisPanel score={score} voices={voices} />
                  )}
                  {openPanel === "skins" && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Switch the CRT look. Your pick is remembered.
                      </p>
                      <SkinSwitcher value={skin} onChange={setSkin} />
                    </div>
                  )}
                  {openPanel === "signal" && <HowItWorks />}
                  {openPanel === "share" && (
                    <BlipShare
                      disabled={!score || loading}
                      getCanvas={() => visualCanvasRef.current}
                      title={
                        voices.length === 1
                          ? `${voices[0]?.name ?? "Normie"} · PixelSymphony`
                          : `${voices.length} Normies · PixelSymphony`
                      }
                      shareText={
                        voices.length
                          ? `${voices.length === 1 ? voices[0]?.name : `${voices.length} Normies`} singing on PixelSymphony — tune in. #PixelSymphony #Normies`
                          : undefined
                      }
                    />
                  )}
                </div>
              </>
            )}
          </aside>
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
          {openPanel && (
            <>
              <span className="wmp-status-sep" aria-hidden>
                |
              </span>
              <span className="wmp-status-meta text-primary">
                [{activeMeta?.label}]
              </span>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

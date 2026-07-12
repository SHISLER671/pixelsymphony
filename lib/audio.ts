"use client"

import type { SynthType, VoiceScore } from "@/lib/types"

type ToneModule = typeof import("tone")

let tone: ToneModule | null = null
let unlocked = false
let currentScore: VoiceScore | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sequences: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let synths: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fxNodes: any[] = []
let mediaDest: MediaStreamAudioDestinationNode | null = null
let recorder: MediaRecorder | null = null
let recordChunks: Blob[] = []
let volumeDb = -6

async function getTone(): Promise<ToneModule> {
  if (!tone) {
    tone = await import("tone")
  }
  return tone
}

function createSynth(
  T: ToneModule,
  type: SynthType,
  filterHz: number,
  gain: number,
  dest: InstanceType<ToneModule["Gain"]>,
) {
  const filter = new T.Filter({
    frequency: filterHz,
    type: "lowpass",
    Q: 1.2,
  })
  const vol = new T.Volume(T.gainToDb(Math.max(0.01, Math.min(1, gain))))
  const oscType =
    type === "pulse" ? "square" : (type as "square" | "sawtooth" | "triangle")

  // Chiptune envelopes — snappy, not a sustained hum
  const synth = new T.MonoSynth({
    oscillator: { type: oscType },
    envelope: {
      attack: 0.005,
      decay: 0.12,
      sustain: 0.08,
      release: 0.08,
    },
    filterEnvelope: {
      attack: 0.005,
      decay: 0.08,
      sustain: 0.15,
      release: 0.1,
      baseFrequency: Math.max(120, filterHz * 0.35),
      octaves: 2.5,
    },
  })

  synth.chain(filter, vol, dest)

  return {
    triggerAttackRelease: (
      note: string,
      duration: number,
      time?: number,
    ) => {
      if (note === "rest" || !note) return
      try {
        // Cap note length so mono voice doesn't drone
        const dur = Math.min(duration, 0.35)
        synth.triggerAttackRelease(note, dur, time)
      } catch {
        // invalid note skipped
      }
    },
    releaseAll: (time?: number) => {
      try {
        synth.triggerRelease(time)
      } catch {
        /* ignore */
      }
    },
    dispose: () => {
      try {
        synth.dispose()
        filter.dispose()
        vol.dispose()
      } catch {
        /* ignore */
      }
    },
  }
}

export async function unlockAudio(): Promise<void> {
  const T = await getTone()
  await T.start()
  unlocked = true
}

export function isAudioUnlocked(): boolean {
  return unlocked
}

export async function loadScore(score: VoiceScore): Promise<void> {
  const T = await getTone()
  stop()
  disposeGraph()

  currentScore = score
  T.Transport.bpm.value = score.bpm
  T.Transport.swing = 0
  T.getDestination().volume.value = volumeDb

  // Light bus FX for glue (not muddy)
  const bus = new T.Gain(1)
  const delay = new T.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.12,
    wet: 0.12,
  })
  bus.chain(delay, T.getDestination())
  fxNodes.push(bus, delay)

  try {
    const ctx = T.getContext().rawContext as AudioContext
    mediaDest = ctx.createMediaStreamDestination()
    // Tap master for recording when possible
    try {
      delay.connect(mediaDest as unknown as import("tone").ToneAudioNode)
    } catch {
      /* optional */
    }
  } catch {
    mediaDest = null
  }

  for (const part of score.parts) {
    const s = createSynth(T, part.synth, part.filterHz, part.gain, bus)
    synths.push(s)

    let t = 0
    const events: Array<{ time: number; note: string; dur: number }> = []
    for (let i = 0; i < part.notes.length; i++) {
      const dur = Math.max(0.03, part.durations[i] ?? 0.1)
      const note = part.notes[i]
      if (note && note !== "rest") {
        events.push({ time: t, note, dur })
      }
      t += Math.max(0.03, part.durations[i] ?? 0.1)
    }

    // Align all parts to the same loop length (max part length)
    const loopEnd = t || (60 / score.bpm) * 8

    if (events.length === 0) continue

    const seq = new T.Part((time, ev) => {
      if (!ev || typeof ev === "number") return
      const event = ev as { note: string; dur: number }
      s.triggerAttackRelease(event.note, event.dur, time)
    }, events)

    seq.loop = true
    seq.loopEnd = loopEnd
    seq.start(0)
    sequences.push(seq)
  }

  // Normalize loop ends to longest sequence so multi-parts stay locked
  let maxLoop = 0
  for (const seq of sequences) {
    if (typeof seq.loopEnd === "number" && seq.loopEnd > maxLoop) {
      maxLoop = seq.loopEnd
    }
  }
  if (maxLoop > 0) {
    for (const seq of sequences) {
      seq.loopEnd = maxLoop
    }
  }
}

export async function play(): Promise<void> {
  const T = await getTone()
  if (!unlocked) await unlockAudio()
  if (!currentScore) return
  T.Transport.start()
}

export async function pause(): Promise<void> {
  const T = await getTone()
  T.Transport.pause()
  for (const s of synths) {
    try {
      s.releaseAll?.()
    } catch {
      /* ignore */
    }
  }
}

export function stop(): void {
  if (!tone) return
  for (const s of synths) {
    try {
      s.releaseAll?.()
    } catch {
      /* ignore */
    }
  }
  tone.Transport.stop()
  tone.Transport.position = 0
}

export function setVolume(linear: number): void {
  volumeDb = linear <= 0 ? -60 : 20 * Math.log10(linear) - 6
  if (tone) {
    tone.getDestination().volume.value = volumeDb
  }
}

export function getTransportProgress(): number {
  if (!tone || !currentScore) return 0
  try {
    const pos = tone.Transport.seconds
    const part = currentScore.parts[0]
    if (!part) return 0
    const len = part.durations.reduce((a, b) => a + b, 0) || 8
    return (pos % len) / len
  } catch {
    return 0
  }
}

export async function startRecording(): Promise<void> {
  if (!mediaDest) {
    const T = await getTone()
    const ctx = T.getContext().rawContext as AudioContext
    mediaDest = ctx.createMediaStreamDestination()
  }
  if (!mediaDest) throw new Error("Recording not available in this browser")

  recordChunks = []
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm"
  recorder = new MediaRecorder(mediaDest.stream, { mimeType: mime })
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordChunks.push(e.data)
  }
  recorder.start(100)
}

export function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!recorder) {
      reject(new Error("Not recording"))
      return
    }
    recorder.onstop = () => {
      const blob = new Blob(recordChunks, {
        type: recorder?.mimeType || "audio/webm",
      })
      recorder = null
      resolve(blob)
    }
    recorder.stop()
  })
}

function disposeGraph(): void {
  for (const s of sequences) {
    try {
      s.dispose()
    } catch {
      /* ignore */
    }
  }
  sequences = []
  for (const s of synths) {
    try {
      s.dispose()
    } catch {
      /* ignore */
    }
  }
  synths = []
  for (const n of fxNodes) {
    try {
      n.dispose()
    } catch {
      /* ignore */
    }
  }
  fxNodes = []
}

export function disposeAudio(): void {
  stop()
  disposeGraph()
  currentScore = null
}

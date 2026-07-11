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
) {
  const filter = new T.Filter(filterHz, "lowpass")
  const vol = new T.Volume(T.gainToDb(Math.max(0.01, gain)))
  const oscType =
    type === "pulse" ? "square" : (type as "square" | "sawtooth" | "triangle")

  const synth = new T.MonoSynth({
    oscillator: { type: oscType },
    envelope: {
      attack: 0.02,
      decay: 0.15,
      sustain: 0.35,
      release: 0.35,
    },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.2,
      release: 0.4,
      baseFrequency: filterHz * 0.5,
      octaves: 2,
    },
  })

  synth.chain(filter, vol, T.getDestination())
  if (mediaDest) {
    vol.connect(mediaDest as unknown as import("tone").ToneAudioNode)
  }

  return {
    triggerAttackRelease: (
      note: string,
      duration: number,
      time?: number,
    ) => {
      if (note === "rest" || !note) return
      try {
        synth.triggerAttackRelease(note, duration, time)
      } catch {
        // invalid note names are skipped
      }
    },
    dispose: () => {
      synth.dispose()
      filter.dispose()
      vol.dispose()
    },
    volume: vol,
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
  T.getDestination().volume.value = volumeDb

  // Media stream tap for recording
  try {
    const ctx = T.getContext().rawContext as AudioContext
    mediaDest = ctx.createMediaStreamDestination()
  } catch {
    mediaDest = null
  }

  for (const part of score.parts) {
    const s = createSynth(T, part.synth, part.filterHz, part.gain)
    synths.push(s)

    let t = 0
    const events: Array<{ time: number; note: string; dur: number }> = []
    for (let i = 0; i < part.notes.length; i++) {
      const dur = part.durations[i] ?? 0.25
      events.push({ time: t, note: part.notes[i], dur })
      t += dur
    }

    const seq = new T.Part(
      (time, ev) => {
        if (!ev || typeof ev === "number") return
        const event = ev as { note: string; dur: number }
        s.triggerAttackRelease(event.note, event.dur, time)
      },
      events.map((e) => ({ time: e.time, note: e.note, dur: e.dur })),
    )

    seq.loop = true
    seq.loopEnd = t || 8
    seq.start(0)
    sequences.push(seq)
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
}

export function stop(): void {
  if (!tone) return
  tone.Transport.stop()
  tone.Transport.position = 0
}

export function setVolume(linear: number): void {
  // linear 0–1
  volumeDb = linear <= 0 ? -60 : 20 * Math.log10(linear) - 6
  if (tone) {
    tone.getDestination().volume.value = volumeDb
  }
}

export function getTransportProgress(): number {
  if (!tone || !currentScore) return 0
  try {
    const pos = tone.Transport.seconds
    // Approximate loop length from primary part
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
    // Re-route would require reload — capture destination via monitor when possible
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
}

export function disposeAudio(): void {
  stop()
  disposeGraph()
  currentScore = null
}

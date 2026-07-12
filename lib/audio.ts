"use client"

import type { InstrumentId, VoicePart, VoiceScore } from "@/lib/types"

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
let volumeDb = -8

async function getTone(): Promise<ToneModule> {
  if (!tone) tone = await import("tone")
  return tone
}

type Playable = {
  triggerAttackRelease: (note: string, duration: number, time?: number) => void
  releaseAll?: (time?: number) => void
  dispose: () => void
}

function envOpts(part: VoicePart) {
  return {
    attack: part.attack ?? 0.05,
    decay: part.decay ?? 0.2,
    sustain: part.sustain ?? 0.4,
    release: part.release ?? 0.35,
  }
}

function createInstrument(
  T: ToneModule,
  part: VoicePart,
  dest: InstanceType<ToneModule["Gain"]>,
): Playable {
  const instrument: InstrumentId = part.instrument || "human-lead"
  const filter = new T.Filter({
    frequency: part.filterHz,
    type: "lowpass",
    Q: instrument === "bass-sub" ? 0.7 : 1.1,
  })
  const panner = new T.Panner(part.pan ?? 0)
  const vol = new T.Volume(
    T.gainToDb(Math.max(0.01, Math.min(0.9, part.gain))),
  )
  const env = envOpts(part)
  const nodes: { dispose: () => void }[] = [filter, panner, vol]

  let trigger: (note: string, duration: number, time?: number) => void
  let releaseAll: ((time?: number) => void) | undefined

  switch (instrument) {
    case "agent-pad": {
      const s = new T.FMSynth({
        harmonicity: 2.5,
        modulationIndex: 8,
        oscillator: { type: "sine" },
        envelope: env,
        modulation: { type: "triangle" },
        modulationEnvelope: {
          attack: env.attack * 1.2,
          decay: 0.3,
          sustain: 0.4,
          release: env.release,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttackRelease(note, dur, time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
    case "choir-ah": {
      const s = new T.AMSynth({
        harmonicity: 1.5,
        oscillator: { type: "sine" },
        envelope: { ...env, attack: Math.max(0.15, env.attack) },
        modulation: { type: "sine" },
        modulationEnvelope: {
          attack: 0.2,
          decay: 0.2,
          sustain: 0.5,
          release: 0.6,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttackRelease(note, dur, time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
    case "alien-bell": {
      const s = new T.FMSynth({
        harmonicity: 8,
        modulationIndex: 22,
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.01,
          decay: 0.4,
          sustain: 0.15,
          release: Math.max(0.5, env.release),
        },
        modulation: { type: "square" },
        modulationEnvelope: {
          attack: 0.01,
          decay: 0.5,
          sustain: 0.1,
          release: 0.5,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttackRelease(note, dur, time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
    case "cat-pluck": {
      const s = new T.PluckSynth({
        attackNoise: 0.5,
        dampening: part.filterHz,
        resonance: 0.85,
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttack(note, time)
      break
    }
    case "bass-sub": {
      const s = new T.MonoSynth({
        oscillator: { type: "fatsawtooth", count: 2, spread: 12 },
        envelope: { ...env, attack: 0.02, sustain: 0.55 },
        filterEnvelope: {
          attack: 0.02,
          decay: 0.25,
          sustain: 0.2,
          release: 0.3,
          baseFrequency: 60,
          octaves: 2.5,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttackRelease(note, dur, time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
    case "arp-pulse": {
      const s = new T.MonoSynth({
        oscillator: { type: "square" },
        envelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.1,
          release: 0.08,
        },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.1,
          release: 0.1,
          baseFrequency: part.filterHz * 0.4,
          octaves: 3,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) =>
        s.triggerAttackRelease(note, Math.min(dur, 0.2), time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
    case "glass-keys": {
      const s = new T.Synth({
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.2,
          release: 0.4,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttackRelease(note, dur, time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
    case "noise-breath": {
      const s = new T.NoiseSynth({
        noise: { type: "pink" },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0,
          release: 0.2,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (_note, dur, time) => s.triggerAttackRelease(dur * 0.5, time)
      break
    }
    case "human-lead":
    default: {
      const s = new T.MonoSynth({
        oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
        envelope: env,
        filterEnvelope: {
          attack: env.attack,
          decay: env.decay,
          sustain: 0.25,
          release: env.release,
          baseFrequency: Math.max(200, part.filterHz * 0.3),
          octaves: 2.8,
        },
      })
      s.chain(filter, panner, vol, dest)
      nodes.push(s)
      trigger = (note, dur, time) => s.triggerAttackRelease(note, dur, time)
      releaseAll = (t) => s.triggerRelease(t)
      break
    }
  }

  return {
    triggerAttackRelease: (note, duration, time) => {
      if (!note || note === "rest") return
      try {
        // Long forest pings / pads (tails live in reverb)
        const dur = Math.min(Math.max(duration, 0.05), 6)
        trigger(note, dur, time)
      } catch {
        /* skip bad notes */
      }
    },
    releaseAll,
    dispose: () => {
      for (const n of nodes) {
        try {
          n.dispose()
        } catch {
          /* */
        }
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
  T.Transport.swing = score.swing ?? 0.02
  T.Transport.swingSubdivision = "4n"
  T.getDestination().volume.value = volumeDb

  // Forest bus: musical glue without drowning phrases
  const bus = new T.Gain(0.9)
  const chorus = new T.Chorus({
    frequency: 0.55,
    delayTime: 3.8,
    depth: 0.4,
    wet: 0.2,
  }).start()
  const delay = new T.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.26,
    wet: 0.18,
  })
  const reverb = new T.Reverb({ decay: 4.2, preDelay: 0.025, wet: 0.32 })
  await reverb.generate()
  bus.chain(chorus, delay, reverb, T.getDestination())
  fxNodes.push(bus, chorus, delay, reverb)

  try {
    const ctx = T.getContext().rawContext as AudioContext
    mediaDest = ctx.createMediaStreamDestination()
    try {
      reverb.connect(mediaDest as unknown as import("tone").ToneAudioNode)
    } catch {
      /* optional */
    }
  } catch {
    mediaDest = null
  }

  const fromParts = score.parts.reduce((max, part) => {
    const len = part.durations.reduce(
      (a, b) => a + Math.max(0.05, Math.min(b, 4)),
      0,
    )
    return Math.max(max, len)
  }, 0)
  const sharedLoop =
    score.loopSeconds ?? (fromParts > 0 ? fromParts : (60 / score.bpm) * 64)

  for (const part of score.parts) {
    const s = createInstrument(T, part, bus)
    synths.push(s)

    let t = 0
    const events: Array<{ time: number; note: string; dur: number }> = []
    for (let i = 0; i < part.notes.length; i++) {
      const rawDur = part.durations[i] ?? 0.25
      const dur = Math.max(0.05, rawDur)
      const note = part.notes[i]
      if (note && note !== "rest") {
        events.push({ time: t, note, dur })
      }
      // Grid advance (allow longer held pings without collapsing the cycle)
      t += Math.max(0.08, Math.min(rawDur, 4))
    }

    if (events.length === 0) continue

    const seq = new T.Part((time, ev) => {
      if (!ev || typeof ev === "number") return
      const event = ev as { note: string; dur: number }
      s.triggerAttackRelease(event.note, event.dur, time)
    }, events)

    seq.loop = true
    seq.loopEnd = sharedLoop
    // Mycelium stagger: nodes enter the network at different points
    const offset = Math.max(0, part.startOffset ?? 0) % sharedLoop
    seq.start(offset)
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
  for (const s of synths) {
    try {
      s.releaseAll?.()
    } catch {
      /* */
    }
  }
}

export function stop(): void {
  if (!tone) return
  for (const s of synths) {
    try {
      s.releaseAll?.()
    } catch {
      /* */
    }
  }
  tone.Transport.stop()
  tone.Transport.position = 0
}

export function setVolume(linear: number): void {
  volumeDb = linear <= 0 ? -60 : 20 * Math.log10(linear) - 8
  if (tone) tone.getDestination().volume.value = volumeDb
}

export function getTransportProgress(): number {
  if (!tone || !currentScore) return 0
  try {
    const pos = tone.Transport.seconds
    const len =
      currentScore.loopSeconds ||
      currentScore.parts[0]?.durations.reduce(
        (a, b) => a + Math.max(0.05, Math.min(b, 4)),
        0,
      ) ||
      32
    return (pos % len) / len
  } catch {
    return 0
  }
}

/** Live MediaStream of the master bus (for video blips / share). */
export function getRecordingStream(): MediaStream | null {
  return mediaDest?.stream ?? null
}

/** Ensure the stream tap exists (call after loadScore / unlock). */
export async function ensureRecordingTap(): Promise<MediaStream | null> {
  if (mediaDest?.stream) return mediaDest.stream
  try {
    const T = await getTone()
    const ctx = T.getContext().rawContext as AudioContext
    mediaDest = ctx.createMediaStreamDestination()
    // Best-effort: destination monitor
    try {
      T.getDestination().connect(
        mediaDest as unknown as import("tone").ToneAudioNode,
      )
    } catch {
      /* already connected via reverb path on loadScore */
    }
    return mediaDest.stream
  } catch {
    return null
  }
}

export async function startRecording(): Promise<void> {
  await ensureRecordingTap()
  if (!mediaDest) throw new Error("Recording not available in this browser")

  recordChunks = []
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
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
      /* */
    }
  }
  sequences = []
  for (const s of synths) {
    try {
      s.dispose()
    } catch {
      /* */
    }
  }
  synths = []
  for (const n of fxNodes) {
    try {
      n.dispose()
    } catch {
      /* */
    }
  }
  fxNodes = []
}

export function disposeAudio(): void {
  stop()
  disposeGraph()
  currentScore = null
}

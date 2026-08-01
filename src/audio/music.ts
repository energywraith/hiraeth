import { audioBus } from "./bus";

export interface LoopingMusic {
  start(): Promise<void>;
  stop(): void;
}

const CROSSFADE_SECONDS = 4;
const SCHEDULE_AHEAD_SECONDS = 6;
const SCHEDULER_INTERVAL_MS = 1500;

// Crossfades the tail of each play-through into the head of the next, so an
// AI-generated track (which has no natural loop point) still plays as one
// continuous, seamless piece instead of visibly restarting.
export function createLoopingMusic(url: string, volume = 0.5): LoopingMusic {
  let ctx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let masterGain: GainNode | null = null;
  let nextStartTime = 0;
  let schedulerId: number | null = null;
  const activeSources: AudioBufferSourceNode[] = [];

  function scheduleSource(startTime: number): void {
    const context = ctx!;
    const duration = buffer!.duration;

    const source = context.createBufferSource();
    source.buffer = buffer!;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1, startTime + CROSSFADE_SECONDS);
    gain.gain.setValueAtTime(1, startTime + duration - CROSSFADE_SECONDS);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    source.connect(gain).connect(masterGain!);
    source.start(startTime);
    source.stop(startTime + duration + 0.1);

    activeSources.push(source);
    source.onended = () => {
      const i = activeSources.indexOf(source);
      if (i !== -1) activeSources.splice(i, 1);
    };
  }

  function tick(): void {
    const context = ctx!;
    const step = buffer!.duration - CROSSFADE_SECONDS;
    while (nextStartTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
      scheduleSource(nextStartTime);
      nextStartTime += step;
    }
  }

  return {
    async start() {
      if (ctx) return;
      // The context and the mute-able master live in ./bus — this module owns
      // only its own level on that bus.
      const bus = audioBus();
      ctx = bus.ctx;
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(bus.master);

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuffer);

      nextStartTime = ctx.currentTime + 0.1;
      tick();
      schedulerId = window.setInterval(tick, SCHEDULER_INTERVAL_MS);
    },

    stop() {
      if (schedulerId !== null) {
        clearInterval(schedulerId);
        schedulerId = null;
      }
      for (const source of activeSources.splice(0)) {
        try {
          source.stop();
        } catch {
          // already stopped
        }
      }
      // The context is shared, so this only tears down its own chain.
      masterGain?.disconnect();
      masterGain = null;
      ctx = null;
      buffer = null;
    },
  };
}

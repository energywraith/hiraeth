import { audioBus } from "./bus";

export interface Ambience {
  start(): void;
  stop(): void;
}

const FADE_IN_SECONDS = 3;

// Two seconds of noise, looped. Long enough that the loop point isn't
// audible as a pattern, short enough to be cheap to build.
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** The sound of the room itself: everything here is synthesised, no audio
 * files. Deliberately sits where the music isn't — a low rumble under it and
 * a faint hiss above it — because anything in the midrange just muddies the
 * ambient track that's already playing there.
 *
 * Three layers:
 * - room tone: filtered noise, the "this is a space, not a recording" bed
 * - transformer hum: 50 Hz + its octave, the CRT's power supply
 * - line whine: 15625 Hz, the PAL horizontal scan frequency. This is the
 *   one that actually triggers the memory for anyone who sat in front of
 *   one of these. Kept very quiet on purpose: plenty of adults can't hear
 *   it at all, and on some headphones it's unpleasant, so it must never be
 *   load-bearing — it's a bonus for the people who can still hear it. */
export function createAmbience(volume = 0.5): Ambience {
  let nodes: AudioScheduledSourceNode[] = [];
  let out: GainNode | null = null;

  function layer(ctx: AudioContext, src: AudioScheduledSourceNode, gain: number, ...chain: AudioNode[]): void {
    const g = ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = src;
    for (const link of chain) node = node.connect(link);
    node.connect(g).connect(out!);
    src.start();
    nodes.push(src);
  }

  return {
    start(): void {
      if (out) return;
      const { ctx, master } = audioBus();

      out = ctx.createGain();
      out.gain.setValueAtTime(0, ctx.currentTime);
      out.gain.linearRampToValueAtTime(volume, ctx.currentTime + FADE_IN_SECONDS);
      out.connect(master);

      const buffer = noiseBuffer(ctx);

      // Room tone: the low body of the room.
      const rumble = ctx.createBufferSource();
      rumble.buffer = buffer;
      rumble.loop = true;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 320;
      layer(ctx, rumble, 0.5, lowpass);

      // Air: the faint hiss at the top, what a quiet room sounds like when
      // you stop and listen to it.
      const air = ctx.createBufferSource();
      air.buffer = buffer;
      air.loop = true;
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 5200;
      layer(ctx, air, 0.022, highpass);

      // The monitor's power supply.
      const hum = ctx.createOscillator();
      hum.type = "sine";
      hum.frequency.value = 50;
      layer(ctx, hum, 0.035);

      const hum2 = ctx.createOscillator();
      hum2.type = "sine";
      hum2.frequency.value = 100;
      layer(ctx, hum2, 0.012);

      // The line whine.
      const whine = ctx.createOscillator();
      whine.type = "sine";
      whine.frequency.value = 15625;
      layer(ctx, whine, 0.006);
    },

    stop(): void {
      for (const node of nodes) {
        try {
          node.stop();
        } catch {
          // already stopped
        }
      }
      nodes = [];
      out?.disconnect();
      out = null;
    },
  };
}

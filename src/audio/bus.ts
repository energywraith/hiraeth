// One AudioContext and one master gain for the whole page. Everything that
// makes sound (music, ambience) hangs off this, so a single mute toggle
// catches all of it and the browser only ever has to spin up one context.
// Created lazily: browsers refuse to start a context before a user gesture,
// so the first call happens from the "click to enter" gate.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export interface AudioBus {
  ctx: AudioContext;
  master: GainNode;
}

export function audioBus(): AudioBus {
  if (!ctx || !master) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  return { ctx, master };
}

export function isMuted(): boolean {
  return muted;
}

/** Ramped rather than switched: a hard cut to zero on a bus carrying a 50 Hz
 * hum clicks audibly. */
export function setMuted(next: boolean): void {
  muted = next;
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.25);
}

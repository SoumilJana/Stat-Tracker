/**
 * StatTracker - Winner Stays Integrated Match Clock
 * Module: frontend/src/pages/ActiveMatch/timer/refereeAudio.ts
 *
 * Pure Web Audio API Procedural Whistle Synthesizer for Referee Experience.
 * Zero external audio assets, zero network latency, 100% self-contained.
 *
 * Implements:
 * 1. Short whistle on Goal Buffer start (60s goal transition).
 * 2. Double whistle on Goal Buffer end (transition to 10:00 playing).
 * 3. Long whistle on Match Expiry (countdown reaches 00:00).
 * 4. Lazy AudioContext initialization and gesture unlock (unlockAudioContext).
 * 5. Smooth gain envelopes (attack/release) preventing audio clicks/pops.
 * 6. Browser compatibility guards for environments without Web Audio API.
 */

let sharedAudioContext: AudioContext | null = null;

/**
 * Checks whether the Web Audio API is supported in the current environment.
 */
export function isAudioSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/**
 * Returns the lazily initialized singleton AudioContext, or null if unsupported.
 */
export function getAudioContext(): AudioContext | null {
  if (!isAudioSupported()) return null;

  if (!sharedAudioContext) {
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedAudioContext = new AudioCtxClass();
    } catch (err) {
      console.warn('[RefereeAudio] Failed to initialize AudioContext:', err);
      return null;
    }
  }

  return sharedAudioContext;
}

/**
 * Attempts to resume/unlock the AudioContext from user gesture interactions.
 * Required by modern browsers to bypass autoplay restrictions.
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch((err) => {
      console.warn('[RefereeAudio] AudioContext unlock failed:', err);
    });
  }
}

/**
 * Internal helper to synthesize a single whistle burst using dual-tone acoustic beating.
 * Produces an authentic referee whistle timbre with click-free gain ramping.
 */
function scheduleWhistleBurst(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  pitchGlideDown = false
): void {
  try {
    const primaryFreq = 2640; // Hz - standard referee whistle primary pitch
    const secondaryFreq = 2890; // Hz - second resonant acoustic chamber

    // Master Gain for this burst
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    // Click-free exponential envelope
    const attackTime = 0.015; // 15ms attack
    const releaseTime = 0.025; // 25ms release
    const peakVolume = 0.28;

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(peakVolume, startTime + attackTime);
    gainNode.gain.setValueAtTime(peakVolume, startTime + duration - releaseTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    // Primary Oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(primaryFreq, startTime);

    // Secondary Oscillator for acoustic trill / beating
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(secondaryFreq, startTime);

    if (pitchGlideDown) {
      // Gentle pitch glide at the tail of the long match-ending whistle
      const glideStart = startTime + duration - 0.2;
      if (glideStart > startTime) {
        osc1.frequency.setValueAtTime(primaryFreq, glideStart);
        osc1.frequency.exponentialRampToValueAtTime(2200, startTime + duration);
        osc2.frequency.setValueAtTime(secondaryFreq, glideStart);
        osc2.frequency.exponentialRampToValueAtTime(2450, startTime + duration);
      }
    }

    osc1.connect(gainNode);
    osc2.connect(gainNode);

    const stopTime = startTime + duration + 0.05;
    osc1.start(startTime);
    osc2.start(startTime);

    osc1.stop(stopTime);
    osc2.stop(stopTime);

    // Node cleanup
    osc1.onended = () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        gainNode.disconnect();
      } catch {
        // Safe disposal
      }
    };
  } catch (err) {
    console.warn('[RefereeAudio] Whistle burst scheduling error:', err);
  }
}

/**
 * 1. Short Whistle: 1 crisp burst (~180ms)
 * Triggered on Goal Buffer entry (when a goal is scored).
 */
export function playBufferStartWhistle(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  scheduleWhistleBurst(ctx, now + 0.01, 0.18);
}

/**
 * 2. Double Whistle: 2 rapid bursts (~130ms each with 70ms pause)
 * Triggered on Goal Buffer expiration (transition to 10:00 Playing Countdown).
 */
export function playBufferEndWhistle(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  // First burst
  scheduleWhistleBurst(ctx, now + 0.01, 0.13);
  // Second burst
  scheduleWhistleBurst(ctx, now + 0.01 + 0.13 + 0.07, 0.18);
}

/**
 * 3. Long Whistle: 1 sustained dramatic blast (~850ms)
 * Triggered on Match Expiry (countdown reaches 00:00).
 */
export function playMatchEndWhistle(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  scheduleWhistleBurst(ctx, now + 0.01, 0.85, true);
}

/**
 * Testing helper: resets the shared AudioContext instance.
 */
export function resetAudioContextForTesting(): void {
  if (sharedAudioContext) {
    try {
      sharedAudioContext.close().catch(() => {});
    } catch {
      // Ignore
    }
    sharedAudioContext = null;
  }
}

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let cannonAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (cannonAudioContext?.state === "closed") {
    cannonAudioContext = null;
  }

  try {
    cannonAudioContext ??= new AudioContextConstructor();
  } catch {
    return null;
  }

  return cannonAudioContext;
}

function createNoiseBuffer(context: AudioContext, durationSeconds: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    const progress = index / frameCount;
    const decay = Math.pow(1 - progress, 3.4);

    samples[index] = (Math.random() * 2 - 1) * decay;
  }

  return buffer;
}

function fireCannon(context: AudioContext): void {
  const startTime = context.currentTime;
  const durationSeconds = 0.46;

  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();

  noise.buffer = createNoiseBuffer(context, durationSeconds);
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(900, startTime);
  noiseFilter.frequency.exponentialRampToValueAtTime(110, startTime + durationSeconds);

  noiseGain.gain.setValueAtTime(0.0001, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.012);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);

  noise.connect(noiseFilter).connect(noiseGain).connect(context.destination);

  const boom = context.createOscillator();
  const boomGain = context.createGain();

  boom.type = "sine";
  boom.frequency.setValueAtTime(92, startTime);
  boom.frequency.exponentialRampToValueAtTime(38, startTime + durationSeconds);

  boomGain.gain.setValueAtTime(0.0001, startTime);
  boomGain.gain.exponentialRampToValueAtTime(0.17, startTime + 0.018);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);

  boom.connect(boomGain).connect(context.destination);

  noise.start(startTime);
  boom.start(startTime);
  noise.stop(startTime + durationSeconds);
  boom.stop(startTime + durationSeconds);
}

export function unlockCannonAudio(): void {
  const context = getAudioContext();

  if (context?.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
}

export function playCannonSound(): void {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    void context
      .resume()
      .then(() => {
        fireCannon(context);
      })
      .catch(() => undefined);

    return;
  }

  fireCannon(context);
}

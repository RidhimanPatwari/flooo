import type { PhaseId, SoundWorldId } from "../types";

interface AudioScene {
  phaseId: PhaseId;
  progress: number;
  intensity: number;
  world: SoundWorldId;
}

interface WorldGraph {
  id: SoundWorldId;
  gain: GainNode;
  filters: BiquadFilterNode[];
  layerGains: GainNode[];
  baseFilterFrequency: number;
  baseGain: number;
}

type AudioContextConstructor = typeof AudioContext;

type AudioEngineStatus = "idle" | "running" | "suspended" | "closed";

interface PanNode {
  input: AudioNode;
  output: AudioNode;
  pan?: AudioParam;
}

const PHASE_GAIN: Record<PhaseId, number> = {
  settle: 0.86,
  focus: 0.95,
  drift: 0.82,
  return: 0.72
};

const PHASE_TONE: Record<PhaseId, number> = {
  settle: 0.78,
  focus: 1,
  drift: 1.16,
  return: 0.72
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private phoneLift: GainNode | null = null;
  private delay: DelayNode | null = null;
  private wet: GainNode | null = null;
  private graphs = new Map<SoundWorldId, WorldGraph>();
  private suspendTimer = 0;
  private lastScene: AudioScene | null = null;

  async play(scene: AudioScene): Promise<AudioEngineStatus> {
    const context = this.ensureContext();
    window.clearTimeout(this.suspendTimer);

    if (context.state === "suspended") {
      await context.resume();
    }

    this.unlockOutput();
    this.playStartTone();
    this.lastScene = scene;
    this.update(scene);
    this.master?.gain.cancelScheduledValues(context.currentTime);
    this.master?.gain.setTargetAtTime(1.18, context.currentTime, 0.04);

    return this.getStatus();
  }

  pause() {
    if (!this.context || !this.master) {
      return;
    }

    const context = this.context;
    this.master.gain.cancelScheduledValues(context.currentTime);
    this.master.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
    this.suspendTimer = window.setTimeout(() => {
      if (context.state === "running") {
        context.suspend();
      }
    }, 360);
  }

  update(scene: AudioScene) {
    if (!this.context) {
      this.lastScene = scene;
      return;
    }

    this.lastScene = scene;
    const context = this.context;
    const phaseLift = 0.9 + scene.progress * 0.16;
    const intensity = clamp(scene.intensity / 100, 0.62, 1);
    const targetWorldGain = intensity * PHASE_GAIN[scene.phaseId] * phaseLift;
    const tone = PHASE_TONE[scene.phaseId] * (0.92 + scene.progress * 0.14);

    this.graphs.forEach((graph) => {
      const active = graph.id === scene.world;
      const target = active ? graph.baseGain * targetWorldGain : 0.0001;
      graph.gain.gain.cancelScheduledValues(context.currentTime);
      graph.gain.gain.setTargetAtTime(target, context.currentTime, active ? 0.18 : 0.34);

      if (active) {
        graph.filters.forEach((filter, index) => {
          const spread = 1 + index * 0.08;
          filter.frequency.setTargetAtTime(
            graph.baseFilterFrequency * tone * spread,
            context.currentTime,
            0.42
          );
        });
      }
    });

    this.wet?.gain.setTargetAtTime(0.12 + intensity * 0.2, context.currentTime, 0.4);
    this.phoneLift?.gain.setTargetAtTime(1.05 + intensity * 0.42, context.currentTime, 0.32);
    this.delay?.delayTime.setTargetAtTime(0.32 + scene.progress * 0.2, context.currentTime, 0.5);
  }

  dispose() {
    window.clearTimeout(this.suspendTimer);
    this.context?.close();
    this.context = null;
    this.master = null;
    this.phoneLift = null;
    this.delay = null;
    this.wet = null;
    this.graphs.clear();
  }

  getStatus(): AudioEngineStatus {
    if (!this.context) {
      return "idle";
    }

    return this.context.state as AudioEngineStatus;
  }

  private ensureContext() {
    if (this.context) {
      return this.context;
    }

    const Ctor = (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
      | AudioContextConstructor
      | undefined;

    if (!Ctor) {
      throw new Error("Web Audio is not available in this browser.");
    }

    const context = new Ctor();
    const master = context.createGain();
    const phoneLift = context.createGain();
    const limiter = context.createDynamicsCompressor();
    const delay = context.createDelay(1.4);
    const feedback = context.createGain();
    const wet = context.createGain();

    master.gain.value = 0.0001;
    phoneLift.gain.value = 1.28;
    limiter.threshold.value = -24;
    limiter.knee.value = 24;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.18;
    delay.delayTime.value = 0.38;
    feedback.gain.value = 0.24;
    wet.gain.value = 0.18;

    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(phoneLift);
    master.connect(phoneLift);
    phoneLift.connect(limiter);
    limiter.connect(context.destination);

    this.context = context;
    this.master = master;
    this.phoneLift = phoneLift;
    this.delay = delay;
    this.wet = wet;

    this.createSoftRain();
    this.createWindField();
    this.createWaterShimmer();
    this.createWaveTide();

    if (this.lastScene) {
      this.update(this.lastScene);
    }

    return context;
  }

  private createWorld(id: SoundWorldId, baseGain: number, baseFilterFrequency: number): WorldGraph {
    if (!this.context || !this.master || !this.delay) {
      throw new Error("Audio context has not been created.");
    }

    const gain = this.context.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);
    gain.connect(this.delay);

    const graph: WorldGraph = {
      id,
      gain,
      filters: [],
      layerGains: [],
      baseFilterFrequency,
      baseGain
    };

    this.graphs.set(id, graph);
    return graph;
  }

  private createSoftRain() {
    const graph = this.createWorld("soft-rain", 1.28, 2900);
    this.addNoiseLayer(graph, {
      seed: 1401,
      color: 0.18,
      filter: "highpass",
      frequency: 2300,
      q: 0.4,
      gain: 0.23,
      pan: -0.24,
      seconds: 2.3
    });
    this.addNoiseLayer(graph, {
      seed: 2402,
      color: 0.05,
      filter: "bandpass",
      frequency: 5800,
      q: 0.7,
      gain: 0.12,
      pan: 0.28,
      seconds: 1.7
    });
    this.addNoiseLayer(graph, {
      seed: 3403,
      color: 0.86,
      filter: "lowpass",
      frequency: 420,
      q: 0.3,
      gain: 0.055,
      pan: 0,
      seconds: 3.5
    });
    this.addOscillatorLayer(graph, {
      frequency: 146.83,
      type: "sine",
      gain: 0.045,
      pan: -0.08,
      drift: 0.024
    });
  }

  private createWindField() {
    const graph = this.createWorld("wind-field", 1.12, 720);
    this.addNoiseLayer(graph, {
      seed: 4104,
      color: 0.94,
      filter: "lowpass",
      frequency: 760,
      q: 0.5,
      gain: 0.22,
      pan: -0.18,
      seconds: 4.1,
      tremolo: { base: 0.16, depth: 0.08, rate: 0.055 }
    });
    this.addNoiseLayer(graph, {
      seed: 5105,
      color: 0.78,
      filter: "bandpass",
      frequency: 360,
      q: 0.55,
      gain: 0.075,
      pan: 0.26,
      seconds: 3.2,
      tremolo: { base: 0.07, depth: 0.038, rate: 0.08 }
    });
    this.addOscillatorLayer(graph, {
      frequency: 82.41,
      type: "sine",
      gain: 0.026,
      pan: 0.1,
      drift: 0.017
    });
    this.addOscillatorLayer(graph, {
      frequency: 220,
      type: "triangle",
      gain: 0.035,
      pan: -0.05,
      drift: 0.019
    });
  }

  private createWaterShimmer() {
    const graph = this.createWorld("water-shimmer", 1.08, 1800);
    this.addNoiseLayer(graph, {
      seed: 6206,
      color: 0.58,
      filter: "bandpass",
      frequency: 1250,
      q: 0.8,
      gain: 0.09,
      pan: -0.28,
      seconds: 2.8,
      tremolo: { base: 0.08, depth: 0.036, rate: 0.18 }
    });
    this.addNoiseLayer(graph, {
      seed: 7207,
      color: 0.22,
      filter: "highpass",
      frequency: 3400,
      q: 0.5,
      gain: 0.045,
      pan: 0.28,
      seconds: 1.9,
      tremolo: { base: 0.04, depth: 0.018, rate: 0.27 }
    });
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.addOscillatorLayer(graph, {
        frequency,
        type: index === 1 ? "triangle" : "sine",
        gain: 0.018,
        pan: index === 0 ? -0.35 : index === 1 ? 0.12 : 0.38,
        drift: 0.035 + index * 0.011
      });
    });
  }

  private createWaveTide() {
    const graph = this.createWorld("wave-tide", 1.16, 980);
    this.addNoiseLayer(graph, {
      seed: 8308,
      color: 0.9,
      filter: "lowpass",
      frequency: 540,
      q: 0.45,
      gain: 0.22,
      pan: -0.14,
      seconds: 4.8,
      tremolo: { base: 0.15, depth: 0.115, rate: 0.062 }
    });
    this.addNoiseLayer(graph, {
      seed: 9309,
      color: 0.62,
      filter: "bandpass",
      frequency: 920,
      q: 0.7,
      gain: 0.13,
      pan: 0.2,
      seconds: 3.6,
      tremolo: { base: 0.08, depth: 0.066, rate: 0.091 }
    });
    this.addNoiseLayer(graph, {
      seed: 10310,
      color: 0.2,
      filter: "highpass",
      frequency: 3100,
      q: 0.45,
      gain: 0.08,
      pan: 0.34,
      seconds: 2.2,
      tremolo: { base: 0.036, depth: 0.022, rate: 0.13 }
    });
    this.addOscillatorLayer(graph, {
      frequency: 55,
      type: "sine",
      gain: 0.026,
      pan: -0.05,
      drift: 0.015
    });
    this.addOscillatorLayer(graph, {
      frequency: 73.42,
      type: "sine",
      gain: 0.014,
      pan: 0.18,
      drift: 0.022
    });
    this.addOscillatorLayer(graph, {
      frequency: 220,
      type: "triangle",
      gain: 0.038,
      pan: 0.04,
      drift: 0.018
    });
  }

  private addNoiseLayer(
    graph: WorldGraph,
    options: {
      seed: number;
      color: number;
      filter: BiquadFilterType;
      frequency: number;
      q: number;
      gain: number;
      pan: number;
      seconds: number;
      tremolo?: { base: number; depth: number; rate: number };
    }
  ) {
    if (!this.context) {
      return;
    }

    const context = this.context;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = createPanNode(context, options.pan);

    source.buffer = createNoiseBuffer(context, options.seconds, options.seed, options.color);
    source.loop = true;
    filter.type = options.filter;
    filter.frequency.value = options.frequency;
    filter.Q.value = options.q;
    gain.gain.value = options.tremolo?.base ?? options.gain;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner.input);
    panner.output.connect(graph.gain);
    source.start();

    graph.filters.push(filter);
    graph.layerGains.push(gain);

    if (panner.pan) {
      this.addPanLfo(panner.pan, 0.035 + (options.seed % 7) * 0.009, 0.12);
    }

    if (options.tremolo) {
      this.addLfo(gain.gain, options.tremolo.rate, options.tremolo.depth);
    }
  }

  private addOscillatorLayer(
    graph: WorldGraph,
    options: {
      frequency: number;
      type: OscillatorType;
      gain: number;
      pan: number;
      drift: number;
    }
  ) {
    if (!this.context) {
      return;
    }

    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = createPanNode(context, options.pan);

    oscillator.type = options.type;
    oscillator.frequency.value = options.frequency;
    gain.gain.value = options.gain;

    oscillator.connect(gain);
    gain.connect(panner.input);
    panner.output.connect(graph.gain);
    oscillator.start();

    graph.layerGains.push(gain);
    this.addLfo(oscillator.frequency, options.drift, options.frequency * 0.008);
    if (panner.pan) {
      this.addPanLfo(panner.pan, options.drift * 0.68, 0.08);
    }
  }

  private addLfo(param: AudioParam, rate: number, depth: number) {
    if (!this.context) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = rate;
    gain.gain.value = depth;
    oscillator.connect(gain);
    gain.connect(param);
    oscillator.start();
  }

  private addPanLfo(param: AudioParam, rate: number, depth: number) {
    this.addLfo(param, rate, depth);
  }

  private unlockOutput() {
    if (!this.context || !this.master) {
      return;
    }

    const context = this.context;
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    gain.gain.value = 0.000001;
    oscillator.frequency.value = 440;
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.03);
  }

  private playStartTone() {
    if (!this.context || !this.master) {
      return;
    }

    const context = this.context;
    const now = context.currentTime;
    const gain = context.createGain();
    const tone = context.createOscillator();
    const tone2 = context.createOscillator();

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    tone.type = "sine";
    tone.frequency.setValueAtTime(440, now);
    tone2.type = "triangle";
    tone2.frequency.setValueAtTime(660, now);

    tone.connect(gain);
    tone2.connect(gain);
    gain.connect(this.master);
    tone.start(now);
    tone2.start(now);
    tone.stop(now + 0.36);
    tone2.stop(now + 0.36);
  }
}

function createPanNode(context: AudioContext, pan: number): PanNode {
  const maybeContext = context as AudioContext & {
    createStereoPanner?: () => StereoPannerNode;
  };

  if (typeof maybeContext.createStereoPanner === "function") {
    const panner = maybeContext.createStereoPanner();
    panner.pan.value = pan;
    return {
      input: panner,
      output: panner,
      pan: panner.pan
    };
  }

  const gain = context.createGain();
  return {
    input: gain,
    output: gain
  };
}

function createNoiseBuffer(
  context: AudioContext,
  seconds: number,
  seed: number,
  color: number
): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  const random = mulberry32(seed);
  let last = 0;
  let peak = 0.0001;

  for (let index = 0; index < length; index += 1) {
    const white = random() * 2 - 1;
    last = last * color + white * (1 - color);
    data[index] = last;
    peak = Math.max(peak, Math.abs(last));
  }

  for (let index = 0; index < length; index += 1) {
    data[index] = data[index] / peak;
  }

  return buffer;
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

import type { SoundWorldId } from "./types";

export interface MathLayer {
  name: string;
  formula: string;
  role: string;
}

export interface SoundMathArtifact {
  id: SoundWorldId;
  name: string;
  summary: string;
  layers: MathLayer[];
}

export const GLOBAL_AUDIO_MATH: MathLayer[] = [
  {
    name: "Seeded pseudo-randomness",
    formula: "mulberry32(seed) -> white[n] in [-1, 1]",
    role: "Creates deterministic raw noise from numbers so the app never needs recorded audio."
  },
  {
    name: "Colored noise",
    formula: "y[n] = color * y[n - 1] + (1 - color) * white[n]",
    role: "Smooths raw white noise into rain mist, wind body, wave wash, or brighter spray."
  },
  {
    name: "Oscillators",
    formula: "x(t) = A * sin(2 * pi * f * t)",
    role: "Adds soft tonal warmth and shimmer using sine and triangle waves."
  },
  {
    name: "Low frequency modulation",
    formula: "param(t) = base + depth * sin(2 * pi * rate * t)",
    role: "Slowly moves gain, pitch, pan, filters, and perceived intensity."
  },
  {
    name: "Delay feedback",
    formula: "out(t) = dry(t) + wet * out(t - delay)",
    role: "Creates spaciousness with a feedback loop instead of sampled reverb."
  }
];

export const SOUND_MATH_ARTIFACTS: SoundMathArtifact[] = [
  {
    id: "soft-rain",
    name: "Soft rain",
    summary: "Fine synthetic droplets made from bright filtered noise plus a barely audible sine bed.",
    layers: [
      {
        name: "Fine drops",
        formula: "highpass(coloredNoise(seed 1401, color 0.18), 2300 Hz)",
        role: "Removes low rumble so the layer reads as tiny close droplets."
      },
      {
        name: "Air sparkle",
        formula: "bandpass(coloredNoise(seed 2402, color 0.05), 5800 Hz, Q 0.7)",
        role: "Adds a narrow, brighter band that suggests water flecks."
      },
      {
        name: "Distant wash",
        formula: "lowpass(coloredNoise(seed 3403, color 0.86), 420 Hz)",
        role: "Gives the rain a soft background floor without using a recording."
      },
      {
        name: "Hidden pitch",
        formula: "sine(146.83 Hz) with 0.024 Hz pitch drift",
        role: "Adds warmth below the texture so the sound feels less sterile."
      }
    ]
  },
  {
    id: "wind-field",
    name: "Wind field",
    summary: "Slow moving air from heavily smoothed noise, low filters, tremolo, and stereo drift.",
    layers: [
      {
        name: "Wind body",
        formula: "lowpass(coloredNoise(seed 4104, color 0.94), 760 Hz)",
        role: "Heavy smoothing creates the long, rolling body of synthetic wind."
      },
      {
        name: "Pressure band",
        formula: "bandpass(coloredNoise(seed 5105, color 0.78), 360 Hz, Q 0.55)",
        role: "Adds a darker moving pressure tone."
      },
      {
        name: "Slow gust envelope",
        formula: "gain(t) = base + depth * sin(2 * pi * 0.055t)",
        role: "Gives wind a breathing motion without an audio loop."
      },
      {
        name: "Ground tone",
        formula: "sine(82.41 Hz) with 0.017 Hz pitch drift",
        role: "Adds a low, stable anchor below the noise."
      }
    ]
  },
  {
    id: "water-shimmer",
    name: "Water shimmer",
    summary: "Reflective water glints from mid/high filtered noise and sparse harmonic oscillators.",
    layers: [
      {
        name: "Surface movement",
        formula: "bandpass(coloredNoise(seed 6206, color 0.58), 1250 Hz, Q 0.8)",
        role: "Suggests small ripples by focusing noise into a watery mid band."
      },
      {
        name: "Bright edge",
        formula: "highpass(coloredNoise(seed 7207, color 0.22), 3400 Hz)",
        role: "Creates light flashes and tiny splash edges."
      },
      {
        name: "Shimmer partials",
        formula: "sine/triangle oscillators at 523.25, 659.25, 783.99 Hz",
        role: "Adds musical reflections using generated waveforms only."
      },
      {
        name: "Micro drift",
        formula: "frequency += depth * sin(2 * pi * 0.035t)",
        role: "Keeps the glints evolving instead of looping exactly."
      }
    ]
  },
  {
    id: "wave-tide",
    name: "Wave tide",
    summary: "Slow surf swells from low noise, spray bands, slow gain envelopes, and low sine tones.",
    layers: [
      {
        name: "Wave body",
        formula: "lowpass(coloredNoise(seed 8308, color 0.9), 540 Hz)",
        role: "Makes the broad wash of incoming water."
      },
      {
        name: "Foam band",
        formula: "bandpass(coloredNoise(seed 9309, color 0.62), 920 Hz, Q 0.7)",
        role: "Adds foamy midrange motion as the swell peaks."
      },
      {
        name: "Spray",
        formula: "highpass(coloredNoise(seed 10310, color 0.2), 3100 Hz)",
        role: "Adds the hiss of receding water and surf spray."
      },
      {
        name: "Tide pulse",
        formula: "gain(t) = base + depth * sin(2 * pi * 0.062t)",
        role: "Creates slow wave arrivals from math-based amplitude movement."
      },
      {
        name: "Deep swell",
        formula: "sine(55 Hz) + sine(73.42 Hz), both drifting slowly",
        role: "Adds the feeling of mass under the generated surf texture."
      }
    ]
  }
];

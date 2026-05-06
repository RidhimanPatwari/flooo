export type PhaseId = "settle" | "focus" | "drift" | "return";

export type SoundWorldId = "soft-rain" | "wind-field" | "water-shimmer" | "wave-tide";

export type SoundChoiceId = SoundWorldId | "shuffle";

export type DurationId = "ten" | "twenty-five" | "custom";

export interface FlowPhase {
  id: PhaseId;
  name: string;
  cue: string;
  start: number;
  end: number;
  shuffleWorld: SoundWorldId;
  intensity: number;
}

export interface DurationPreset {
  id: DurationId;
  label: string;
  detail: string;
  seconds: number | null;
}

export interface SoundWorldMeta {
  id: SoundWorldId;
  name: string;
  detail: string;
}

export const DURATION_PRESETS: DurationPreset[] = [
  {
    id: "ten",
    label: "10 min",
    detail: "quick reset",
    seconds: 10 * 60
  },
  {
    id: "twenty-five",
    label: "25 min",
    detail: "deep flow",
    seconds: 25 * 60
  },
  {
    id: "custom",
    label: "Custom",
    detail: "enter time",
    seconds: null
  }
];

export const SOUND_WORLDS: SoundWorldMeta[] = [
  {
    id: "soft-rain",
    name: "Soft rain",
    detail: "Fine filtered drops"
  },
  {
    id: "wind-field",
    name: "Wind field",
    detail: "Low moving air"
  },
  {
    id: "water-shimmer",
    name: "Water shimmer",
    detail: "Light tonal glints"
  },
  {
    id: "wave-tide",
    name: "Wave tide",
    detail: "Slow surf swells"
  }
];

export const FLOW_PHASES: FlowPhase[] = [
  {
    id: "settle",
    name: "Settle",
    cue: "Arrive",
    start: 0,
    end: 0.2,
    shuffleWorld: "soft-rain",
    intensity: 42
  },
  {
    id: "focus",
    name: "Focus",
    cue: "Breathe in",
    start: 0.2,
    end: 0.55,
    shuffleWorld: "wave-tide",
    intensity: 58
  },
  {
    id: "drift",
    name: "Drift",
    cue: "Breathe out",
    start: 0.55,
    end: 0.85,
    shuffleWorld: "water-shimmer",
    intensity: 50
  },
  {
    id: "return",
    name: "Return",
    cue: "Soften",
    start: 0.85,
    end: 1,
    shuffleWorld: "wind-field",
    intensity: 34
  }
];

export const DEFAULT_SOUND_CHOICE: SoundChoiceId = "shuffle";

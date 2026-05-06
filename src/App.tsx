import { ArrowLeft, ChevronDown, Pause, Play, RotateCcw, Shuffle, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import { GLOBAL_AUDIO_MATH, SOUND_MATH_ARTIFACTS } from "./soundMath";
import {
  DEFAULT_SOUND_CHOICE,
  DURATION_PRESETS,
  FLOW_PHASES,
  SOUND_WORLDS,
  type DurationId,
  type FlowPhase,
  type SoundChoiceId,
  type SoundWorldId
} from "./types";

const STORAGE_KEY = "flooo.timer-settings.v3";
const CUSTOM_MINUTE_OPTIONS = Array.from({ length: 180 }, (_, index) => index + 1);
type AudioStatus = "idle" | "starting" | "running" | "blocked";

interface TimerSettings {
  durationId: DurationId | null;
  customMinutes: number;
  soundChoice: SoundChoiceId;
}

type AppScreen = "setup" | "timer";

interface FlowState {
  phase: FlowPhase;
  progress: number;
  sessionProgress: number;
  displaySeconds: number;
  isComplete: boolean;
  activeWorld: SoundWorldId;
}

function App() {
  const [path, setPath] = useState(readRoute());

  useEffect(() => {
    const handlePop = () => setPath(readRoute());
    window.addEventListener("popstate", handlePop);
    window.addEventListener("hashchange", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("hashchange", handlePop);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    if (usesHashRoute()) {
      window.history.pushState(null, "", `#${to}`);
    } else {
      window.history.pushState(null, "", to);
    }
    setPath(readRoute());
    window.scrollTo({ top: 0 });
  }, []);

  if (path === "/admin") {
    return <AdminPage onBack={() => navigate("/")} />;
  }

  return <TimerApp />;
}

function readRoute() {
  if (window.location.hash.startsWith("#/")) {
    return window.location.hash.slice(1);
  }

  return window.location.pathname.endsWith("/admin") ? "/admin" : "/";
}

function usesHashRoute() {
  return window.location.hash.startsWith("#/") || !["/", "/admin"].includes(window.location.pathname);
}

function TimerApp() {
  const [settings, setSettings] = useState<TimerSettings>(() => loadSettings());
  const [screen, setScreen] = useState<AppScreen>("setup");
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const animationRef = useRef(0);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const elapsedRef = useRef(0);

  const durationSeconds = useMemo(() => getDurationSeconds(settings), [settings]);
  const flowState = useMemo(
    () => getFlowState(settings.soundChoice, durationSeconds, elapsed),
    [durationSeconds, elapsed, settings.soundChoice]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    audioRef.current = new AudioEngine();

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    elapsedRef.current = elapsed;

    if (isRunning) {
      audioRef.current?.update({
        phaseId: flowState.phase.id,
        progress: flowState.progress,
        intensity: flowState.phase.intensity,
        world: flowState.activeWorld
      });
    }

    if (isRunning && flowState.isComplete) {
      setIsRunning(false);
      setAudioStatus("idle");
      audioRef.current?.pause();
      offsetRef.current = durationSeconds;
      elapsedRef.current = durationSeconds;
      setElapsed(durationSeconds);
    }
  }, [durationSeconds, elapsed, flowState, isRunning]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const tick = () => {
      const nextElapsed = offsetRef.current + (performance.now() - startedAtRef.current) / 1000;
      elapsedRef.current = nextElapsed;
      setElapsed(nextElapsed);
      animationRef.current = window.requestAnimationFrame(tick);
    };

    animationRef.current = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationRef.current);
  }, [isRunning]);

  const updateSettings = useCallback((patch: Partial<TimerSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const handleDurationSelect = useCallback(
    (durationId: DurationId) => {
      updateSettings({ durationId });
    },
    [updateSettings]
  );

  const handleSoundChoice = useCallback(
    (choice: SoundChoiceId) => {
      updateSettings({ soundChoice: choice });
      const next = getFlowState(choice, durationSeconds, elapsedRef.current);
      audioRef.current?.update({
        phaseId: next.phase.id,
        progress: next.progress,
        intensity: next.phase.intensity,
        world: next.activeWorld
      });
    },
    [durationSeconds, updateSettings]
  );

  const startTimer = useCallback(async () => {
    if (!durationSeconds) {
      return false;
    }

    setAudioError(null);
    setAudioStatus("starting");
    const active = getFlowState(settings.soundChoice, durationSeconds, elapsedRef.current);

    try {
      const status = await audioRef.current?.play({
        phaseId: active.phase.id,
        progress: active.progress,
        intensity: active.phase.intensity,
        world: active.activeWorld
      });

      if (status !== "running") {
        setAudioStatus("blocked");
        setAudioError("Audio did not start. Tap Resume and make sure your phone media volume is up.");
        return false;
      }
    } catch (error) {
      setAudioStatus("blocked");
      setAudioError(error instanceof Error ? error.message : "Audio could not start.");
      return false;
    }

    offsetRef.current = elapsedRef.current;
    startedAtRef.current = performance.now();
    setAudioStatus("running");
    setIsRunning(true);
    return true;
  }, [durationSeconds, settings.soundChoice]);

  const handleSetupStart = useCallback(async () => {
    if (!durationSeconds) {
      return;
    }

    offsetRef.current = 0;
    elapsedRef.current = 0;
    setElapsed(0);
    const started = await startTimer();
    if (started) {
      setScreen("timer");
    }
  }, [durationSeconds, startTimer]);

  const handlePause = useCallback(() => {
    offsetRef.current = elapsedRef.current;
    setIsRunning(false);
    setAudioStatus("idle");
    audioRef.current?.pause();
  }, []);

  const handleBack = useCallback(() => {
    offsetRef.current = 0;
    elapsedRef.current = 0;
    setElapsed(0);
    setIsRunning(false);
    setAudioStatus("idle");
    setAudioError(null);
    setScreen("setup");
    audioRef.current?.pause();
  }, []);

  const handleRepeat = useCallback(async () => {
    offsetRef.current = 0;
    elapsedRef.current = 0;
    setElapsed(0);
    setAudioStatus("idle");
    await startTimer();
  }, [startTimer]);

  if (screen === "setup") {
    return (
      <SetupScreen
        settings={settings}
        durationSeconds={durationSeconds}
        onDurationSelect={handleDurationSelect}
        onCustomMinutes={(customMinutes) => updateSettings({ customMinutes })}
        onSoundChoice={handleSoundChoice}
        onStart={handleSetupStart}
        audioError={audioError}
      />
    );
  }

  return (
    <TimerScreen
      settings={settings}
      flowState={flowState}
      isRunning={isRunning}
      audioStatus={audioStatus}
      audioError={audioError}
      onBack={handleBack}
      onSoundChoice={handleSoundChoice}
      onPause={handlePause}
      onResume={startTimer}
      onRepeat={handleRepeat}
    />
  );
}

function SetupScreen({
  settings,
  durationSeconds,
  onDurationSelect,
  onCustomMinutes,
  onSoundChoice,
  onStart,
  audioError
}: {
  settings: TimerSettings;
  durationSeconds: number;
  onDurationSelect: (durationId: DurationId) => void;
  onCustomMinutes: (minutes: number) => void;
  onSoundChoice: (choice: SoundChoiceId) => void;
  onStart: () => void;
  audioError: string | null;
}) {
  return (
    <main className="setup-app" aria-label="flooo setup">
      <AmbientField phase="settle" progress={0.06} />

      <section className="setup-card">
        <p className="app-name">flooo</p>
        <h1>Choose your flow</h1>

        <div className="setup-group">
          <span className="setup-label">duration</span>
          <div className="preset-row" role="group" aria-label="Choose duration">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className="preset-button"
                data-active={preset.id === settings.durationId}
                type="button"
                onClick={() => onDurationSelect(preset.id)}
              >
                <span>{preset.label}</span>
                <small>{preset.detail}</small>
              </button>
            ))}
          </div>
          {settings.durationId === "custom" ? (
            <label className="custom-time">
              <span>minutes</span>
              <select
                aria-label="Custom duration minutes"
                value={settings.customMinutes}
                onChange={(event) => onCustomMinutes(Number(event.target.value))}
              >
                {CUSTOM_MINUTE_OPTIONS.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute} min
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={17} />
            </label>
          ) : null}
        </div>

        <div className="setup-group">
          <span className="setup-label">sound</span>
          <SoundSelect value={settings.soundChoice} onChange={onSoundChoice} />
        </div>

        <button className="start-control" type="button" disabled={!durationSeconds} onClick={onStart}>
          <Play aria-hidden="true" size={28} />
          <span>Start</span>
        </button>

        {audioError ? <p className="audio-error">{audioError}</p> : null}
      </section>
    </main>
  );
}

function TimerScreen({
  settings,
  flowState,
  isRunning,
  audioStatus,
  audioError,
  onBack,
  onSoundChoice,
  onPause,
  onResume,
  onRepeat
}: {
  settings: TimerSettings;
  flowState: FlowState;
  isRunning: boolean;
  audioStatus: AudioStatus;
  audioError: string | null;
  onBack: () => void;
  onSoundChoice: (choice: SoundChoiceId) => void;
  onPause: () => void;
  onResume: () => void;
  onRepeat: () => void;
}) {
  const ringStyle = {
    "--ring-progress": `${Math.round(flowState.sessionProgress * 360)}deg`,
    "--phase-progress": flowState.progress.toFixed(3)
  } as CSSProperties;
  const statusText = flowState.isComplete ? "Complete" : isRunning ? flowState.phase.cue : "Paused";
  const controlLabel = flowState.isComplete ? "Repeat" : isRunning ? "Pause" : "Resume";
  const ControlIcon = flowState.isComplete ? RotateCcw : isRunning ? Pause : Play;
  const handleControl = flowState.isComplete ? onRepeat : isRunning ? onPause : onResume;

  return (
    <main className={`flow-app ${flowState.phase.id}`} aria-label="flooo timer">
      <AmbientField phase={flowState.phase.id} progress={flowState.sessionProgress} />

      <header className="flow-top">
        <button className="quiet-icon" type="button" onClick={onBack} aria-label="Back to setup">
          <ArrowLeft aria-hidden="true" size={19} />
        </button>
        <SoundSelect value={settings.soundChoice} onChange={onSoundChoice} compact />
      </header>

      <section className="timer-stage" aria-live="polite">
        <div className="timer-ring" style={ringStyle}>
          <div className="ring-inner">
            <span>{formatTime(flowState.displaySeconds)}</span>
            <small>{flowState.isComplete ? "done" : "remaining"}</small>
          </div>
        </div>
      </section>

      <p className="audio-status" data-status={audioStatus}>
        {audioStatus === "running"
          ? `Audio on: ${getWorldName(flowState.activeWorld)}`
          : audioStatus === "starting"
            ? "Starting audio"
            : "Audio paused"}
      </p>

      {audioError ? <p className="audio-error">{audioError}</p> : null}

      <footer className="flow-controls">
        <button className="start-control" type="button" onClick={handleControl}>
          <ControlIcon aria-hidden="true" size={28} />
          <span>{controlLabel}</span>
        </button>
      </footer>
    </main>
  );
}

function SoundSelect({
  value,
  onChange,
  compact = false
}: {
  value: SoundChoiceId;
  onChange: (choice: SoundChoiceId) => void;
  compact?: boolean;
}) {
  return (
    <label className="sound-pill" data-compact={compact}>
      {value === "shuffle" ? <Shuffle aria-hidden="true" size={18} /> : <Waves aria-hidden="true" size={18} />}
      <select
        aria-label="Sound world"
        value={value}
        onChange={(event) => onChange(event.target.value as SoundChoiceId)}
      >
        {SOUND_WORLDS.map((world) => (
          <option key={world.id} value={world.id}>
            {world.name}
          </option>
        ))}
        <option value="shuffle">Shuffle</option>
      </select>
      <ChevronDown aria-hidden="true" size={18} />
    </label>
  );
}

function AdminPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="admin-page">
      <header className="admin-hero">
        <button className="admin-back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />
          Timer
        </button>
        <p className="app-name">flooo admin</p>
        <h1>Math-Only Sound Engine</h1>
        <p>
          Confirmed: flooo does not use audio files, samples, streams, microphones, or remote sound
          sources. Every sound starts as generated numbers inside the browser and is shaped by Web
          Audio nodes.
        </p>
      </header>

      <section className="math-section" aria-label="Global audio math">
        <h2>Shared Building Blocks</h2>
        <div className="math-grid">
          {GLOBAL_AUDIO_MATH.map((item) => (
            <MathCard key={item.name} name={item.name} formula={item.formula} role={item.role} />
          ))}
        </div>
      </section>

      <section className="math-section" aria-label="Sound world math">
        <h2>Sound Worlds</h2>
        <div className="sound-math-list">
          {SOUND_MATH_ARTIFACTS.map((world) => (
            <article key={world.id} className="sound-math-card">
              <div>
                <span className="math-tag">{world.id}</span>
                <h3>{world.name}</h3>
                <p>{world.summary}</p>
              </div>
              <div className="math-layer-list">
                {world.layers.map((layer) => (
                  <MathCard
                    key={layer.name}
                    name={layer.name}
                    formula={layer.formula}
                    role={layer.role}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MathCard({ name, formula, role }: { name: string; formula: string; role: string }) {
  return (
    <article className="math-card">
      <h3>{name}</h3>
      <code>{formula}</code>
      <p>{role}</p>
    </article>
  );
}

function AmbientField({ phase, progress }: { phase: FlowPhase["id"]; progress: number }) {
  const progressStyle = {
    "--phase-progress": progress.toFixed(3)
  } as CSSProperties;

  return (
    <div className={`ambient-field ${phase}`} style={progressStyle} aria-hidden="true">
      <span className="pulse-circle pulse-circle-one" />
      <span className="pulse-circle pulse-circle-two" />
      <span className="pulse-circle pulse-circle-three" />
      <span className="flow-line line-one" />
      <span className="flow-line line-two" />
      <span className="grain" />
    </div>
  );
}

function loadSettings(): TimerSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { durationId: null, customMinutes: 15, soundChoice: DEFAULT_SOUND_CHOICE };
    }

    const parsed = JSON.parse(stored) as Partial<TimerSettings>;
    return {
      durationId: DURATION_PRESETS.some((preset) => preset.id === parsed.durationId)
        ? parsed.durationId ?? null
        : null,
      customMinutes: clamp(Number(parsed.customMinutes ?? 15), 1, 180),
      soundChoice: isSoundChoice(parsed.soundChoice) ? parsed.soundChoice : DEFAULT_SOUND_CHOICE
    };
  } catch {
    return { durationId: null, customMinutes: 15, soundChoice: DEFAULT_SOUND_CHOICE };
  }
}

function getDurationSeconds(settings: TimerSettings) {
  if (settings.durationId === "custom") {
    return clamp(Math.round(settings.customMinutes), 1, 180) * 60;
  }

  const preset = DURATION_PRESETS.find((item) => item.id === settings.durationId);
  return preset?.seconds ?? 0;
}

function getFlowState(soundChoice: SoundChoiceId, durationSeconds: number, elapsed: number): FlowState {
  const sessionProgress = durationSeconds > 0 ? clamp(elapsed / durationSeconds, 0, 1) : 0;
  const phase = getPhase(sessionProgress);
  const progress = getPhaseProgress(phase, sessionProgress);
  const activeWorld = soundChoice === "shuffle" ? phase.shuffleWorld : soundChoice;
  const displaySeconds = Math.max(0, durationSeconds - elapsed);

  return {
    phase,
    progress,
    sessionProgress,
    displaySeconds,
    isComplete: durationSeconds > 0 && elapsed >= durationSeconds,
    activeWorld
  };
}

function getPhase(progress: number) {
  return (
    FLOW_PHASES.find((phase) => progress >= phase.start && progress < phase.end) ??
    FLOW_PHASES[FLOW_PHASES.length - 1]
  );
}

function getPhaseProgress(phase: FlowPhase, sessionProgress: number) {
  const span = phase.end - phase.start;
  return span > 0 ? clamp((sessionProgress - phase.start) / span, 0, 1) : 0;
}

function isSoundChoice(value: unknown): value is SoundChoiceId {
  return value === "shuffle" || SOUND_WORLDS.some((world) => world.id === value);
}

function getWorldName(id: SoundChoiceId) {
  if (id === "shuffle") {
    return "Shuffle";
  }

  return SOUND_WORLDS.find((world) => world.id === id)?.name ?? "Sound";
}

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  const fallback = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, fallback));
}

export default App;

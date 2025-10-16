import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PomodoroPhase = "work" | "shortBreak" | "longBreak";

interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number; // after how many work sessions
}

interface PomodoroState {
  // Settings
  settings: PomodoroSettings;
  updateSettings: (settings: Partial<PomodoroSettings>) => void;

  // Timer state
  phase: PomodoroPhase;
  isRunning: boolean;
  timeRemaining: number; // seconds
  sessionsCompleted: number;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  setPhase: (phase: PomodoroPhase) => void;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: DEFAULT_SETTINGS,
      phase: "work",
      isRunning: false,
      timeRemaining: DEFAULT_SETTINGS.workDuration * 60,
      sessionsCompleted: 0,

      updateSettings: (newSettings) => {
        const settings = { ...get().settings, ...newSettings };
        set({ settings });
        // Reset timer if not running
        if (!get().isRunning) {
          const phase = get().phase;
          const duration =
            phase === "work"
              ? settings.workDuration
              : phase === "shortBreak"
              ? settings.shortBreakDuration
              : settings.longBreakDuration;
          set({ timeRemaining: duration * 60 });
        }
      },

      start: () => set({ isRunning: true }),

      pause: () => set({ isRunning: false }),

      reset: () => {
        const { phase, settings } = get();
        const duration =
          phase === "work"
            ? settings.workDuration
            : phase === "shortBreak"
            ? settings.shortBreakDuration
            : settings.longBreakDuration;
        set({
          isRunning: false,
          timeRemaining: duration * 60,
        });
      },

      skip: () => {
        const { phase, sessionsCompleted, settings } = get();
        let nextPhase: PomodoroPhase;
        let newSessionsCompleted = sessionsCompleted;

        if (phase === "work") {
          newSessionsCompleted = sessionsCompleted + 1;
          // Check if it's time for long break
          if (newSessionsCompleted % settings.longBreakInterval === 0) {
            nextPhase = "longBreak";
          } else {
            nextPhase = "shortBreak";
          }
        } else {
          nextPhase = "work";
        }

        const duration =
          nextPhase === "work"
            ? settings.workDuration
            : nextPhase === "shortBreak"
            ? settings.shortBreakDuration
            : settings.longBreakDuration;

        set({
          phase: nextPhase,
          timeRemaining: duration * 60,
          sessionsCompleted: newSessionsCompleted,
          isRunning: false,
        });
      },

      tick: () => {
        const { timeRemaining, isRunning } = get();
        if (!isRunning) return;

        if (timeRemaining > 0) {
          set({ timeRemaining: timeRemaining - 1 });
        } else {
          // Auto-advance to next phase
          get().skip();
        }
      },

      setPhase: (phase) => {
        const { settings } = get();
        const duration =
          phase === "work"
            ? settings.workDuration
            : phase === "shortBreak"
            ? settings.shortBreakDuration
            : settings.longBreakDuration;
        set({
          phase,
          timeRemaining: duration * 60,
          isRunning: false,
        });
      },
    }),
    {
      name: "focusly-pomodoro",
      version: 1,
    }
  )
);

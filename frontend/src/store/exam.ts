import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExamSession, ExamAnswer, ExamQuestion } from "@/types";
import { cleanupOldSessions, monitorStorageUsage } from "@/utils/storage";

interface ExamState {
  sessions: ExamSession[];
  activeSessionId?: string;
  setActiveSession: (sessionId: string | undefined) => void;
  createSession: (examName: string, subject: string, questions: ExamQuestion[]) => ExamSession;
  saveAnswer: (sessionId: string, answer: ExamAnswer) => void;
  completeSession: (sessionId: string) => void;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clear: () => void;
}

const createNewSession = (
  examName: string,
  subject: string,
  questions: ExamQuestion[]
): ExamSession => ({
  id: crypto.randomUUID(),
  examName,
  subject,
  questions: questions.map((q, index) => ({
    ...q,
    id: q.id || `question-${index}`,
  })),
  answers: [],
  startedAt: Date.now(),
  completedAt: null,
  isPaused: false,
});

type PersistedExamState = {
  sessions?: ExamSession[];
  activeSessionId?: string;
};

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: undefined,
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      createSession: (examName, subject, questions) => {
        const session = createNewSession(examName, subject, questions);
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 20),
          activeSessionId: session.id,
        }));

        // Monitor storage usage and cleanup if needed
        monitorStorageUsage();
        cleanupOldSessions("focusly-exam-history", 15);

        return session;
      },
      saveAnswer: (sessionId, answer) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            // Remove existing answer for this question if any
            const filteredAnswers = session.answers.filter(
              (a) => a.questionId !== answer.questionId
            );

            return {
              ...session,
              answers: [...filteredAnswers, answer],
            };
          }),
        })),
      completeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const totalTimeSeconds = Math.floor((Date.now() - session.startedAt) / 1000);

            return {
              ...session,
              completedAt: Date.now(),
              totalTimeSeconds,
              isPaused: false,
            };
          }),
        })),
      pauseSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, isPaused: true, pausedAt: Date.now() }
              : session
          ),
        })),
      resumeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, isPaused: false, pausedAt: undefined }
              : session
          ),
        })),
      deleteSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          activeSessionId:
            state.activeSessionId === sessionId ? undefined : state.activeSessionId,
        })),
      clear: () => set({ sessions: [], activeSessionId: undefined }),
    }),
    {
      name: "focusly-exam-history",
      version: 1,
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as PersistedExamState;
        return {
          sessions: state.sessions ?? [],
          activeSessionId: state.activeSessionId,
        };
      },
    }
  )
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GeneratedQuestion, QuizAttempt, QuizSession } from "@/types";

interface QuizState {
  sessions: QuizSession[];
  activeSessionId?: string;
  stagedQuestions: GeneratedQuestion[];
  setActiveSession: (sessionId: string | undefined) => void;
  createSession: (questions: GeneratedQuestion[]) => QuizSession;
  setStagedQuestions: (questions: GeneratedQuestion[]) => void;
  recordAttempt: (sessionId: string, attempt: QuizAttempt) => void;
  completeSession: (sessionId: string, score: number) => void;
  resetSession: (sessionId: string) => void;
  updateCurrentQuestionIndex: (sessionId: string, index: number) => void;
  updateDraftAnswer: (sessionId: string, questionId: string, answer: string) => void;
  clear: () => void;
}

const createNewSession = (questions: GeneratedQuestion[]): QuizSession => ({
  id: crypto.randomUUID(),
  questions,
  attempts: [],
  createdAt: Date.now(),
  completedAt: null,
  score: 0,
  currentQuestionIndex: 0,
  draftAnswers: {},
});

type PersistedQuizState = {
  sessions?: QuizSession[];
  activeSessionId?: string;
  stagedQuestions?: GeneratedQuestion[];
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: undefined,
      stagedQuestions: [],
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      createSession: (questions) => {
        const session = createNewSession(questions);
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 10),
          activeSessionId: session.id,
          stagedQuestions: [],
        }));
        return session;
      },
      setStagedQuestions: (questions) => set({ stagedQuestions: questions }),
      recordAttempt: (sessionId, attempt) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            const attempts = [
              ...session.attempts.filter(
                (item) => item.questionId !== attempt.questionId
              ),
              attempt,
            ];

            const correct = attempts.filter((item) => item.isCorrect).length;
            const accuracy =
              session.questions.length > 0
                ? correct / session.questions.length
                : 0;

            return {
              ...session,
              attempts,
              analytics: {
                accuracy,
                attempted: attempts.length,
                correct,
              },
            };
          }),
        })),
      completeSession: (sessionId, score) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, completedAt: Date.now(), score }
              : session
          ),
        })),
      resetSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  attempts: [],
                  completedAt: null,
                  score: 0,
                  analytics: undefined,
                  currentQuestionIndex: 0,
                  draftAnswers: {},
                }
              : session
          ),
        })),
      updateCurrentQuestionIndex: (sessionId, index) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, currentQuestionIndex: index }
              : session
          ),
        })),
      updateDraftAnswer: (sessionId, questionId, answer) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  draftAnswers: {
                    ...(session.draftAnswers ?? {}),
                    [questionId]: answer,
                  },
                }
              : session
          ),
        })),
      clear: () =>
        set({ sessions: [], activeSessionId: undefined, stagedQuestions: [] }),
    }),
    {
      name: "focusly-quiz-history",
      version: 1,
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as PersistedQuizState;
        return {
          sessions: state.sessions ?? [],
          activeSessionId: state.activeSessionId,
          stagedQuestions: state.stagedQuestions ?? [],
        };
      },
    }
  )
);

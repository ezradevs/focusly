import type {
  AuthUser,
  EssayCoachResponse,
  ExamResponse,
  FlashcardBuilderResponse,
  MnemonicResponse,
  GeneratedQuestion,
  ModuleOutputRecord,
  PlannerResult,
  QuizFeedbackResponse,
  RecallDrillResponse,
  StoredModuleType,
  SummaryResult,
  ChatRole,
  NESAExam,
  NESAModuleName,
} from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface RequestOptions extends RequestInit {
  signal?: AbortSignal;
}

interface QuestionsResponse {
  questions: GeneratedQuestion[];
}

interface OutputsResponse {
  outputs: ModuleOutputRecord[];
}

interface OutputResponse {
  output: ModuleOutputRecord;
}

interface AuthResponse {
  user: AuthUser;
}

interface TutorChatPayload {
  subject?: string;
  messages: Array<{
    role: ChatRole;
    content: string;
  }>;
}

interface TutorChatResponse {
  reply: string;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({ error: response.statusText }));

    throw new Error(message.error ?? "Unexpected server error");
  }

  return response.json() as Promise<T>;
}

export const focuslyApi = {
  summariseNotes: (payload: {
    subject: string;
    tone: "concise" | "exam-focus";
    text: string;
  }) => request<SummaryResult>("/api/notes/summarize", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  generateQuestions: (payload: {
    subject: string;
    promptSource: "topic" | "notes";
    content: string;
    questionCount: number;
    questionTypes: Array<"mcq" | "short-answer" | "extended">;
    includeMarkingGuides: boolean;
  }) =>
    request<QuestionsResponse>("/api/questions/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getQuizFeedback: (payload: {
    questionId: string;
    questionType: "mcq" | "short-answer" | "extended";
    questionPrompt: string;
    userAnswer: string;
    correctAnswer?: string;
    context?: string;
  }) =>
    request<QuizFeedbackResponse>("/api/quiz/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  buildFlashcards: (payload: {
    subject: string;
    sourceText: string;
    includeTypes: Array<"basic" | "cloze" | "image-occlusion">;
  }) =>
    request<FlashcardBuilderResponse>("/api/flashcards/build", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createExamPrompts: (payload: {
    subject: string;
    topics: string[];
    quantity: number;
    includeBandSixSample: boolean;
    userResponse?: string;
  }) =>
    request<ExamResponse>("/api/exams/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  buildRevisionPlan: (payload: {
    subjects: string[];
    topics: string[];
    examDate: string;
    focusAreas?: string[];
    studyDaysPerWeek: number;
  }) =>
    request<PlannerResult>("/api/planner/build", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateMnemonics: (payload: {
    subject: string;
    focusArea?: string | null;
    keyIdeas: string;
    preferredStyle: "acrostic" | "story" | "visual" | "chunking" | "rhythm";
  }) =>
    request<MnemonicResponse>("/api/memorisation/mnemonics", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  coachEssayMemorisation: (payload: {
    subject: string;
    essayTitle: string;
    essayText: string;
    rehearsalWindowDays: number;
    goal?: string;
  }) =>
    request<EssayCoachResponse>("/api/memorisation/essay-coach", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateRecallDrills: (payload: {
    subject: string;
    topic: string;
    facts: string[];
    difficulty: "gentle" | "balanced" | "intense";
  }) =>
    request<RecallDrillResponse>("/api/memorisation/recall-drills", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  signup: (payload: { email: string; password: string; name?: string }) =>
    request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ success: boolean }>("/api/auth/logout", {
      method: "POST",
    }),

  verifyEmail: (token: string) =>
    request<{ success: boolean; message: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    request<{ success: boolean; message: string }>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  requestPasswordReset: (email: string) =>
    request<{ success: boolean; message: string }>("/api/auth/password/reset-request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (payload: { token: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>("/api/auth/password/reset-confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  currentUser: () => request<AuthResponse>("/api/auth/me"),

  listOutputs: (params: { module?: StoredModuleType; limit?: number; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.module) query.set("module", params.module);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<OutputsResponse>(`/api/outputs${suffix}`);
  },

  getOutput: (id: string) => request<OutputResponse>(`/api/outputs/${id}`),

  updateOutputLabel: (id: string, label: string) =>
    request<OutputResponse>(`/api/outputs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ label }),
    }),

  deleteOutput: (id: string) =>
    request<{ success: boolean }>(`/api/outputs/${id}`, {
      method: "DELETE",
    }),

  tutorChat: (payload: TutorChatPayload) =>
    request<TutorChatResponse>("/api/tutor/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  practiceLanguage: (payload: {
    language: string;
    practiceMode: "vocabulary" | "grammar" | "conversation" | "writing" | "translation";
    content: string;
    proficiencyLevel: "beginner" | "intermediate" | "advanced";
    context?: string;
  }) =>
    request<{ result: Record<string, unknown> }>("/api/language/practice", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  languageConversation: (payload: {
    language: string;
    proficiencyLevel: "beginner" | "intermediate" | "advanced";
    scenario?: string;
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
  }) =>
    request<{
      message: string;
      translation: string;
      feedback?: {
        grammarNotes: string[];
        vocabularySuggestions: string[];
        culturalTips?: string[];
      };
    }>("/api/language/conversation", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProfile: (payload: { name: string }) =>
    request<AuthResponse>("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  updatePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>("/api/auth/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteAccount: () =>
    request<{ success: boolean }>("/api/auth/account", {
      method: "DELETE",
    }),

  generateNESAExam: (payload: {
    modules: NESAModuleName[];
    questionCount?: number;
    includeMarkingGuide?: boolean;
    seed?: string;
  }) =>
    request<NESAExam>("/api/nesa/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getNESAExams: () =>
    request<{ exams: ModuleOutputRecord[] }>("/api/nesa/exams"),

  deleteNESAExam: (id: string) =>
    request<{ success: boolean }>(`/api/outputs/${id}`, {
      method: "DELETE",
    }),
};

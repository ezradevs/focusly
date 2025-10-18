export type SubjectValue =
  | "biology"
  | "chemistry"
  | "physics"
  | "mathematics"
  | "software-engineering"
  | "english"
  | "economics"
  | "business-studies"
  | "history"
  | "custom";

export interface SubjectOption {
  label: string;
  value: SubjectValue;
}

export interface SummaryDefinition {
  term: string;
  definition: string;
}

export interface SummaryFollowUp {
  title: string;
  description: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  definitions: SummaryDefinition[];
  followUpSuggestions?: SummaryFollowUp[];
}

export type QuestionType = "mcq" | "short-answer" | "extended";

export interface QuestionOption {
  label: string;
  value: string;
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  answer: string;
  explanation: string;
  markingGuide?: string;
}

export interface QuizAttempt {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback: string;
  improvementTips: string[];
  timestamp: number;
}

export interface QuizSession {
  id: string;
  questions: GeneratedQuestion[];
  attempts: QuizAttempt[];
  score?: number;
  analytics?: {
    accuracy: number;
    attempted: number;
    correct: number;
    averageTimeSeconds?: number;
  };
  completedAt?: number | null;
  createdAt: number;
  currentQuestionIndex?: number;
  draftAnswers?: { [questionId: string]: string };
}

export type FlashcardType = "basic" | "cloze" | "image-occlusion";

export interface ImageMask {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Flashcard {
  id: string;
  deckId: string;
  subject: string;
  type: FlashcardType;
  front: string;
  back?: string;
  clozeDeletion?: {
    fullText: string;
    missingText: string;
  };
  imageGuidance?: {
    prompt: string;
    occlusionIdeas: Array<{
      label: string;
      description: string;
    }>;
    imageSrc?: string;
    masks?: ImageMask[];
  };
  tags?: string[];
  createdAt: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  subject: string;
  description?: string;
  cards: Flashcard[];
  updatedAt: number;
}

export interface FlashcardBuilderResponse {
  cards: Array<
    Pick<
      Flashcard,
      | "id"
      | "type"
      | "front"
      | "back"
      | "clozeDeletion"
      | "imageGuidance"
      | "tags"
    >
  >;
  studyTips?: string[];
}

export interface ExamEvaluation {
  summary: string;
  strengths: string[];
  improvements: string[];
  indicativeBand?: string;
}

export interface ExamQuestion {
  id?: string;
  prompt: string;
  criteria: string[];
  bandSixSample?: string;
  evaluation?: ExamEvaluation;
  timeAllocationMinutes?: number;
}

export interface ExamResponse {
  questions: ExamQuestion[];
  reflectionPrompts?: string[];
}

export interface ExamAnswer {
  questionId: string;
  answer: string;
  timeSpentSeconds: number;
}

export interface ExamSession {
  id: string;
  examName: string;
  subject: string;
  questions: ExamQuestion[];
  answers: ExamAnswer[];
  startedAt: number;
  completedAt?: number | null;
  totalTimeSeconds?: number;
  isPaused?: boolean;
  pausedAt?: number;
}

export interface PlannerActivity {
  subject: string;
  topic: string;
  activity: string;
  estimatedMinutes: number;
}

export interface PlannerDay {
  date: string;
  focus: PlannerActivity[];
}

export interface PlannerWeek {
  weekLabel: string;
  startDate: string;
  endDate: string;
  days: PlannerDay[];
}

export interface PlannerResult {
  overview: string;
  plan: PlannerWeek[];
  successTips?: string[];
}

export interface QuizFeedbackResponse {
  isCorrect: boolean;
  feedback: string;
  improvementTips: string[];
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export type StoredModuleType =
  | "NOTES_SUMMARY"
  | "QUESTION_SET"
  | "QUIZ_SESSION"
  | "FLASHCARD_DECK"
  | "EXAM_PACK"
  | "REVISION_PLAN"
  | "LANGUAGE_PRACTICE"
  | "NESA_SOFTWARE_EXAM"
  | "MEMORISATION";

export type MemorisationTool = "mnemonic" | "essay-coach" | "recall-drills";

export interface MnemonicIdea {
  title: string;
  type: string;
  mnemonic: string;
  explanation: string;
  usageTips?: string[];
}

export interface MnemonicResponse {
  mnemonics: MnemonicIdea[];
  recallStrategies?: string[];
  spacedRepetitionAdvice?: string[];
}

export interface EssaySectionPlan {
  heading: string;
  summary: string;
  keyQuotes?: string[];
  recallCues: string[];
  checkUnderstanding?: string[];
}

export interface EssayCoachResponse {
  sections: EssaySectionPlan[];
  rehearsalPlan: Array<{
    day: string;
    focus: string;
    activities: string[];
  }>;
  activeRecallPrompts?: string[];
  examTips?: string[];
}

export interface RecallDrillItem {
  prompt: string;
  idealAnswer: string;
  hint?: string;
  difficulty?: string;
  followUp?: string;
}

export interface RecallDrillResponse {
  drills: RecallDrillItem[];
  confidenceChecks?: string[];
  spacingReminders?: string[];
}

export type MemorisationResult =
  | {
      tool: "mnemonic";
      meta?: {
        preferredStyle?: string | null;
        focusArea?: string | null;
      };
      result: MnemonicResponse;
    }
  | {
      tool: "essay-coach";
      meta?: {
        rehearsalWindowDays?: number;
        goal?: string | null;
        essayTitle?: string;
      };
      result: EssayCoachResponse;
    }
  | {
      tool: "recall-drills";
      meta?: {
        topic?: string;
        difficulty?: string;
      };
      result: RecallDrillResponse;
    };

export interface ModuleOutputRecord {
  id: string;
  module: StoredModuleType;
  subject?: string | null;
  label?: string | null;
  input: unknown;
  output: unknown;
  createdAt: string;
  createdByName?: string | null;
  userId?: string | null;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export type NESAModuleName =
  | "Secure Software Architecture"
  | "Programming for the Web"
  | "Software Engineering Project"
  | "Automation";

export type NESAQuestionType = "mcq" | "matching" | "short-answer" | "code" | "extended";

export type NESACodeLanguage = "python" | "sql" | "diagram";

export interface NESAMatchingPair {
  left: string;
  right: string;
}

export interface NESAQuestionOption {
  label: string;
  value: string;
}

export interface NESAQuestion {
  id: string;
  type: NESAQuestionType;
  questionNumber: number;
  marks: number;
  modules: string[];
  prompt: string;
  options?: NESAQuestionOption[];
  matchingPairs?: NESAMatchingPair[];
  codeLanguage?: NESACodeLanguage;
  codeStarter?: string;
  expectedOutput?: string;
  sampleAnswer?: string;
  markingCriteria?: string[];
  sqlSampleData?: {
    tableName: string;
    columns: string[];
    rows: string[][];
  }[];
}

export interface NESAMarkingAnswer {
  questionId: string;
  answer: string;
  criteria: string[];
  sampleResponse?: string;
}

export interface NESAMarkingGuide {
  questionAnswers: NESAMarkingAnswer[];
}

export interface NESAExam {
  examTitle: string;
  totalMarks: number;
  timeAllowed: number;
  instructions: string[];
  questions: NESAQuestion[];
  markingGuide?: NESAMarkingGuide;
}

export interface NESAUserAnswer {
  questionId: string;
  answer: string;
  code?: string;
  diagram?: string;
}

export interface NESAQuestionMark {
  questionId: string;
  questionNumber: number;
  userAnswer: string;
  correctAnswer?: string; // For MCQs
  explanation?: string | Record<string, string>; // For MCQs - can be object with per-option explanations
  modelAnswer?: string; // For short/extended response
  exampleCode?: string; // For code questions
  diagramDescription?: string; // For diagram questions
  matchResults?: {
    left: string;
    correctRight: string;
    userRight?: string | null;
    isCorrect: boolean;
    feedback: string;
  }[]; // For matching questions
  markBreakdown: {
    criterion: string;
    marksAwarded: number;
    maxMarks: number;
    feedback: string;
  }[];
  totalMarks: number;
  maxMarks: number;
  feedback: string;
  selfMarkedScore?: number; // For user-entered marks on diagram questions
}

export interface NESAMarkedAttempt {
  examId: string;
  examRecordId?: string; // Link to the original exam record
  examTitle: string;
  questions: NESAQuestion[];
  marks: NESAQuestionMark[];
  totalScore: number;
  totalPossible: number;
  percentage: number;
  completedAt: number;
  savedRecordId?: string; // The database record ID for this marked attempt
}

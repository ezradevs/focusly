import cors from "cors";
import express, { type CookieOptions } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { ModuleType, Prisma } from "@prisma/client";
import { z } from "zod";

import { CLIENT_ORIGIN, PORT } from "./config";
import { prisma } from "./lib/prisma";
import { ensureDatabase } from "./lib/bootstrap";
import { attachUser, requireAuth, withErrorBoundary } from "./middleware/auth";
import { AUTH_COOKIE_NAME, createAuthToken } from "./utils/jwt";
import { runChatCompletion } from "./services/openai";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      // Remove trailing slash if present
      const cleanOrigin = origin.replace(/\/$/, '');

      // Allow localhost for development
      if (cleanOrigin.startsWith('http://localhost')) {
        return callback(null, true);
      }

      // Allow all *.vercel.app domains (production + preview deployments)
      if (cleanOrigin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      // Allow specific CLIENT_ORIGIN if set
      if (CLIENT_ORIGIN) {
        const cleanClientOrigin = CLIENT_ORIGIN.replace(/\/$/, '');
        if (cleanOrigin === cleanClientOrigin) {
          return callback(null, true);
        }
      }

      // Reject all other origins
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z
    .string()
    .min(2, "Name too short")
    .max(80, "Name too long")
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const outputsQuerySchema = z.object({
  module: z.nativeEnum(ModuleType).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const outputIdParamsSchema = z.object({
  id: z.string().cuid(),
});

const outputUpdateSchema = z.object({
  label: z.string().min(1).max(120),
});

const summaryRequestSchema = z.object({
  subject: z.string().min(1),
  tone: z.enum(["concise", "exam-focus"]).default("concise"),
  text: z.string().min(20, "Please provide at least 20 characters of content."),
});

const summaryResponseSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  definitions: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    })
  ),
  followUpSuggestions: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    )
    .optional(),
});

const questionGeneratorSchema = z.object({
  subject: z.string().min(1),
  promptSource: z.enum(["topic", "notes"]).default("topic"),
  content: z.string().min(10),
  questionCount: z
    .number()
    .min(1)
    .max(20)
    .default(5),
  questionTypes: z.array(z.enum(["mcq", "short-answer", "extended"])).min(1),
  includeMarkingGuides: z.boolean().default(false),
});

const questionResponseSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(["mcq", "short-answer", "extended"]),
      prompt: z.string(),
      options: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
          })
        )
        .optional(),
      answer: z.string(),
      explanation: z.string(),
      markingGuide: z.string().optional(),
    })
  ),
});

const quizFeedbackSchema = z.object({
  questionId: z.string(),
  questionType: z.enum(["mcq", "short-answer", "extended"]),
  questionPrompt: z.string(),
  userAnswer: z.string().min(1),
  correctAnswer: z.string().optional(),
  context: z.string().optional(),
});

const quizFeedbackResponseSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
  improvementTips: z.array(z.string()),
});

const flashcardSchema = z.object({
  subject: z.string().min(1),
  sourceText: z.string().min(10),
  includeTypes: z
    .array(z.enum(["basic", "cloze", "image-occlusion"]))
    .default(["basic", "cloze"]),
});

const flashcardResponseSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["basic", "cloze", "image-occlusion"]),
      front: z.string().optional(),
      back: z.string().optional(),
      clozeDeletion: z
        .object({
          fullText: z.string(),
          missingText: z.string(),
        })
        .optional()
        .nullable(),
      imageGuidance: z
        .object({
          prompt: z.string(),
          occlusionIdeas: z.array(
            z.object({
              label: z.string(),
              description: z.string(),
            })
          ),
        })
        .optional()
        .nullable(),
      tags: z.array(z.string()).optional(),
    })
  ),
  studyTips: z.array(z.string()).optional(),
});

const examCreatorSchema = z.object({
  subject: z.string().min(1),
  topics: z.array(z.string()).min(1),
  quantity: z.number().min(1).max(15).default(3),
  includeBandSixSample: z.boolean().default(false),
  userResponse: z.string().optional(),
});

const examResponseSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      criteria: z.array(z.string()),
      bandSixSample: z.string().optional(),
      evaluation: z
        .object({
          summary: z.string(),
          strengths: z.array(z.string()),
          improvements: z.array(z.string()),
          indicativeBand: z.string().optional(),
        })
        .optional(),
    })
  ),
  reflectionPrompts: z.array(z.string()).optional(),
});

const plannerSchema = z.object({
  subjects: z.array(z.string()).min(1),
  topics: z.array(z.string()).min(1),
  examDate: z.string().refine((date) => !Number.isNaN(Date.parse(date)), {
    message: "Invalid exam date.",
  }),
  focusAreas: z.array(z.string()).optional(),
  studyDaysPerWeek: z.number().min(1).max(7).default(5),
});

const plannerResponseSchema = z.object({
  overview: z.string(),
  plan: z.array(
    z.object({
      weekLabel: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      days: z.array(
        z.object({
          date: z.string(),
          focus: z.array(
            z.object({
              subject: z.string(),
              topic: z.string(),
              activity: z.string(),
              estimatedMinutes: z.number(),
            })
          ),
        })
      ),
    })
  ),
  successTips: z.array(z.string()).optional(),
});

const tutorMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const tutorChatSchema = z.object({
  subject: z.string().optional(),
  messages: z.array(tutorMessageSchema).min(1),
});

const toneMap: Record<string, string> = {
  concise: "Concise exam revision tone",
  "exam-focus": "Exam-focused tone highlighting likely test content",
};

type JsonValue = Prisma.InputJsonValue;

type PersistArgs = {
  module: ModuleType;
  subject?: string | null;
  label?: string | null;
  input: JsonValue;
  output: JsonValue;
  userId?: string | null;
};

async function persistModuleOutput({ module, subject, label, input, output, userId }: PersistArgs) {
  if (!userId) return;
  try {
    await prisma.moduleOutput.create({
      data: {
        module,
        subject: subject ?? null,
        label: label ?? null,
        input,
        output,
        userId,
      },
    });
  } catch (error) {
    console.error("[moduleOutput.save]", error);
  }
}

function formatUser(user: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

app.get(
  "/api/health",
  (_req, res) => {
    res.json({ status: "ok", service: "Focusly API" });
  }
);

app.post(
  "/api/auth/signup",
  withErrorBoundary(async (req, res) => {
    const payload = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        name: payload.name ?? null,
      },
    });

    const token = createAuthToken({ sub: user.id, email: user.email, name: user.name });
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.status(201).json({ user: formatUser(user) });
  })
);

app.post(
  "/api/auth/login",
  withErrorBoundary(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = createAuthToken({ sub: user.id, email: user.email, name: user.name });
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.json({ user: formatUser(user) });
  })
);

app.post(
  "/api/auth/logout",
  requireAuth,
  withErrorBoundary(async (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
    res.json({ success: true });
  })
);

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.currentUser ? formatUser(req.currentUser) : null });
});

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name too short").max(80, "Name too long"),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

app.patch(
  "/api/auth/profile",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { name } = updateProfileSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: { name },
    });

    const token = createAuthToken({
      sub: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    });
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.json({ user: formatUser(updatedUser) });
  })
);

app.patch(
  "/api/auth/password",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { currentPassword, newPassword } = updatePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.currentUser!.id },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ success: true });
  })
);

app.delete(
  "/api/auth/account",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    // Delete all user's outputs first
    await prisma.moduleOutput.deleteMany({
      where: { userId: req.currentUser!.id },
    });

    // Delete the user
    await prisma.user.delete({
      where: { id: req.currentUser!.id },
    });

    res.clearCookie(AUTH_COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
    res.json({ success: true });
  })
);

app.get(
  "/api/outputs",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { module, limit } = outputsQuerySchema.parse(req.query);
    const outputs = await prisma.moduleOutput.findMany({
      where: {
        userId: req.currentUser!.id,
        ...(module ? { module } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit ?? 50,
    });

    res.json({ outputs });
  })
);

app.get(
  "/api/outputs/:id",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { id } = outputIdParamsSchema.parse(req.params);
    const output = await prisma.moduleOutput.findFirst({
      where: {
        id,
        userId: req.currentUser!.id,
      },
    });

    if (!output) {
      return res.status(404).json({ error: "Output not found." });
    }

    res.json({ output });
  })
);

app.patch(
  "/api/outputs/:id",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { id } = outputIdParamsSchema.parse(req.params);
    const { label } = outputUpdateSchema.parse(req.body);

    const updated = await prisma.moduleOutput.updateMany({
      where: { id, userId: req.currentUser!.id },
      data: { label },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Output not found." });
    }

    const output = await prisma.moduleOutput.findUnique({ where: { id } });
    res.json({ output });
  })
);

app.delete(
  "/api/outputs/:id",
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { id } = outputIdParamsSchema.parse(req.params);

    const deleted = await prisma.moduleOutput.deleteMany({
      where: { id, userId: req.currentUser!.id },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Output not found." });
    }

    res.json({ success: true });
  })
);

app.post(
  "/api/notes/summarize",
  withErrorBoundary(async (req, res) => {
    const payload = summaryRequestSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly, an expert study companion. Analyse student notes and respond with high-signal summaries, key points, and precise definitions. Always return valid JSON following the provided schema.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}\nTone preference: ${
            toneMap[payload.tone] ?? "Concise revision tone"
          }\nNotes:\n${payload.text}\n\nRespond using JSON with the shape: {"summary": string,"keyPoints": string[],"definitions": [{"term": string,"definition": string}],"followUpSuggestions": [{"title": string,"description": string}]}`,
        },
      ],
      responseFormat: "json",
    });

    const parsed = summaryResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.NOTES_SUMMARY,
      subject: payload.subject,
      label: payload.subject,
      input: payload as JsonValue,
      output: parsed as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/questions/generate",
  withErrorBoundary(async (req, res) => {
    const payload = questionGeneratorSchema.parse(req.body);
    const typeBreakdown = payload.questionTypes
      .map((type) => {
        switch (type) {
          case "mcq":
            return "Multiple choice (provide 4 options with labelled answers)";
          case "short-answer":
            return "Short answer (2-3 sentence ideal response)";
          case "extended":
            return "Extended response (paragraph style with marking guide if requested)";
          default:
            return type;
        }
      })
      .join("; ");

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's question generator. Produce well structured, syllabus-aligned questions and model answers. Always ensure difficulty escalates progressively.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}
Prompt source: ${payload.promptSource}
Content provided:
${payload.content}

Number of questions: ${payload.questionCount}
Question types: ${typeBreakdown}
Include marking guides: ${payload.includeMarkingGuides ? "Yes" : "No"}

Respond with JSON in the following format:
{
  "questions": [
    {
      "type": "mcq" | "short-answer" | "extended",
      "prompt": "question prompt",
      "options": [{"label": "A", "value": "..."}, ...],
      "answer": "model answer or correct option label",
      "explanation": "why the answer is correct / feedback",
      "markingGuide": "criteria"
    }
  ]
}`,
        },
      ],
    });

    const parsed = questionResponseSchema.parse(result);
    const questionsWithIds = parsed.questions.map((question, index) => ({
      id: `${question.type}-${Date.now()}-${index}`,
      ...question,
    }));

    await persistModuleOutput({
      module: ModuleType.QUESTION_SET,
      subject: payload.subject,
      label: `${payload.subject} • ${payload.questionTypes.join(", ")}`,
      input: payload as JsonValue,
      output: { questions: questionsWithIds } as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json({ questions: questionsWithIds });
  })
);

app.post(
  "/api/quiz/feedback",
  withErrorBoundary(async (req, res) => {
    const payload = quizFeedbackSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's formative assessment coach. Evaluate student responses fairly, with explicit links to criteria.",
        },
        {
          role: "user",
          content: `Question type: ${payload.questionType}
Question: ${payload.questionPrompt}
Correct answer (if provided): ${payload.correctAnswer ?? "N/A"}
Student answer: ${payload.userAnswer}
Additional context: ${payload.context ?? "N/A"}

Respond with JSON: {"isCorrect": boolean, "feedback": string, "improvementTips": [string]}`,
        },
      ],
    });

    const parsed = quizFeedbackResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.QUIZ_SESSION,
      label: payload.questionPrompt.slice(0, 80),
      input: payload as JsonValue,
      output: parsed as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/flashcards/build",
  withErrorBoundary(async (req, res) => {
    const payload = flashcardSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's flashcard architect. Produce memory-friendly cards spanning basic Q&A, cloze deletion, and image occlusion guidance.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}
Include card types: ${payload.includeTypes.join(", ")}
Source material:
${payload.sourceText}

Return JSON with structure:
{
  "cards": [
    {
      "id": "slug-or-keyword",
      "type": "basic" | "cloze" | "image-occlusion",
      "front": "prompt or question",
      "back": "answer text (for basic)",
      "clozeDeletion": {
        "fullText": "entire sentence",
        "missingText": "portion removed"
      },
      "imageGuidance": {
        "prompt": "describe image or diagram to use",
        "occlusionIdeas": [{"label": "Area 1", "description": "mask this region"}]
      },
      "tags": ["tag-one", "tag-two"]
    }
  ],
  "studyTips": ["tip 1", "tip 2"]
}`,
        },
      ],
    });

    const parsed = flashcardResponseSchema.parse(result);

    const normalized = {
      cards: parsed.cards.map((card, index) => {
        const front = card.front ?? card.imageGuidance?.prompt ?? `Card ${index + 1}`;
        const imageGuidance = card.imageGuidance ?? undefined;
        const clozeDeletion = card.clozeDeletion ?? undefined;

        return {
          ...card,
          front,
          clozeDeletion,
          imageGuidance,
        };
      }),
      studyTips: parsed.studyTips ?? [],
    };

    await persistModuleOutput({
      module: ModuleType.FLASHCARD_DECK,
      subject: payload.subject,
      label: `${payload.subject} flashcards`,
      input: payload as JsonValue,
      output: normalized as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(normalized);
  })
);

app.post(
  "/api/exams/create",
  withErrorBoundary(async (req, res) => {
    const payload = examCreatorSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's exam designer. Draft rigorous extended response tasks with band 6 exemplars where requested and provide precise evaluation.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}
Key topics: ${payload.topics.join(", ")}
Question quantity: ${payload.quantity}
Include band 6 sample: ${payload.includeBandSixSample ? "Yes" : "No"}
Student response (optional): ${payload.userResponse ?? "N/A"}

Respond with JSON:
{
  "questions": [
    {
      "prompt": "question text",
      "criteria": ["criterion 1", "criterion 2"],
      "bandSixSample": "sample answer if requested",
      "evaluation": {
         "summary": "overall feedback",
         "strengths": ["point"],
         "improvements": ["point"],
         "indicativeBand": "Band 5/6"
      }
    }
  ],
  "reflectionPrompts": ["prompt 1"]
}`,
        },
      ],
    });

    const parsed = examResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.EXAM_PACK,
      subject: payload.subject,
      label: `${payload.subject} exam pack`,
      input: payload as JsonValue,
      output: parsed as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/planner/build",
  withErrorBoundary(async (req, res) => {
    const payload = plannerSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's revision planning assistant. Build motivating weekly/daily schedules aligned with exam timelines.",
        },
        {
          role: "user",
          content: `Subjects: ${payload.subjects.join(", ")}
Topics: ${payload.topics.join(", ")}
Exam date: ${payload.examDate}
Focus areas: ${(payload.focusAreas ?? []).join(", ") || "N/A"}
Study days per week: ${payload.studyDaysPerWeek}

Return JSON:
{
  "overview": "summary of plan",
  "plan": [
    {
      "weekLabel": "Week 1",
      "startDate": "2024-03-01",
      "endDate": "2024-03-07",
      "days": [
        {
          "date": "2024-03-01",
          "focus": [
            {
              "subject": "Biology",
              "topic": "Cell respiration",
              "activity": "Review flashcards",
              "estimatedMinutes": 45
            }
          ]
        }
      ]
    }
  ],
  "successTips": ["tip 1"]
}`,
        },
      ],
    });

    const parsed = plannerResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.REVISION_PLAN,
      subject: payload.subjects.join(", "),
      label: `${payload.subjects.join(", ")} planner`,
      input: payload as JsonValue,
      output: parsed as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/tutor/chat",
  withErrorBoundary(async (req, res) => {
    const payload = tutorChatSchema.parse(req.body);

    const history = payload.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const result = await runChatCompletion<string>({
      messages: [
        {
          role: "system",
          content: `You are Focusly Tutor, a supportive study coach. Keep answers concise, actionable, and reference syllabus concepts when possible. ${
            payload.subject ? `Subject focus: ${payload.subject}.` : ""
          }`
        },
        ...history,
      ],
      responseFormat: "text",
      temperature: 0.4,
    });

    res.json({
      reply: result,
    });
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server.error]", error);
  res.status(500).json({ error: "Internal server error." });
});

// Initialize database only in development
async function initializeServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      await ensureDatabase();
    } catch (error) {
      console.error("[server.bootstrap]", error);
    }
  }
}

// Call initialization but don't await it to avoid blocking serverless startup
void initializeServer();

// For Vercel serverless deployment
export default app;

// Only start server in development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Focusly API listening on port ${PORT}`);
  });
}

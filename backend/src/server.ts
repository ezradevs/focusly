import cors from "cors";
import express, { type CookieOptions } from "express";
import type { PathParams } from "express-serve-static-core";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { ModuleType, Prisma } from "@prisma/client";
import { z } from "zod";
import rateLimit from "express-rate-limit";

import { CLIENT_ORIGIN, PORT } from "./config";
import { prisma } from "./lib/prisma";
import { ensureDatabase } from "./lib/bootstrap";
import { attachUser, requireAuth, withErrorBoundary } from "./middleware/auth";
import { sanitizeRequestBody } from "./middleware/sanitize";
import { AUTH_COOKIE_NAME, createAuthToken } from "./utils/jwt";
import { generateToken, hashToken } from "./utils/tokens";
import { runChatCompletion } from "./services/openai";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "./services/email";

const app = express();

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes for auth endpoints
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 AI requests per 15 minutes
  message: "Too many AI generation requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

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
app.use(sanitizeRequestBody); // Sanitize all incoming request bodies to prevent XSS
app.use(cookieParser());
app.use(generalLimiter); // Apply general rate limiting to all routes
app.use(attachUser);

// CSRF Protection Strategy:
// We use SameSite cookies for CSRF protection:
// - Development: sameSite="lax" prevents CSRF from external sites
// - Production: sameSite="none" with secure=true for cross-domain, protected by strict CORS
// - All cookies are HTTP-only, preventing XSS attacks from stealing tokens
// - CORS configuration only allows specific origins
// This approach provides strong CSRF protection without requiring explicit CSRF tokens
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

// Password validation with strong requirements
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be less than 80 characters")
    .optional(),
});

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const outputsQuerySchema = z.object({
  module: z.nativeEnum(ModuleType).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
});

const outputIdParamsSchema = z.object({
  id: z.string().cuid(),
});

const outputUpdateSchema = z.object({
  label: z.string().min(1).max(120),
});

const nesaAttemptUpdateSchema = z.object({
  selfMarkedScores: z.record(z.string(), z.number()),
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

const mnemonicRequestSchema = z.object({
  subject: z.string().min(1),
  keyIdeas: z.string().min(10, "Share at least a sentence of key ideas"),
  preferredStyle: z
    .enum(["acrostic", "story", "visual", "chunking", "rhythm"])
    .default("acrostic"),
  focusArea: z.string().optional(),
});

const mnemonicResponseSchema = z.object({
  mnemonics: z.array(
    z.object({
      title: z.string(),
      type: z.string(),
      mnemonic: z.string(),
      explanation: z.string(),
      usageTips: z.array(z.string()).optional(),
    })
  ),
  recallStrategies: z.array(z.string()).optional(),
  spacedRepetitionAdvice: z.array(z.string()).optional(),
});

const essayCoachSchema = z.object({
  subject: z.string().min(1),
  essayTitle: z.string().min(3),
  essayText: z
    .string()
    .min(120, "Provide at least a paragraph so we can coach memorisation effectively."),
  rehearsalWindowDays: z.coerce.number().min(3).max(42).default(14),
  goal: z.string().optional(),
});

const essayCoachResponseSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string(),
      summary: z.string(),
      keyQuotes: z.array(z.string()).optional(),
      recallCues: z.array(z.string()),
      checkUnderstanding: z.array(z.string()).optional(),
    })
  ),
  rehearsalPlan: z.array(
    z.object({
      day: z.string(),
      focus: z.string(),
      activities: z.array(z.string()),
    })
  ),
  activeRecallPrompts: z.array(z.string()).optional(),
  examTips: z.array(z.string()).optional(),
});

const recallDrillSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().min(1),
  facts: z.array(z.string()).min(3, "List at least three facts to drill."),
  difficulty: z.enum(["gentle", "balanced", "intense"]).default("balanced"),
});

const recallDrillResponseSchema = z.object({
  drills: z.array(
    z.object({
      prompt: z.string(),
      idealAnswer: z.string(),
      hint: z.string().optional(),
      difficulty: z.string().optional(),
      followUp: z.string().optional(),
    })
  ),
  confidenceChecks: z.array(z.string()).optional(),
  spacingReminders: z.array(z.string()).optional(),
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
  createdByName?: string | null;
};

function deriveUserDisplayName(
  user?: { name?: string | null; email?: string | null } | null,
  fallback?: string | null
): string | null {
  const fromUserName = user?.name?.trim();
  if (fromUserName) {
    return fromUserName;
  }

  const emailHandle = user?.email?.trim()?.split("@")[0];
  if (emailHandle) {
    return emailHandle;
  }

  const fallbackName = fallback?.trim();
  if (fallbackName) {
    return fallbackName;
  }

  return null;
}

async function persistModuleOutput({
  module,
  subject,
  label,
  input,
  output,
  userId,
  createdByName,
}: PersistArgs) {
  try {
    const created = await prisma.moduleOutput.create({
      data: {
        module,
        subject: subject ?? null,
        label: label ?? null,
        input,
        output,
        userId: userId ?? null,
        createdByName: createdByName ?? null,
      },
    });
    return created;
  } catch (error) {
    console.error("[moduleOutput.save]", error);
    return null;
  }
}

function formatUser(user: {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
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
  authLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    // Generate verification token (hash it before storing in database)
    const { token: rawToken, hashedToken } = generateToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        name: payload.name ?? null,
        emailVerified: false,
        verificationToken: hashedToken, // Store hashed token in database
        tokenExpiresAt,
      },
    });

    // Send verification email with raw token
    try {
      await sendVerificationEmail({
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
        verificationToken: rawToken, // Send raw token to user
      });
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Continue with signup even if email fails
    }

    const token = createAuthToken({ sub: user.id, email: user.email, name: user.name });
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.status(201).json({
      user: formatUser(user),
      message: "Account created! Please check your email to verify your account."
    });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Check if account is locked out
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (1000 * 60));
      return res.status(429).json({
        error: `Account is locked due to too many failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`
      });
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      // Increment failed login attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const maxAttempts = 5;
      const lockoutDuration = 15 * 60 * 1000; // 15 minutes

      if (newFailedAttempts >= maxAttempts) {
        // Lock the account
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newFailedAttempts,
            lockoutUntil: new Date(Date.now() + lockoutDuration),
          },
        });
        return res.status(429).json({
          error: "Too many failed login attempts. Your account has been locked for 15 minutes."
        });
      } else {
        // Just increment the counter
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: newFailedAttempts },
        });
        const attemptsLeft = maxAttempts - newFailedAttempts;
        return res.status(401).json({
          error: `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining before account lockout.`
        });
      }
    }

    // Successful login - reset failed attempts and lockout
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

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

app.post(
  "/api/auth/verify",
  withErrorBoundary(async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);

    // Hash the incoming token to compare with stored hash
    const hashedToken = hashToken(token);

    const user = await prisma.user.findUnique({
      where: { verificationToken: hashedToken },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token." });
    }

    // Check if token has expired
    if (user.tokenExpiresAt && user.tokenExpiresAt < new Date()) {
      return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
    }

    // Update user to mark as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        tokenExpiresAt: null,
      },
    });

    // Send welcome email after successful verification
    try {
      await sendWelcomeEmail({
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      // Continue even if welcome email fails
    }

    res.json({ success: true, message: "Email verified successfully!" });
  })
);

// Resend Verification Email
app.post(
  "/api/auth/resend-verification",
  authLimiter,
  withErrorBoundary(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: "If that email exists and is unverified, a verification link has been sent." });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.json({ success: true, message: "Email is already verified." });
    }

    // Check if there's an existing valid token (less than 23 hours old)
    if (user.tokenExpiresAt && user.tokenExpiresAt > new Date()) {
      // Token is still valid, send the same one
      return res.json({ success: true, message: "A verification email was already sent. Please check your inbox." });
    }

    // Generate new verification token (hash it before storing)
    const { token: rawToken, hashedToken } = generateToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashedToken,
        tokenExpiresAt,
      },
    });

    // Send verification email with raw token
    try {
      await sendVerificationEmail({
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
        verificationToken: rawToken,
      });
    } catch (error) {
      // Log error but still return success
    }

    res.json({ success: true, message: "Verification email sent. Please check your inbox." });
  })
);

// Password Reset Request
app.post(
  "/api/auth/password/reset-request",
  authLimiter,
  withErrorBoundary(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: "If that email exists, a reset link has been sent." });
    }

    // Generate reset token (hash it before storing, 1 hour expiry)
    const { token: rawToken, hashedToken } = generateToken();
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: hashedToken, // Store hashed token
        tokenExpiresAt,
      },
    });

    // Send password reset email with raw token
    try {
      await sendPasswordResetEmail({
        email: user.email,
        ...(user.name ? { name: user.name } : {}),
        resetToken: rawToken, // Send raw token to user
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      // Continue even if email fails
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent." });
  })
);

// Password Reset Confirm
app.post(
  "/api/auth/password/reset-confirm",
  authLimiter,
  withErrorBoundary(async (req, res) => {
    const { token, newPassword } = z.object({
      token: z.string(),
      newPassword: passwordSchema,
    }).parse(req.body);

    // Hash the incoming token to compare with stored hash
    const hashedToken = hashToken(token);

    const user = await prisma.user.findUnique({
      where: { verificationToken: hashedToken },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    // Check if token has expired
    if (user.tokenExpiresAt && user.tokenExpiresAt < new Date()) {
      return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
    }

    // Update password and clear token
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        verificationToken: null,
        tokenExpiresAt: null,
      },
    });

    res.json({ success: true, message: "Password reset successfully!" });
  })
);

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.currentUser ? formatUser(req.currentUser) : null });
});

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name must be less than 80 characters"),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
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
    const { module, limit, search } = outputsQuerySchema.parse(req.query);
    const outputs = await prisma.moduleOutput.findMany({
      where: {
        userId: req.currentUser!.id,
        ...(module ? { module } : {}),
        ...(search
          ? {
              OR: [
                { label: { contains: search, mode: "insensitive" } },
                { subject: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
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
  aiLimiter,
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
  aiLimiter,
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
  aiLimiter,
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
  aiLimiter,
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
  aiLimiter,
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
  aiLimiter,
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
  "/api/memorisation/mnemonics",
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = mnemonicRequestSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's memorisation coach. Design memorable devices tailored to the student's preferences. Always respond with the requested JSON schema.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}\nFocus area: ${payload.focusArea ?? "General"}\nPreferred style: ${payload.preferredStyle}\nKey ideas to remember:\n${payload.keyIdeas}\n\nReturn JSON shaped as {"mnemonics": [{"title": string, "type": string, "mnemonic": string, "explanation": string, "usageTips": [string]}], "recallStrategies": [string], "spacedRepetitionAdvice": [string]}`,
        },
      ],
    });

    const parsed = mnemonicResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.MEMORISATION,
      subject: payload.subject,
      label: `${payload.subject} • Memorisation mnemonics`,
      input: payload as JsonValue,
      output: {
        tool: "mnemonic",
        meta: {
          preferredStyle: payload.preferredStyle,
          focusArea: payload.focusArea ?? null,
        },
        result: parsed,
      } as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/memorisation/essay-coach",
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = essayCoachSchema.parse(req.body);

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's essay memorisation mentor. Break essays into memorable chunks, generate cues, and propose rehearsal schedules that blend spaced repetition and active recall. Always output valid JSON matching the schema.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}\nEssay title: ${payload.essayTitle}\nStudy goal: ${payload.goal ?? "Exam mastery"}\nRehearsal window (days): ${payload.rehearsalWindowDays}\nEssay text:\n${payload.essayText}\n\nRespond with JSON shaped as {"sections": [{"heading": string, "summary": string, "keyQuotes": [string], "recallCues": [string], "checkUnderstanding": [string]}], "rehearsalPlan": [{"day": string, "focus": string, "activities": [string]}], "activeRecallPrompts": [string], "examTips": [string]}`,
        },
      ],
      maxTokens: 1200,
    });

    const parsed = essayCoachResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.MEMORISATION,
      subject: payload.subject,
      label: `${payload.subject} • Essay coach`,
      input: payload as JsonValue,
      output: {
        tool: "essay-coach",
        meta: {
          rehearsalWindowDays: payload.rehearsalWindowDays,
          goal: payload.goal ?? null,
          essayTitle: payload.essayTitle,
        },
        result: parsed,
      } as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/memorisation/recall-drills",
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = recallDrillSchema.parse(req.body);

    const factsList = payload.facts
      .map((fact, index) => `${index + 1}. ${fact}`)
      .join("\n");

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Focusly's active recall drill designer. Create escalating prompts with expected answers, hints, and follow-up reflections to reinforce retention. Always return valid JSON following the requested schema.",
        },
        {
          role: "user",
          content: `Subject: ${payload.subject}\nTopic: ${payload.topic}\nDifficulty preference: ${payload.difficulty}\nFacts to retain:\n${factsList}\n\nReturn JSON shaped as {"drills": [{"prompt": string, "idealAnswer": string, "hint": string, "difficulty": string, "followUp": string}], "confidenceChecks": [string], "spacingReminders": [string]}`,
        },
      ],
    });

    const parsed = recallDrillResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.MEMORISATION,
      subject: payload.subject,
      label: `${payload.subject} • Recall drills`,
      input: payload as JsonValue,
      output: {
        tool: "recall-drills",
        meta: {
          topic: payload.topic,
          difficulty: payload.difficulty,
        },
        result: parsed,
      } as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

app.post(
  "/api/tutor/chat",
  aiLimiter,
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

const languagePracticeSchema = z.object({
  language: z.string().min(1),
  practiceMode: z.enum(["vocabulary", "grammar", "conversation", "writing", "translation"]),
  content: z.string().min(1),
  proficiencyLevel: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  context: z.string().optional(),
});

const languagePracticeResponseSchema = z.object({
  result: z.union([
    z.object({
      mode: z.literal("vocabulary"),
      words: z.array(
        z.object({
          word: z.string(),
          translation: z.string(),
          pronunciation: z.string().optional(),
          partOfSpeech: z.string(),
          exampleSentence: z.string(),
          usageTips: z.array(z.string()),
        })
      ),
    }),
    z.object({
      mode: z.literal("grammar"),
      corrections: z.array(
        z.object({
          original: z.string(),
          corrected: z.string(),
          explanation: z.string(),
          rule: z.string(),
        })
      ),
      summary: z.string(),
    }),
    z.object({
      mode: z.literal("conversation"),
      dialogue: z.array(
        z.object({
          speaker: z.string(),
          text: z.string(),
          translation: z.string().optional(),
        })
      ),
      vocabulary: z.array(z.string()),
      culturalNotes: z.array(z.string()).optional(),
    }),
    z.object({
      mode: z.literal("writing"),
      prompt: z.string(),
      feedback: z
        .object({
          grammar: z.array(z.string()),
          vocabulary: z.array(z.string()),
          structure: z.array(z.string()),
          overallScore: z.number(),
        })
        .optional(),
      improvements: z.array(z.string()),
    }),
    z.object({
      mode: z.literal("translation"),
      originalText: z.string(),
      translatedText: z.string(),
      alternativeTranslations: z.array(z.string()).optional(),
      explanations: z.array(
        z.object({
          phrase: z.string(),
          explanation: z.string(),
        })
      ),
    }),
  ]),
});

const languageConversationSchema = z.object({
  language: z.string().min(1),
  proficiencyLevel: z.enum(["beginner", "intermediate", "advanced"]),
  scenario: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
});

const languageConversationResponseSchema = z.object({
  message: z.string(),
  translation: z.string(),
  feedback: z.object({
    grammarNotes: z.array(z.string()),
    vocabularySuggestions: z.array(z.string()),
    culturalTips: z.array(z.string()).optional(),
  }).optional(),
});

app.post(
  "/api/language/conversation",
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = languageConversationSchema.parse(req.body);

    const systemPrompt = `You are a ${payload.language} language tutor for ${payload.proficiencyLevel} level students.
${payload.scenario ? `Scenario: ${payload.scenario}` : "Engage in natural conversation."}

IMPORTANT INSTRUCTIONS:
1. Respond ONLY in ${payload.language} (not English)
2. Match the student's proficiency level (${payload.proficiencyLevel})
3. Be conversational, encouraging, and natural
4. Keep responses concise (2-4 sentences max)
5. If the student makes errors, gently incorporate corrections in your response

Return JSON with:
{
  "message": "your response in ${payload.language}",
  "translation": "English translation of your response",
  "feedback": {
    "grammarNotes": ["any grammar corrections or tips"],
    "vocabularySuggestions": ["better word choices or expressions"],
    "culturalTips": ["relevant cultural context"]
  }
}`;

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...payload.messages,
      ],
      responseFormat: "json",
      temperature: 0.7,
    });

    const parsed = languageConversationResponseSchema.parse(result);
    res.json(parsed);
  })
);

app.post(
  "/api/language/practice",
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = languagePracticeSchema.parse(req.body);

    const modePrompts = {
      vocabulary: `Generate a vocabulary lesson for ${payload.language} at ${payload.proficiencyLevel} level.
Topic/words: ${payload.content}

Return JSON:
{
  "result": {
    "mode": "vocabulary",
    "words": [
      {
        "word": "word in target language",
        "translation": "English translation",
        "pronunciation": "phonetic or romanization",
        "partOfSpeech": "noun/verb/adjective/etc",
        "exampleSentence": "natural example sentence in target language",
        "usageTips": ["tip about when/how to use", "common collocations"]
      }
    ]
  }
}`,
      grammar: `Check and correct the following ${payload.language} text. Provide detailed grammar explanations.
Proficiency level: ${payload.proficiencyLevel}
Text: ${payload.content}

Return JSON:
{
  "result": {
    "mode": "grammar",
    "corrections": [
      {
        "original": "incorrect phrase",
        "corrected": "corrected phrase",
        "explanation": "why it's wrong and how to fix it",
        "rule": "the grammar rule that applies"
      }
    ],
    "summary": "overall assessment of grammar proficiency"
  }
}`,
      conversation: `Create a realistic conversation scenario in ${payload.language} at ${payload.proficiencyLevel} level.
Scenario: ${payload.content}
${payload.context ? `Additional context: ${payload.context}` : ""}

Return JSON:
{
  "result": {
    "mode": "conversation",
    "dialogue": [
      {
        "speaker": "Person A",
        "text": "dialogue in target language",
        "translation": "English translation"
      }
    ],
    "vocabulary": ["key word 1", "key word 2"],
    "culturalNotes": ["cultural tip 1", "cultural tip 2"]
  }
}`,
      writing: `${
        payload.content.length > 50
          ? `Provide detailed feedback on this ${payload.language} writing (${payload.proficiencyLevel} level):\n${payload.content}`
          : `Generate a writing prompt for ${payload.language} practice at ${payload.proficiencyLevel} level.\nTopic: ${payload.content}`
      }

Return JSON:
{
  "result": {
    "mode": "writing",
    "prompt": "${payload.content.length > 50 ? payload.content : "generated prompt"}",
    ${
      payload.content.length > 50
        ? `"feedback": {
      "grammar": ["grammar point 1"],
      "vocabulary": ["vocabulary suggestion 1"],
      "structure": ["structure improvement 1"],
      "overallScore": 85
    },`
        : ""
    }
    "improvements": ["suggestion 1", "suggestion 2"]
  }
}`,
      translation: `Translate the following text to ${payload.language} at ${payload.proficiencyLevel} level, with explanations.
Text: ${payload.content}

Return JSON:
{
  "result": {
    "mode": "translation",
    "originalText": "${payload.content}",
    "translatedText": "translation",
    "alternativeTranslations": ["alternative 1", "alternative 2"],
    "explanations": [
      {
        "phrase": "specific phrase from translation",
        "explanation": "why translated this way, grammar notes, cultural context"
      }
    ]
  }
}`,
    };

    const result = await runChatCompletion({
      messages: [
        {
          role: "system",
          content: `You are Focusly's language learning assistant. You help students practice ${payload.language} through various interactive methods. Always provide accurate translations, clear explanations, and culturally appropriate content. Return valid JSON following the provided schema.`,
        },
        {
          role: "user",
          content: modePrompts[payload.practiceMode],
        },
      ],
      responseFormat: "json",
    });

    const parsed = languagePracticeResponseSchema.parse(result);

    await persistModuleOutput({
      module: ModuleType.LANGUAGE_PRACTICE,
      subject: payload.language,
      label: `${payload.language} • ${payload.practiceMode}`,
      input: payload as JsonValue,
      output: parsed as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    res.json(parsed);
  })
);

const nesaExamSchema = z.object({
  modules: z.array(z.enum(["Secure Software Architecture", "Programming for the Web", "Software Engineering Project", "Automation"])).min(1),
  questionCount: z.number().min(15).max(30).default(25),
  includeMarkingGuide: z.boolean().default(true),
  seed: z.string().optional(),
});

const nesaQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["mcq", "matching", "short-answer", "code", "extended"]),
  questionNumber: z.number(),
  marks: z.number(),
  modules: z.array(z.string()),
  prompt: z.string(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  matchingPairs: z.array(z.object({
    left: z.string(),
    right: z.string(),
  })).optional(),
  codeLanguage: z.enum(["python", "sql", "diagram"]).optional(),
  codeStarter: z.string().optional(),
  expectedOutput: z.string().optional(),
  sampleAnswer: z.string().optional(),
  markingCriteria: z.array(z.string()).optional(),
  sqlSampleData: z.array(z.object({
    tableName: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  })).optional(),
});

const nesaExamResponseSchema = z.object({
  examTitle: z.string(),
  totalMarks: z.number(),
  timeAllowed: z.number(),
  instructions: z.array(z.string()),
  questions: z.array(nesaQuestionSchema),
  markingGuide: z.object({
    questionAnswers: z.array(z.object({
      questionId: z.string(),
      answer: z.string(),
      criteria: z.array(z.string()),
      sampleResponse: z.string().optional(),
    })),
  }),
});

const nesaMarkingRequestSchema = z.object({
  examTitle: z.string(),
  examRecordId: z.string().optional(),
  questions: z.array(nesaQuestionSchema),
  userAnswers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
  })),
});

app.post(
  "/api/nesa/generate",
  requireAuth,
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = nesaExamSchema.parse(req.body);

    const modulesText = payload.modules.join(", ");
    const seedInstruction = payload.seed
      ? `Use seed "${payload.seed}" to ensure deterministic generation. Vary the specific details, datasets, and wording while maintaining the same structure and difficulty.`
      : "Generate unique questions while maintaining NESA standards.";

    const systemPrompt = `You are the official NESA NSW Software Engineering HSC exam generator. You MUST generate exams that are IDENTICAL in format, tone, style, and rigor to official NESA sample exams.

COURSE SPECIFICATIONS YOU MUST FOLLOW:
- System and Data Modelling: Data flow diagrams, structure charts, data dictionaries, class diagrams, storyboards, decision trees
- Programming Paradigms: Object-oriented, logic, imperative, functional
- Algorithms: Pseudocode, flowcharts, sequence, selection, repetition, nested structures
- Subroutines: Parameters, return values, scope
- Relational Databases: SQL (SELECT, FROM, WHERE, GROUP BY, ORDER BY, SUM, AVG, COUNT, MIN, MAX), ORM principles
- Programming for the Web: Front-end frameworks, cross-site scripting, CSS, HTML
- Machine Learning: MLOps stages, regression algorithms, neural networks, training/execution cycles
- Testing Methods: Functional, acceptance, live, simulated, beta, volume testing
- Character Representation: ASCII, Unicode
- Python Programming: Control structures, classes, functions, file handling, libraries
- Security: SAST, DAST, authentication, authorization, encryption
- Project Management: Gantt charts, process diaries, Agile, DevOps
- System Implementation: Rollout types, deployment strategies

EXAM STRUCTURE (MUST MATCH):
1. Multiple Choice Questions (8 questions, 1-2 marks each): Test foundational knowledge
2. Matching/Classification Questions (2 questions, 2-3 marks each): Match concepts, categorize items
3. Short Answer Questions (6 questions, 2-3 marks each): Brief technical explanations
4. Applied Code/Algorithm Questions (5 questions, 3-6 marks each): Python code, SQL queries, algorithm design, debugging
5. Extended Response (1 question, 6-8 marks): Comprehensive analysis of DevOps, Automation, ML, or security topics

CRITICAL REQUIREMENTS:
- Use authentic NESA phrasing and academic tone
- Questions must be technically accurate and aligned with HSC standards
- Mark allocations must reflect question complexity
- Include clear, unambiguous instructions
- For code questions: Provide starter code or context
- For diagram questions: Specify which diagram type (DFD, structure chart, class diagram, decision tree)
- Extended response must require synthesis of multiple concepts
- Questions progress from foundational to complex
- Use realistic scenarios and datasets`;

    const userPrompt = `Generate a complete NSW HSC Software Engineering practice exam covering: ${modulesText}

Total questions: ${payload.questionCount}
Include marking guide: Yes
${seedInstruction}

REQUIRED QUESTION DISTRIBUTION:
- ~8 Multiple Choice (1-2 marks each)
- 2 Matching/Classification (2-3 marks each)
- 6 Short Answer (2-3 marks each)
- 5 Code/Algorithm/Diagram (3-6 marks each)
- 1 Extended Response (6-8 marks)

Return JSON matching this exact structure:
{
  "examTitle": "NSW HSC Software Engineering Practice Examination",
  "totalMarks": <sum of all marks>,
  "timeAllowed": 180,
  "instructions": [
    "Attempt ALL questions",
    "Write using black pen",
    "For coding questions, you may test your code in the provided editor",
    "Diagrams must be clearly labelled",
    "Total marks: <marks>",
    "Reading time: 5 minutes",
    "Working time: 3 hours"
  ],
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "questionNumber": 1,
      "marks": 1,
      "modules": ["<module name>"],
      "prompt": "What is the primary purpose of requirements gathering in the software development lifecycle?",
      "options": [
        {"label": "A", "value": "To write code faster"},
        {"label": "B", "value": "To identify and document stakeholder needs"},
        {"label": "C", "value": "To test the final product"},
        {"label": "D", "value": "To deploy the application"}
      ]
    },
    {
      "id": "q9",
      "type": "matching",
      "questionNumber": 9,
      "marks": 3,
      "modules": ["<module>"],
      "prompt": "Match each testing method to its correct description.",
      "matchingPairs": [
        {"left": "SAST", "right": "Analyzes source code without execution"},
        {"left": "DAST", "right": "Tests running applications"},
        {"left": "Penetration Testing", "right": "Simulates real-world attacks"}
      ]
    },
    {
      "id": "q12",
      "type": "short-answer",
      "questionNumber": 12,
      "marks": 3,
      "modules": ["<module>"],
      "prompt": "Explain the difference between authentication and authorization in web security."
    },
    {
      "id": "q18",
      "type": "code",
      "questionNumber": 18,
      "marks": 5,
      "modules": ["Programming for the Web"],
      "prompt": "Write a Python function that takes a list of integers and returns only the even numbers. Include error handling for invalid input.",
      "codeLanguage": "python",
      "codeStarter": "def filter_even_numbers(numbers):\\n    # Your code here\\n    pass",
      "expectedOutput": "Example: filter_even_numbers([1, 2, 3, 4, 5, 6]) should return [2, 4, 6]"
    },
    {
      "id": "q20",
      "type": "code",
      "questionNumber": 20,
      "marks": 4,
      "modules": ["Programming for the Web"],
      "prompt": "Write an SQL query to find all students with grades above 75, ordered by grade descending.",
      "codeLanguage": "sql",
      "codeStarter": "-- Write your SQL query here",
      "expectedOutput": "Should return student_id, name, and grade for all students with grade > 75",
      "sqlSampleData": [
        {
          "tableName": "students",
          "columns": ["student_id", "name", "grade"],
          "rows": [
            ["1", "Alice Johnson", "85"],
            ["2", "Bob Smith", "92"],
            ["3", "Carol Davis", "68"],
            ["4", "David Wilson", "95"],
            ["5", "Eve Martinez", "72"]
          ]
        }
      ]
    },
    {
      "id": "q22",
      "type": "code",
      "questionNumber": 22,
      "marks": 6,
      "modules": ["Software Engineering Project"],
      "prompt": "Draw a structure chart for a library management system with the following modules: Main Controller, Book Management (Add Book, Remove Book, Search Book), Member Management (Register Member, Remove Member), and Loan Processing (Issue Loan, Return Book). Show the hierarchy and data flow.",
      "codeLanguage": "diagram",
      "expectedOutput": "Structure chart showing hierarchical decomposition with data/control flow"
    },
    {
      "id": "q25",
      "type": "extended",
      "questionNumber": 25,
      "marks": 8,
      "modules": ["Automation", "Secure Software Architecture"],
      "prompt": "Discuss how machine learning can be integrated into DevOps pipelines to improve software security. In your response, address:\\n(a) The role of ML in automated security testing (3 marks)\\n(b) Potential challenges and limitations (3 marks)\\n(c) Best practices for implementation (2 marks)\\n\\nProvide specific examples from MLOps and DevSecOps practices."
    }
  ],
  "markingGuide": {
    "questionAnswers": [
      {
        "questionId": "q1",
        "answer": "B",
        "criteria": ["Correctly identifies stakeholder needs as primary purpose"],
        "sampleResponse": "Option B is correct as requirements gathering focuses on identifying and documenting what stakeholders need from the system."
      },
      // ... answers for all questions
    ]
  }
}

IMPORTANT:
- Generate ${payload.questionCount} questions total
- Distribute marks appropriately (total should be 80-100 marks)
- Code questions MUST specify language (python, sql, or diagram)
- For SQL questions: MUST include "sqlSampleData" with table name, columns, and 5-10 sample rows
- Extended response must reference multiple syllabus topics
- All questions must be technically accurate and HSC-appropriate
- Use realistic, engaging scenarios
- Maintain professional NESA tone throughout`;

    const baseMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "user" as const,
        content: userPrompt,
      },
    ];

    const maxAttempts = 3;
    let parsedExam: z.infer<typeof nesaExamResponseSchema> | null = null;
    let lastQuestionCount: number | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attemptMessages = [...baseMessages];
      if (attempt > 0 && lastQuestionCount !== null) {
        attemptMessages.push({
          role: "system" as const,
          content: `The previous attempt produced ${lastQuestionCount} questions. Regenerate the exam so that it contains exactly ${payload.questionCount} questions. Do not add extra commentary and ensure the JSON matches the required schema.`,
        });
      }

      const result = await runChatCompletion({
        messages: attemptMessages,
        responseFormat: "json",
        temperature: payload.seed ? 0.3 : 0.7, // Lower temperature for seeded generation
      });

      // Preprocess to fix common AI formatting issues
      console.log('[NESA] Starting preprocessing...');
      const preprocessed = result as any;
      const validCodeLanguages = ['python', 'sql', 'diagram'];

      if (preprocessed.questions && Array.isArray(preprocessed.questions)) {
        preprocessed.questions = preprocessed.questions.map((q: any, idx: number) => {
          // Log codeLanguage for debugging
          if (q.codeLanguage !== undefined && q.codeLanguage !== null) {
            console.log(`[NESA] Q${idx}: codeLanguage before processing:`, typeof q.codeLanguage, Array.isArray(q.codeLanguage), q.codeLanguage);
          }

          // Fix codeLanguage if it's an array - take first element
          if (q.codeLanguage !== undefined && q.codeLanguage !== null && Array.isArray(q.codeLanguage)) {
            console.log(`[NESA] Q${idx}: Converting array codeLanguage to first element`);
            q.codeLanguage = q.codeLanguage[0];
          }

          // Validate codeLanguage is one of the allowed values
          if (q.codeLanguage !== undefined && q.codeLanguage !== null && typeof q.codeLanguage === 'string') {
            if (!validCodeLanguages.includes(q.codeLanguage)) {
              console.log(`[NESA] Q${idx}: Invalid codeLanguage "${q.codeLanguage}", removing it`);
              delete q.codeLanguage;
              // Change question type from 'code' to 'short-answer' if it had invalid language
              if (q.type === 'code') {
                console.log(`[NESA] Q${idx}: Changing type from 'code' to 'short-answer'`);
                q.type = 'short-answer';
              }
            }
          }

          // Remove codeLanguage if question type is not 'code'
          if (q.type !== 'code' && q.codeLanguage !== undefined && q.codeLanguage !== null) {
            console.log(`[NESA] Q${idx}: Removing codeLanguage from non-code question (type=${q.type})`);
            delete q.codeLanguage;
          }
          return q;
        });
      }
      console.log('[NESA] Preprocessing complete');

      // Fix marking guide answers that are arrays instead of strings
      if (preprocessed.markingGuide?.questionAnswers && Array.isArray(preprocessed.markingGuide.questionAnswers)) {
        preprocessed.markingGuide.questionAnswers = preprocessed.markingGuide.questionAnswers.map((qa: any, idx: number) => {
          if (qa.answer && Array.isArray(qa.answer)) {
            console.log(`[NESA] Marking guide answer ${idx} is array, converting to string:`, qa.answer);
            // If it's a single-element array, take the element; otherwise join with newlines
            qa.answer = qa.answer.length === 1 ? qa.answer[0] : qa.answer.join('\n');
          }
          return qa;
        });
      }

      let candidate;
      try {
        candidate = nesaExamResponseSchema.parse(preprocessed);
      } catch (parseError: any) {
        // Log the actual problematic data for debugging
        if (parseError.errors) {
          parseError.errors.forEach((err: any) => {
            const path = err.path.join('.');
            console.error(`[NESA Validation Error] Path: ${path}, Message: ${err.message}`);
            // Log the actual value that failed validation
            if (err.path.length > 0) {
              let value = preprocessed;
              for (const key of err.path) {
                value = value?.[key];
              }
              console.error(`[NESA Validation Error] Actual value:`, value);
            }
          });
        }
        throw parseError;
      }
      lastQuestionCount = candidate.questions.length;

      if (candidate.questions.length === payload.questionCount) {
        parsedExam = candidate;
        break;
      }

      parsedExam = candidate;
    }

    if (!parsedExam || parsedExam.questions.length !== payload.questionCount) {
      res.status(502).json({
        error: `The generator could not create exactly ${payload.questionCount} questions after multiple attempts. Please try again.`,
      });
      return;
    }

    const creator = req.currentUser!;
    const createdByName =
      deriveUserDisplayName(creator) ?? "Focusly Learner";

    await persistModuleOutput({
      module: ModuleType.NESA_SOFTWARE_EXAM,
      subject: "Software Engineering",
      label: `NESA HSC Exam • ${modulesText}`,
      input: payload as JsonValue,
      output: parsedExam as JsonValue,
      userId: creator.id,
      createdByName,
    });

    res.json(parsedExam);
  })
);

const nesaExamCollectionPaths: PathParams = [
  "/api/nesa/exams",
  "/nesa/exams",
];
const nesaExamItemPaths: PathParams = [
  "/api/nesa/exams/:id",
  "/nesa/exams/:id",
];

app.get(
  nesaExamCollectionPaths,
  withErrorBoundary(async (req, res) => {
    // Fetch all NESA exams - they are public/shared across all users
    // Exclude marked attempts and in-progress records (internal tracking only)
    const exams = await prisma.moduleOutput.findMany({
      where: {
        module: ModuleType.NESA_SOFTWARE_EXAM,
        OR: [
          { label: null },
          {
            AND: [
              { label: { not: { contains: "Marked Attempt" } } },
              { label: { not: { contains: "In Progress" } } }
            ]
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const enrichedExams = exams.map(({ user, ...exam }) => {
      const displayName = deriveUserDisplayName(user, exam.createdByName);
      return {
        ...exam,
        createdByName: displayName,
      };
    });

    res.json({ exams: enrichedExams });
  })
);

app.put(
  nesaExamItemPaths,
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const { id } = outputIdParamsSchema.parse(req.params);
    const { label } = outputUpdateSchema.parse(req.body);

    const updated = await prisma.moduleOutput.updateMany({
      where: { id, module: ModuleType.NESA_SOFTWARE_EXAM },
      data: { label },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: "Exam not found." });
      return;
    }

    const exam = await prisma.moduleOutput.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!exam) {
      res.status(404).json({ error: "Exam not found." });
      return;
    }

    const { user, ...rest } = exam;

    res.json({
      exam: {
        ...rest,
        createdByName: deriveUserDisplayName(user, exam.createdByName),
      },
    });
  })
);

app.delete(
  nesaExamItemPaths,
  requireAuth,
  withErrorBoundary(async (req, res) => {
    const normalizedName = req.currentUser?.name?.trim().toLowerCase();
    const normalizedHandle = req.currentUser?.email?.split("@")[0]?.toLowerCase();
    const isEzra = normalizedName === "ezra" || normalizedHandle === "ezra";

    if (!isEzra) {
      res.status(403).json({
        error:
          "Only Focusly administrator Ezra can delete shared exams. Everyone can access generated exams—please contact Ezra for assistance.",
      });
      return;
    }

    const { id } = outputIdParamsSchema.parse(req.params);

    const deleted = await prisma.moduleOutput.deleteMany({
      where: { id, module: ModuleType.NESA_SOFTWARE_EXAM },
    });

    if (deleted.count === 0) {
      res.status(404).json({ error: "Exam not found." });
      return;
    }

    res.json({ success: true });
  })
);

const nesaAttemptsPaths: PathParams = [
  "/api/nesa/attempts",
  "/nesa/attempts",
];

app.get(
  nesaAttemptsPaths,
  requireAuth,
  withErrorBoundary(async (req, res) => {
    // Fetch user's marked attempts only
    if (!req.currentUser?.id) {
      res.json({ attempts: [] });
      return;
    }

    const attempts = await prisma.moduleOutput.findMany({
      where: {
        module: ModuleType.NESA_SOFTWARE_EXAM,
        userId: req.currentUser.id,
        label: { contains: "Marked Attempt" }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ attempts });
  })
);

const nesaAttemptItemPaths: PathParams = [
  "/api/nesa/attempts/:id",
  "/nesa/attempts/:id",
];

app.patch(
  nesaAttemptItemPaths,
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!req.currentUser?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = outputIdParamsSchema.parse(req.params);
    const { selfMarkedScores } = nesaAttemptUpdateSchema.parse(req.body);

    // Find the attempt
    const attempt = await prisma.moduleOutput.findUnique({
      where: { id }
    });

    if (!attempt || attempt.userId !== req.currentUser.id) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }

    // Update the output with self-marked scores
    const currentOutput = attempt.output as any;
    const updatedMarks = (currentOutput.marks || []).map((mark: any) => {
      if (selfMarkedScores[mark.questionId] !== undefined) {
        return { ...mark, selfMarkedScore: selfMarkedScores[mark.questionId] };
      }
      return mark;
    });

    const updatedOutput = {
      ...currentOutput,
      marks: updatedMarks
    };

    await prisma.moduleOutput.update({
      where: { id },
      data: { output: updatedOutput as unknown as Prisma.InputJsonValue }
    });

    res.json({ success: true });
  })
);

const nesaProgressPaths: PathParams = [
  "/api/nesa/progress",
  "/nesa/progress",
];

app.get(
  nesaProgressPaths,
  requireAuth,
  withErrorBoundary(async (req, res) => {
    // Fetch user's in-progress exams
    if (!req.currentUser?.id) {
      res.json({ progress: [] });
      return;
    }

    const progress = await prisma.moduleOutput.findMany({
      where: {
        module: ModuleType.NESA_SOFTWARE_EXAM,
        userId: req.currentUser.id,
        label: { contains: "In Progress" }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ progress });
  })
);

const nesaSaveProgressSchema = z.object({
  examId: z.string(),
  examTitle: z.string(),
  userAnswers: z.record(z.string(), z.string()),
  currentQuestionIndex: z.number(),
});

app.post(
  nesaProgressPaths,
  requireAuth,
  withErrorBoundary(async (req, res) => {
    if (!req.currentUser?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = nesaSaveProgressSchema.parse(req.body);

    // Find existing progress or create new
    const existingProgress = await prisma.moduleOutput.findFirst({
      where: {
        module: ModuleType.NESA_SOFTWARE_EXAM,
        userId: req.currentUser.id,
        label: `In Progress - ${payload.examTitle}`
      }
    });

    const progressData = {
      examId: payload.examId,
      examTitle: payload.examTitle,
      userAnswers: payload.userAnswers,
      currentQuestionIndex: payload.currentQuestionIndex,
      lastSaved: Date.now(),
    };

    if (existingProgress) {
      await prisma.moduleOutput.update({
        where: { id: existingProgress.id },
        data: {
          output: progressData as unknown as Prisma.InputJsonValue,
        }
      });
    } else {
      await prisma.moduleOutput.create({
        data: {
          module: ModuleType.NESA_SOFTWARE_EXAM,
          userId: req.currentUser.id,
          label: `In Progress - ${payload.examTitle}`,
          subject: "Software Engineering",
          input: { examId: payload.examId } as unknown as Prisma.InputJsonValue,
          output: progressData as unknown as Prisma.InputJsonValue,
        }
      });
    }

    res.json({ success: true });
  })
);

const nesaMarkingPaths: PathParams = [
  "/api/nesa/mark",
  "/nesa/mark",
];

app.post(
  nesaMarkingPaths,
  requireAuth,
  aiLimiter,
  withErrorBoundary(async (req, res) => {
    const payload = nesaMarkingRequestSchema.parse(req.body);

    // Create a map of user answers for easy lookup
    const answerMap = new Map(
      payload.userAnswers.map(ua => [ua.questionId, ua.answer])
    );

    // Mark each question
    const marks: Array<{
      questionId: string;
      questionNumber: number;
      userAnswer: string;
      correctAnswer?: string;
      explanation?: string;
      modelAnswer?: string;
      exampleCode?: string;
      diagramDescription?: string;
      markBreakdown: Array<{
        criterion: string;
        marksAwarded: number;
        maxMarks: number;
        feedback: string;
      }>;
      totalMarks: number;
      maxMarks: number;
      feedback: string;
    }> = [];

    for (const question of payload.questions) {
      const userAnswer = answerMap.get(question.id) || "";

      // Skip diagram questions - these are self-marking
      if (question.codeLanguage === "diagram") {
        marks.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          userAnswer,
          ...(question.expectedOutput && { diagramDescription: question.expectedOutput }),
          markBreakdown: [],
          totalMarks: 0, // Self-marking - user will assign marks
          maxMarks: question.marks,
          feedback: "This is a self-marking question. Review your diagram against the expected output and assess your own work.",
        });
        continue;
      }

      // Skip unanswered questions
      if (!userAnswer.trim()) {
        marks.push({
          questionId: question.id,
          questionNumber: question.questionNumber,
          userAnswer: "",
          markBreakdown: [],
          totalMarks: 0,
          maxMarks: question.marks,
          feedback: "Question not attempted.",
        });
        continue;
      }

      let markingPrompt = "";

      // Different marking strategies based on question type
      if (question.type === "mcq") {
        markingPrompt = `You are marking a multiple choice question from a NSW HSC Software Engineering exam.

Question: ${question.prompt}

Options:
${question.options?.map(opt => `${opt.label}. ${opt.value}`).join("\n")}

Student's answer: ${userAnswer}
Correct answer: ${question.sampleAnswer}

Provide marking in this JSON format with explanations for ALL options:
{
  "correctAnswer": "${question.sampleAnswer}",
  "explanation": {
${question.options?.map(opt => `    "${opt.label}": "${opt.label === question.sampleAnswer ? 'CORRECT' : 'INCORRECT'} - Explanation of why this is ${opt.label === question.sampleAnswer ? 'correct' : 'incorrect'}"`).join(",\n")}
  },
  "totalMarks": ${question.marks} if student chose ${question.sampleAnswer}, otherwise 0,
  "maxMarks": ${question.marks},
  "feedback": "Clear feedback summarizing the student's choice"
}

IMPORTANT: Explain WHY each option is correct or incorrect.`;
      } else if (question.type === "matching") {
        // Parse the JSON answer for matching questions
        let parsedMatches: Record<string, string> = {};
        try {
          parsedMatches = JSON.parse(userAnswer);
        } catch {
          parsedMatches = {};
        }

        markingPrompt = `You are marking a matching question from a NSW HSC Software Engineering exam.

Question: ${question.prompt}

Correct matching pairs:
${question.matchingPairs?.map((pair, idx) => `${idx + 1}. ${pair.left} → ${pair.right}`).join("\n")}

Student's matches: ${JSON.stringify(parsedMatches)}

Marking criteria: ${question.markingCriteria?.join(", ")}

Provide marking in this JSON format with detailed match-by-match feedback:
{
  "matchResults": [
    ${question.matchingPairs?.map(pair => `{
      "left": "${pair.left}",
      "correctRight": "${pair.right}",
      "userRight": "<what user matched ${pair.left} to, or null if not matched>",
      "isCorrect": boolean,
      "feedback": "Brief explanation why this is correct/incorrect"
    }`).join(",\n    ")}
  ],
  "markBreakdown": [
    {
      "criterion": "Match accuracy",
      "marksAwarded": number,
      "maxMarks": ${question.marks},
      "feedback": "Overall feedback on matching performance"
    }
  ],
  "totalMarks": number,
  "maxMarks": ${question.marks},
  "feedback": "Overall feedback"
}`;
      } else if (question.type === "short-answer" || question.type === "extended") {
        markingPrompt = `You are marking a ${question.type} question from a NSW HSC Software Engineering exam. You must be EXTREMELY STRICT and RIGOROUS - this is a formal HSC assessment.

Question: ${question.prompt}

Student's answer:
${userAnswer}

Sample/Model answer:
${question.sampleAnswer || "Use your expertise to assess the answer"}

Marking criteria:
${question.markingCriteria?.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Marks available: ${question.marks}

🚨 CRITICAL MARKING RULES - YOU MUST FOLLOW THESE EXACTLY:

STEP 1: DETECT GIBBERISH (CHECK THIS FIRST!)
Before awarding ANY marks, you MUST check if the answer is gibberish:
- Random keystrokes: "asdfghjkl", "jfkdlsajfkldsa", "qwertyuiop", "zxcvbnm"
- Repetitive patterns: "aaaaaaaa", "123456789", "asdasdasd", "testtest"
- No coherent words: "fjdksla jfkdlsa jfklds"
- No technical content: answers that don't mention any software engineering concepts

EXAMPLES OF ANSWERS THAT GET ZERO MARKS:
❌ "asdfjkl;asdfjkl;asdfjkl;"
❌ "jfkdlsajfkldsjafkldsjafkldsjaklfds"
❌ "qwertyqwertyqwerty"
❌ "123456789 asdfghjkl"
❌ "test test test test"
❌ "aaaaaaaaaaaaaaaaa"
❌ Any answer with less than 3 recognizable English words
❌ Any answer without at least one software engineering term

IF THE ANSWER IS GIBBERISH: Set ALL marksAwarded to 0 and totalMarks to 0.

STEP 2: AWARD MARKS ONLY IF (ALL must be true):
- The answer contains coherent, grammatically correct sentences
- Software engineering terminology is used correctly
- The response directly addresses the question
- Technical claims are supported with explanations
- The answer shows logical reasoning

PARTIAL MARKS:
- Only if SOME marking criteria are met with accurate technical content
- Each mark needs a specific, correct technical statement to justify it
- Generic statements without depth = ZERO marks

EXTENDED RESPONSE SPECIFIC (${question.type === "extended" ? "THIS QUESTION" : "if applicable"}):
- Requires synthesis of multiple concepts with depth
- Surface-level answers get 0-2 marks maximum
- 3-5 marks only for good understanding with examples
- 6+ marks only for exceptional, comprehensive analysis

⚠️ IMPORTANT: If you're unsure whether an answer is gibberish, IT IS GIBBERISH. Mark it 0.
⚠️ IMPORTANT: When in doubt between two mark levels, ALWAYS choose the LOWER mark.
⚠️ IMPORTANT: Real NESA markers are very strict. You should be too.

Provide marking in this JSON format:
{
  "modelAnswer": "A comprehensive model answer showing what a full-marks response should include",
  "markBreakdown": [
    {
      "criterion": "criterion name",
      "marksAwarded": number (BE STRICT - 0 for nonsense),
      "maxMarks": number,
      "feedback": "specific feedback for this criterion"
    }
  ],
  "totalMarks": number (sum of marksAwarded),
  "maxMarks": ${question.marks},
  "feedback": "Overall constructive feedback highlighting strengths and areas for improvement"
}`;
      } else if (question.type === "code") {
        if (question.codeLanguage === "python") {
          markingPrompt = `You are marking a Python programming question from a NSW HSC Software Engineering exam. Be STRICT - only award marks for correct, functional code.

Question: ${question.prompt}

Expected output/behavior:
${question.expectedOutput || "Assess code quality and correctness"}

Student's code:
\`\`\`python
${userAnswer}
\`\`\`

Sample solution:
${question.sampleAnswer || "Provide your expert solution"}

Marking criteria:
${question.markingCriteria?.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Marks available: ${question.marks}

STRICT MARKING RULES:
- Award 0 marks if the code is gibberish, random keystrokes, or not valid Python
- Award 0 marks if the code would not run or has major syntax errors
- Only award marks if the code actually addresses the question requirements
- Check for correct logic, not just correct syntax
- This is a formal HSC exam - be rigorous

Provide marking in this JSON format:
{
  "exampleCode": "A well-commented example solution showing best practices",
  "markBreakdown": [
    {
      "criterion": "criterion name (e.g., Correctness, Code structure, Edge cases)",
      "marksAwarded": number (0 for nonsense/broken code),
      "maxMarks": number,
      "feedback": "specific feedback"
    }
  ],
  "totalMarks": number,
  "maxMarks": ${question.marks},
  "feedback": "Overall feedback on code quality, correctness, and suggestions for improvement"
}`;
        } else if (question.codeLanguage === "sql") {
          markingPrompt = `You are marking an SQL query question from a NSW HSC Software Engineering exam. Be STRICT - only award marks for correct, functional SQL.

Question: ${question.prompt}

Sample data:
${question.sqlSampleData?.map(table => `
Table: ${table.tableName}
Columns: ${table.columns.join(", ")}
Sample rows: ${table.rows.length} rows provided
`).join("\n")}

Expected output:
${question.expectedOutput || "Assess query correctness"}

Student's query:
\`\`\`sql
${userAnswer}
\`\`\`

Sample solution:
${question.sampleAnswer || "Provide your expert solution"}

Marking criteria:
${question.markingCriteria?.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Marks available: ${question.marks}

STRICT MARKING RULES:
- Award 0 marks if the query is gibberish, random keystrokes, or not valid SQL
- Award 0 marks if the query has syntax errors or would not execute
- Only award marks if the query actually addresses the question requirements
- Check that the query would produce the expected output
- This is a formal HSC exam - be rigorous

Provide marking in this JSON format:
{
  "exampleCode": "A clear example SQL query with explanation",
  "markBreakdown": [
    {
      "criterion": "criterion name (e.g., Correct syntax, Proper joins, Accurate results)",
      "marksAwarded": number (0 for nonsense/broken SQL),
      "maxMarks": number,
      "feedback": "specific feedback"
    }
  ],
  "totalMarks": number,
  "maxMarks": ${question.marks},
  "feedback": "Overall feedback on query structure and optimization suggestions"
}`;
        } else if (question.codeLanguage === "diagram") {
          // For diagram questions, the answer is a JSON stringified array of shapes
          markingPrompt = `You are marking a diagram question from a NSW HSC Software Engineering exam.

Question: ${question.prompt}

Expected diagram description:
${question.expectedOutput || "Assess diagram completeness and correctness"}

Student has submitted a diagram (technical drawing data provided).

Marking criteria:
${question.markingCriteria?.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Marks available: ${question.marks}

Note: The student's answer is in a technical format. Assess based on whether a diagram was attempted and provide constructive feedback.

Provide marking in this JSON format:
{
  "diagramDescription": "A detailed description of what an ideal diagram should include (e.g., 'Structure chart showing main module at top with hierarchical connections to 3 sub-modules: Input, Process, Output. Each connection labeled with data flow.')",
  "markBreakdown": [
    {
      "criterion": "criterion name (e.g., Correct symbols, Proper hierarchy, Clear labels)",
      "marksAwarded": number,
      "maxMarks": number,
      "feedback": "specific feedback"
    }
  ],
  "totalMarks": number,
  "maxMarks": ${question.marks},
  "feedback": "Overall feedback on diagram structure and suggestions. Note: Award partial marks for attempting the diagram."
}`;
        }
      }

      // Call OpenAI to mark the question
      const markingResult = await runChatCompletion<{
        correctAnswer?: string;
        explanation?: string;
        modelAnswer?: string;
        exampleCode?: string;
        diagramDescription?: string;
        markBreakdown?: Array<{
          criterion: string;
          marksAwarded: number;
          maxMarks: number;
          feedback: string;
        }>;
        totalMarks: number;
        maxMarks: number;
        feedback: string;
      }>({
        messages: [
          {
            role: "system",
            content: "You are an expert HSC Software Engineering marker for NESA NSW. You follow official marking guidelines strictly and provide fair, accurate assessment. You award full marks to excellent answers with correct technical content. You detect and reject gibberish/keyboard mashing with zero marks. For genuine attempts with partial understanding, you award marks proportionally based on what is correct. You provide constructive feedback that helps students improve.",
          },
          {
            role: "user",
            content: markingPrompt,
          },
        ],
        responseFormat: "json",
      });

      // Validate: Check if answer is gibberish and override AI if necessary
      let finalTotalMarks = markingResult.totalMarks;
      let finalMarkBreakdown = markingResult.markBreakdown || [];
      let finalFeedback = markingResult.feedback;

      // Gibberish detection patterns
      const isGibberish = (text: string): boolean => {
        const cleanText = text.toLowerCase().trim();

        // Check for empty or very short
        if (cleanText.length < 10) return false; // Too short to judge

        // Check for repetitive patterns (same char repeated)
        if (/(.)\1{7,}/.test(cleanText)) return true; // 8+ same chars in a row

        // Check for keyboard mashing patterns
        const gibberishPatterns = [
          /asdf/gi, /qwer/gi, /zxcv/gi, /hjkl/gi, /yuio/gi,
          /jfkdl/gi, /fjdks/gi, /lkjfd/gi, /dfjkl/gi
        ];
        const matchCount = gibberishPatterns.filter(p => p.test(cleanText)).length;
        if (matchCount >= 2) return true; // Multiple keyboard patterns

        // Check for low word/non-word ratio
        const words = cleanText.split(/\s+/);
        const recognizableWords = words.filter(word => {
          // Simple check: does it have vowels and consonants?
          return word.length >= 3 && /[aeiou]/.test(word) && /[bcdfghjklmnpqrstvwxyz]/.test(word);
        });

        if (words.length >= 5 && recognizableWords.length / words.length < 0.3) {
          return true; // Less than 30% recognizable words
        }

        return false;
      };

      // Override if gibberish detected but AI gave marks
      if ((question.type === "short-answer" || question.type === "extended") &&
          userAnswer &&
          isGibberish(userAnswer) &&
          markingResult.totalMarks > 0) {

        console.warn(`[GIBBERISH DETECTED] Question ${question.id}: AI gave ${markingResult.totalMarks} marks, overriding to 0`);

        finalTotalMarks = 0;
        finalMarkBreakdown = (markingResult.markBreakdown || []).map(criterion => ({
          ...criterion,
          marksAwarded: 0,
          feedback: "Answer contains gibberish or keyboard mashing - no marks awarded."
        }));
        finalFeedback = "This answer appears to contain random characters or keyboard mashing rather than a genuine attempt. No marks can be awarded for nonsensical responses. Please provide a proper answer with technical content.";
      }

      // Build the mark object
      const mark: typeof marks[0] = {
        questionId: question.id,
        questionNumber: question.questionNumber,
        userAnswer,
        ...(markingResult.correctAnswer !== undefined && { correctAnswer: markingResult.correctAnswer }),
        ...(markingResult.explanation !== undefined && { explanation: markingResult.explanation }),
        ...(markingResult.modelAnswer !== undefined && { modelAnswer: markingResult.modelAnswer }),
        ...(markingResult.exampleCode !== undefined && { exampleCode: markingResult.exampleCode }),
        ...(markingResult.diagramDescription !== undefined && { diagramDescription: markingResult.diagramDescription }),
        markBreakdown: finalMarkBreakdown,
        totalMarks: finalTotalMarks,
        maxMarks: markingResult.maxMarks,
        feedback: finalFeedback,
      };

      marks.push(mark);
    }

    // Calculate overall score
    const totalScore = marks.reduce((sum, m) => sum + m.totalMarks, 0);
    const totalPossible = marks.reduce((sum, m) => sum + m.maxMarks, 0);
    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

    const markedAttempt = {
      examId: `attempt-${Date.now()}`,
      examRecordId: payload.examRecordId, // Link to the original exam record
      examTitle: payload.examTitle,
      questions: payload.questions,
      marks,
      totalScore,
      totalPossible,
      percentage,
      completedAt: Date.now(),
    };

    // Save the marked attempt to the database
    const savedRecord = await persistModuleOutput({
      module: ModuleType.NESA_SOFTWARE_EXAM,
      subject: "Software Engineering",
      label: `${payload.examTitle} - Marked Attempt (${percentage}%)`,
      input: payload as unknown as JsonValue,
      output: markedAttempt as unknown as JsonValue,
      userId: req.currentUser?.id ?? null,
    });

    // Delete the progress record since the exam is now marked
    if (req.currentUser?.id && payload.examRecordId) {
      // Delete progress by matching the examId field (which is the exam record ID)
      const progressRecords = await prisma.moduleOutput.findMany({
        where: {
          module: ModuleType.NESA_SOFTWARE_EXAM,
          userId: req.currentUser.id,
          label: { contains: "In Progress" }
        }
      });

      // Filter to find progress records that match this exam's record ID
      const matchingProgress = progressRecords.filter(record => {
        const output = record.output as { examId?: string };
        return output.examId === payload.examRecordId;
      });

      // Delete the matching progress records
      if (matchingProgress.length > 0) {
        await prisma.moduleOutput.deleteMany({
          where: {
            id: { in: matchingProgress.map(p => p.id) }
          }
        });
      }
    }

    res.json({ ...markedAttempt, savedRecordId: savedRecord?.id });
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

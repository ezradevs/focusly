# Focusly - Project Context for Claude Code

## Project Overview
Focusly is a full-stack AI study companion app for students. It provides 7 AI-powered learning modules for note summarization, quiz generation, flashcards, exam prep, revision planning, and language practice.

## Tech Stack
- **Frontend**: Next.js 15.5.5, React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Express 5, TypeScript, Prisma ORM, OpenAI API (gpt-4o-mini)
- **Database**: PostgreSQL on Supabase
- **Deployment**: Vercel (both frontend and backend as serverless functions)
- **Auth**: JWT with HTTP-only cookies

## Architecture

### Project Structure
```
/frontend          - Next.js app
  /src/app         - App Router pages
  /src/components  - React components
    /modules       - 7 learning module components
  /src/lib         - Utilities (api.ts, utils.ts)
  /src/store       - Zustand state stores
  /src/types       - TypeScript types
  /public          - Static assets (includes pdf-worker/)

/backend           - Express API
  /src/server.ts   - Main API routes (1100+ lines)
  /src/lib         - Database and utilities
  /src/services    - OpenAI integration
  /prisma          - Database schema
  /api/index.js    - Vercel serverless entry point
```

### Learning Modules (7 total)
1. **Notes Summariser** - PDF/text upload, AI summarization
2. **Question Generator** - MCQ, short answer, extended response
3. **Quiz Mode** - Interactive quizzes with feedback
4. **Flashcard Maker** - Basic, cloze, image-occlusion cards
5. **Exam Creator** - Extended response questions with band 6 samples
6. **Revision Planner** - Week-by-week study schedules
7. **Language Practice** - 5 modes: vocabulary, grammar, conversation (with live chat), writing, translation

### Key Files
- `backend/src/server.ts` - All API endpoints (auth, modules, outputs)
- `frontend/src/lib/api.ts` - API client methods
- `backend/prisma/schema.prisma` - Database schema
- `frontend/src/constants/modules.ts` - Module metadata and mapping
- `frontend/src/types/index.ts` - TypeScript type definitions

## Common Commands

### Frontend (from /frontend)
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production (checks types)
```

### Backend (from /backend)
```bash
npm run dev          # Start dev server (localhost:4000)
npx prisma generate  # Regenerate Prisma client after schema changes
```

## Development Workflow

### Adding a New Module
1. **Update Database Schema**
   - Add new enum value to `ModuleType` in `backend/prisma/schema.prisma`
   - Create SQL migration file (e.g., `add-new-module.sql`)
   - Run SQL in Supabase SQL Editor: `ALTER TYPE "ModuleType" ADD VALUE 'NEW_MODULE';`
   - Run `npx prisma generate` in backend

2. **Add Backend API Route**
   - Add Zod schemas in `backend/src/server.ts`
   - Add `app.post()` route with AI completion logic
   - Use `persistModuleOutput()` to save results

3. **Add Frontend API Method**
   - Add method to `focuslyApi` object in `frontend/src/lib/api.ts`

4. **Create Frontend Component**
   - Create in `frontend/src/components/modules/your-module.tsx`
   - Use form with Zod validation
   - Call API method and display results
   - Add to workspace switch in `frontend/src/app/workspace/page.tsx`

5. **Update Constants**
   - Add to `ModuleId` type in `frontend/src/constants/modules.ts`
   - Add to `MODULES` array with icon and colors
   - Add to `MODULE_TYPE_MAP` with StoredModuleType mapping
   - Update `StoredModuleType` in `frontend/src/types/index.ts`

6. **Test**
   - Build backend and frontend to check for errors
   - Test locally with both servers running

7. **Commit** (see below)

### Git Commit Preferences
**🚨 CRITICAL: NEVER execute git commits using `git commit` command!**

**ONLY provide commit MESSAGES for Ezra to use manually.**

After completing a feature or significant change:
- ✅ DO: Provide a well-formatted commit message
- ❌ DON'T: Run `git add`, `git commit`, `git push`, or any git commands
- ✅ DO: Stage changes with `git status` to show what will be committed
- ❌ DON'T: Actually commit - Ezra will do this manually


## Database (Supabase PostgreSQL)

### Schema
```prisma
enum ModuleType {
  NOTES_SUMMARY
  QUESTION_SET
  QUIZ_SESSION
  FLASHCARD_DECK
  EXAM_PACK
  REVISION_PLAN
  LANGUAGE_PRACTICE
}

model User {
  id           String         @id @default(cuid())
  email        String         @unique
  passwordHash String
  name         String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  outputs      ModuleOutput[]
}

model ModuleOutput {
  id        String     @id @default(cuid())
  module    ModuleType
  subject   String?
  label     String?
  input     Json
  output    Json
  createdAt DateTime   @default(now())
  userId    String?
  user      User?      @relation(fields: [userId], references: [id])
}
```

### Connection String
```
postgresql://postgres.xxx:password@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Migrations
**IMPORTANT**: Prisma migrations don't work with Supabase. Use manual SQL instead:

1. Create `.sql` file with migration
2. Open Supabase → SQL Editor → New Query
3. Paste and run SQL
4. Run `npx prisma generate` in backend

Example:
```sql
ALTER TYPE "ModuleType" ADD VALUE 'NEW_MODULE';
```

## Important Notes & Gotchas

### Backend (Serverless)
- ❌ DO NOT use `app.listen()` in production - it's wrapped in `if (process.env.NODE_ENV !== 'production')`
- ✅ Export `app` as default for Vercel: `export default app;`
- ✅ CORS allows all `*.vercel.app` domains dynamically
- ✅ Cookies use `sameSite: "none"` in production for cross-domain auth
- ✅ Database init only runs in development, not production

### Frontend
- ✅ PDF upload uses `pdfjs-dist` with worker in `public/pdf-worker/`
- ✅ API base URL from `NEXT_PUBLIC_API_BASE_URL` env var
- ✅ All API calls use `credentials: "include"` for cookie auth
- ⚠️ Notes file upload accepts: `.txt`, `.md`, `.json`, `.pdf`

### Environment Variables

**Backend (.env)**
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://...
JWT_SECRET=super-secret-change-me
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

**Vercel (Backend)**
- Same as backend .env above
- NODE_ENV=production (automatic)

**Vercel (Frontend)**
```
NEXT_PUBLIC_API_BASE_URL=https://focusly-backend-kappa.vercel.app
```

## Deployment

### Process
1. Push to GitHub main branch
2. Vercel automatically deploys both projects
3. Frontend: https://focusly-eosin.vercel.app
4. Backend: https://focusly-backend-kappa.vercel.app

### Build Configuration
- Backend: Uses `scripts/copy-server.js` to copy `dist/` to `api/dist/`
- Frontend: Standard Next.js build
- Both projects have separate Vercel deployments

## Code Style Preferences

### TypeScript
- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- Use `unknown` instead of `any`
- Explicit return types on functions

### React
- Functional components only
- Use hooks (useState, useCallback, useMemo, useEffect)
- Framer Motion for animations
- Zustand for global state

### UI
- Tailwind CSS for all styling
- shadcn/ui components (Button, Card, Input, etc.)
- Toast notifications with `sonner`
- Loading states with spinners
- Error handling with try/catch and error messages


## Testing
- Build both frontend and backend to check for TypeScript errors
- Test locally with both servers running
- Check dev tools console for errors
- Test authentication flow
- Verify database persistence

## GitHub Repository
- **Owner**: ezradevs
- **Repo**: focusly
- **Main Branch**: main
- URL: https://github.com/ezradevs/focusly

## User Information
- **Developer**: Ezra (ezradevs)
- **Project Stage**: MVP complete, adding features
- **Target Users**: Students (high school, university)

## Current Status
✅ Full authentication system (signup, login, JWT)
✅ Email verification with Resend (24-hour expiry)
✅ Password reset flow (1-hour token expiry)
✅ Welcome emails sent after verification
✅ Module access control (blocks unverified users)
✅ 8 learning modules functional (including NESA Software Engineering Exam)
✅ Database persistence with Supabase
✅ Both frontend and backend deployed on Vercel
✅ PDF upload support for notes
✅ Interactive language conversation mode
✅ Responsive UI with dark mode support
✅ Custom domain: focusly.one (frontend) + api.focusly.one (backend)
✅ Email domain: noreply@focusly.one

## Known Issues / TODO
- Rate limiting not implemented
- Pomodoro timer notifications require permission
- No "resend verification email" endpoint (users must use original email)

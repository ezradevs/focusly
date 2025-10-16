# Focusly

Focusly is a full-stack study companion that combines a modern Next.js + Tailwind UI with an Express API proxy to the OpenAI platform. It delivers AI-assisted study workflows including note summarisation, question generation, adaptive quiz mode, flashcard creation (basic, cloze, image occlusion), exam-style prompts, and personalised revision planning.

## Project Structure

```
Focusly/
├── frontend/   # Next.js (App Router) + Tailwind + shadcn/ui
└── backend/    # Express server that proxies OpenAI requests
```

## Prerequisites

- Node.js 18+
- npm 9+
- An OpenAI API key with access to the configured model (defaults to `gpt-4o-mini`)

## Environment Variables

### Backend (`backend/.env`)

Copy the example file:

```bash
cp backend/.env.example backend/.env
```

Update the values as needed:

| Variable            | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `OPENAI_API_KEY`    | Required OpenAI API key                                         |
| `OPENAI_MODEL`      | Optional model override (default `gpt-4o-mini`)                 |
| `PORT`              | API port (default `4000`)                                       |
| `CLIENT_ORIGIN`     | Allowed frontend origin(s) for CORS                             |
| `DATABASE_URL`      | PostgreSQL connection string used by Prisma ORM                 |
| `JWT_SECRET`        | Secret used to sign authentication tokens (use a long random string) |

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

This points the UI to the Express proxy.

## Installation

```bash
# install frontend dependencies
cd frontend
npm install

# install backend dependencies
cd ../backend
npm install

# generate Prisma client
npx prisma generate
```

### Database Setup

By default the backend uses a local SQLite file (`file:./dev.db`). No external services are required.

The first time you run the backend it creates `backend/dev.db` automatically. If you ever want to reset the database, simply delete that file while the server is stopped and restart `npm run dev`.

If you prefer PostgreSQL (e.g., for deployment), update `DATABASE_URL` accordingly and run:

```bash
cd backend
npx prisma migrate deploy
```

## Local Development

Run the backend (Express) in one terminal:

```bash
cd backend
npm run dev
```

Run the frontend (Next.js) in another terminal:

```bash
cd frontend
npm run dev
```

The app will be served at <http://localhost:3000>, and all API calls are routed through <http://localhost:4000>.

## Production Builds

```bash
# frontend
cd frontend
npm run build

# backend
cd ../backend
npm run build
```

The frontend build output is ready for Vercel deployment (`npm run build` uses Turbopack). The backend build place compiled files in `backend/dist/` and can be deployed to any Node-compatible host (Vercel functions, Fly.io, Render, etc.).

## Deploying on Vercel

1. Deploy `frontend/` as a Vercel project (framework: Next.js). Configure `NEXT_PUBLIC_API_BASE_URL` to point to your backend deployment.
2. Deploy `backend/` as a separate Vercel project (framework: Node.js / Serverless). Expose the `/api/*` endpoints and set the environment variables from `.env.example`.

## Feature Highlights

- **Accounts & Saved Workspace** – Secure email/password auth with HTTP-only cookies and Prisma persistence. Every module output is stored automatically for authenticated users and can be managed via the Saved Workspace drawer.
- **Tutor Chatbot** – Persistent Focusly Tutor icon offers a context-aware chat experience on every screen.
- **Notes Summariser** – Generates summaries, key points, definitions, and follow-up suggestions. Supports direct paste and file upload.
- **Question Generator** – Creates MCQ, short-answer, and extended questions with optional marking guides.
- **Quiz Mode** – Runs adaptive quizzes with saved history, feedback via OpenAI, and basic analytics.
- **Flashcard Maker** – Builds decks in localStorage, with interactive image occlusion editor and export-ready data.
- **Exam-Style Creator** – Produces rigorous extended-response prompts, exemplar answers, and evaluation of student submissions.
- **Revision Planner** – Generates weekly and daily revision schedules with success tips.
- **UI Experience** – Built with shadcn/ui components, Tailwind theming, dark mode, Framer Motion animations, markdown rendering, and lucide-react icons.
- **Persistence** – Leveraging Zustand + localStorage for preferences, quiz history, and flashcard decks.

## Testing & Quality

- `npm run lint` inside `frontend` (ESLint with TypeScript support)
- `npm run build` completes TypeScript checking for both `frontend` and `backend`

## Folder Notes

- `frontend/src/components/modules/` contains the major module UI implementations.
- `frontend/src/store/` defines Zustand stores for persistent state.
- `backend/src/` exposes REST endpoints under `/api/*` that wrap OpenAI calls using robust Zod validation.

## Next Steps

- Add auth/user accounts if multi-user support is needed.
- Connect to a database for persistent storage beyond localStorage.
- Expand automated testing (Playwright / Vitest) for core workflows.

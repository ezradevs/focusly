import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = ["OPENAI_API_KEY"] as const;

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
export const OPENAI_MODEL =
  process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const PORT = Number(process.env.PORT ?? 4000);
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

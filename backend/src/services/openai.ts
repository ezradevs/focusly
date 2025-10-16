import OpenAI from "openai";
import { OPENAI_API_KEY, OPENAI_MODEL } from "../config";

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

type Message =
  | {
      role: "system" | "user" | "assistant";
      content: string;
    }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "input_text"; text: string }
      >;
    };

interface ChatOptions {
  messages: Message[];
  responseFormat?: "json" | "text";
  temperature?: number;
  maxTokens?: number;
}

export async function runChatCompletion<T = unknown>({
  messages,
  responseFormat = "json",
  temperature = 0.3,
  maxTokens,
}: ChatOptions): Promise<T> {
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature,
    max_tokens: typeof maxTokens === "number" ? maxTokens : null,
    messages: messages.map((message) => {
      if (Array.isArray((message as any).content)) {
        return {
          ...message,
          content: (message as any).content.map((part: any) =>
            part.type === "input_text"
              ? { type: "text", text: part.text }
              : part
          ),
        };
      }
      return message as any;
    }),
    ...(responseFormat === "json"
      ? { response_format: { type: "json_object" as const } }
      : {}),
  });

  const choice = response.choices[0]?.message?.content ?? "{}";
  if (responseFormat === "json") {
    return JSON.parse(choice) as T;
  }
  return choice as T;
}

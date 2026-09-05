import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

const deepSeekResponseSchema = z.object({
  choices: z.array(
    z.object({
      finish_reason: z.string(),
      message: z.object({ content: z.string().nullable() }),
    }),
  ).min(1),
});

export type DeepSeekErrorDetails = {
  kind: "configuration" | "http" | "response";
  finishReason?: string;
  providerCode?: string;
  providerMessage?: string;
  providerType?: string;
  status?: number;
  statusText?: string;
};

export class DeepSeekError extends Error {
  readonly details: DeepSeekErrorDetails;

  constructor(message: string, details: DeepSeekErrorDetails) {
    super(message);
    this.name = "DeepSeekError";
    this.details = details;
  }
}

export async function callDeepSeekJson<T>(args: {
  maxTokens?: number;
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL;

  if (!apiKey || !model) {
    throw new DeepSeekError("DeepSeek is not configured", {
      kind: "configuration",
    });
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: args.maxTokens ?? 1200,
      stream: false,
    }),
  });

  if (!response.ok) {
    const providerError = await readProviderError(response);
    throw new DeepSeekError(`DeepSeek request failed: ${response.status}`, {
      kind: "http",
      status: response.status,
      statusText: response.statusText,
      ...providerError,
    });
  }

  const envelope = deepSeekResponseSchema.parse(await response.json());
  const choice = envelope.choices[0];

  if (choice.finish_reason === "length") {
    throw new DeepSeekError("DeepSeek response was truncated", {
      kind: "response",
      finishReason: choice.finish_reason,
    });
  }

  const content = choice.message.content?.trim();

  if (!content) {
    throw new DeepSeekError("DeepSeek returned empty content", {
      kind: "response",
      finishReason: choice.finish_reason,
    });
  }

  return args.schema.parse(JSON.parse(content));
}

async function readProviderError(response: Response) {
  const text = await response.text();

  try {
    const body: unknown = JSON.parse(text);
    if (!isRecord(body) || !isRecord(body.error)) return {};

    return {
      providerCode: toOptionalString(body.error.code),
      providerMessage: toOptionalString(body.error.message),
      providerType: toOptionalString(body.error.type),
    };
  } catch {
    return {
      providerMessage: text.trim().slice(0, 500) || undefined,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return undefined;
}

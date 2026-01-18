import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmProvider } from "../config";

type LlmRole = "system" | "user" | "assistant";

interface BaseRequest {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}


const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.3;
const ANTHROPIC_VERSION = "2023-06-01";

function buildPrompt(system: string | undefined, prompt: string): string {
  if (!system) return prompt;
  return `${system}\n\n${prompt}`;
}

function buildMessages(system: string | undefined, prompt: string): Array<{ role: LlmRole; content: string }> {
  const messages: Array<{ role: LlmRole; content: string }> = [];
  if (system) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOpenAiMessageContent(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const choices = data.choices;
  if (!Array.isArray(choices)) return undefined;
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return undefined;
  const message = firstChoice.message;
  if (!isRecord(message)) return undefined;
  const content = message.content;
  return typeof content === "string" ? content : undefined;
}

function getOpenAiDeltaContent(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const choices = data.choices;
  if (!Array.isArray(choices)) return undefined;
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return undefined;
  const delta = firstChoice.delta;
  if (!isRecord(delta)) return undefined;
  const content = delta.content;
  return typeof content === "string" ? content : undefined;
}

function getAnthropicContentText(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const content = data.content;
  if (!Array.isArray(content)) return undefined;
  const first = content[0];
  if (!isRecord(first)) return undefined;
  const text = first.text;
  return typeof text === "string" ? text : undefined;
}

function getAnthropicDeltaText(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  if (data.type !== "content_block_delta") return undefined;
  const delta = data.delta;
  if (!isRecord(delta)) return undefined;
  if (delta.type !== "text_delta") return undefined;
  const text = delta.text;
  return typeof text === "string" ? text : undefined;
}

async function parseErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return response.statusText || "Unknown error";
  }

  try {
    const data: unknown = JSON.parse(text);
    if (isRecord(data)) {
      const error = data.error;
      if (isRecord(error) && typeof error.message === "string") {
        return error.message;
      }
    }
  } catch {
    return text;
  }

  return text;
}

function extractJsonString(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1];
  }

  const startIndex = text.search(/[\[{]/);
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let startChar: "{" | "[" | null = null;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      if (depth === 0) {
        startChar = char;
      }
      depth += 1;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0 && startChar) {
        return text.slice(startIndex, i + 1);
      }
      if (depth < 0) {
        break;
      }
    }
  }

  return null;
}

export function parseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty JSON response");
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return parsed;
  } catch {
    const extracted = extractJsonString(trimmed);
    if (!extracted) {
      throw new Error("Failed to parse JSON from response");
    }

    const normalized = extracted.replace(/,\s*([}\]])/g, "$1").trim();
    try {
      const parsed: unknown = JSON.parse(normalized);
      return parsed;
    } catch {
      throw new Error("Failed to parse JSON from response");
    }
  }
}

async function* readSseDataLines(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response body not available");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) {
        continue;
      }
      yield trimmed.slice(5).trim();
    }
  }

  const remaining = buffer.trim();
  if (remaining.startsWith("data:")) {
    yield remaining.slice(5).trim();
  }
}

async function generateGeminiText(input: BaseRequest): Promise<string> {
  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({ model: input.model });
  const prompt = buildPrompt(input.system, input.prompt);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function* streamGeminiText(input: BaseRequest): AsyncGenerator<string> {
  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({ model: input.model });
  const prompt = buildPrompt(input.system, input.prompt);
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

async function generateGeminiJson(input: BaseRequest): Promise<unknown> {
  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({
    model: input.model,
    generationConfig: {
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      responseMimeType: "application/json",
    },
  });
  const prompt = buildPrompt(input.system, input.prompt);
  const result = await model.generateContent(prompt);
  return parseJson(result.response.text());
}

async function generateOpenAiText(input: BaseRequest): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: buildMessages(input.system, input.prompt),
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: unknown = await response.json();
  const content = getOpenAiMessageContent(data);
  if (!content) {
    throw new Error("OpenAI response missing content");
  }
  return content;
}

async function* streamOpenAiText(input: BaseRequest): AsyncGenerator<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: buildMessages(input.system, input.prompt),
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  for await (const line of readSseDataLines(response)) {
    if (line === "[DONE]") {
      break;
    }
    const parsed: unknown = JSON.parse(line);
    const content = getOpenAiDeltaContent(parsed);
    if (content) {
      yield content;
    }
  }
}

async function generateOpenAiJson(input: BaseRequest): Promise<unknown> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: buildMessages(input.system, input.prompt),
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: unknown = await response.json();
  const content = getOpenAiMessageContent(data);
  if (!content) {
    throw new Error("OpenAI response missing JSON content");
  }
  return parseJson(content);
}

async function generateAnthropicText(input: BaseRequest): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: unknown = await response.json();
  const content = getAnthropicContentText(data);
  if (!content) {
    throw new Error("Anthropic response missing content");
  }
  return content;
}

async function* streamAnthropicText(input: BaseRequest): AsyncGenerator<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  for await (const line of readSseDataLines(response)) {
    const parsed: unknown = JSON.parse(line);
    const text = getAnthropicDeltaText(parsed);
    if (text) {
      yield text;
    }
  }
}

async function generateAnthropicJson(input: BaseRequest): Promise<unknown> {
  const system = input.system
    ? `${input.system}\n\nReturn only valid JSON.`
    : "Return only valid JSON.";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: input.temperature ?? DEFAULT_TEMPERATURE,
      system,
      messages: [{ role: "user", content: input.prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: unknown = await response.json();
  const content = getAnthropicContentText(data);
  if (!content) {
    throw new Error("Anthropic response missing JSON content");
  }
  return parseJson(content);
}

export async function generateText(input: BaseRequest): Promise<string> {
  switch (input.provider) {
    case "gemini":
      return generateGeminiText(input);
    case "openai":
      return generateOpenAiText(input);
    case "anthropic":
      return generateAnthropicText(input);
  }
}

export async function* streamText(input: BaseRequest): AsyncGenerator<string> {
  switch (input.provider) {
    case "gemini":
      yield* streamGeminiText(input);
      return;
    case "openai":
      yield* streamOpenAiText(input);
      return;
    case "anthropic":
      yield* streamAnthropicText(input);
      return;
  }
}

export async function generateJson(input: BaseRequest): Promise<unknown> {
  switch (input.provider) {
    case "gemini":
      return generateGeminiJson(input);
    case "openai":
      return generateOpenAiJson(input);
    case "anthropic":
      return generateAnthropicJson(input);
  }
}

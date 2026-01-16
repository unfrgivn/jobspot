import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import TOML from "toml";

function findProjectRoot(): string | null {
  let dir = process.cwd();
  while (dir !== "/") {
    if (existsSync(join(dir, "jobsearch.toml")) || existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

function loadEnvFile() {
  const root = findProjectRoot();
  if (!root) return;
  
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

export type LlmProvider = "gemini" | "openai" | "anthropic";

const LLM_PROVIDER_ENV_VARS: Record<LlmProvider, string[]> = {
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export function getLlmProviderEnvVars(provider: LlmProvider): string[] {
  return LLM_PROVIDER_ENV_VARS[provider];
}

export function getLlmProviderLabel(provider: LlmProvider): string {
  return LLM_PROVIDER_LABELS[provider];
}

export function isLlmProvider(value: string): value is LlmProvider {
  return Object.prototype.hasOwnProperty.call(LLM_PROVIDER_ENV_VARS, value);
}

export function normalizeLlmProvider(value: string): LlmProvider {
  const normalized = value.trim().toLowerCase();
  if (isLlmProvider(normalized)) {
    return normalized;
  }
  throw new Error(`Unsupported LLM provider: ${value}`);
}

export interface Config {
  llm: {
    provider: LlmProvider;
    model: string;
  };
  renderer: {
    latex_engine: string;
  };
  defaults: {
    followup_days: number;
  };
}

export interface Secrets {
  gemini_api_key?: string;
  google_api_key?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  google_calendar_client_id?: string;
  google_calendar_client_secret?: string;
  google_calendar_refresh_token?: string;
}

const DEFAULT_CONFIG: Config = {
  llm: {
    provider: "gemini",
    model: "gemini-2.0-flash",
  },
  renderer: {
    latex_engine: "xelatex",
  },
  defaults: {
    followup_days: 5,
  },
};

export function loadConfig(workspaceRoot: string): Config {
  const configPath = join(workspaceRoot, "jobsearch.toml");
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  
  const content = readFileSync(configPath, "utf-8");
  const parsed = TOML.parse(content);
  const providerValue = parsed.llm?.provider ?? DEFAULT_CONFIG.llm.provider;
  const provider = normalizeLlmProvider(String(providerValue));
  
  return {
    llm: {
      provider,
      model: parsed.llm?.model ?? DEFAULT_CONFIG.llm.model,
    },
    renderer: {
      latex_engine: parsed.renderer?.latex_engine ?? DEFAULT_CONFIG.renderer.latex_engine,
    },
    defaults: {
      followup_days: parsed.defaults?.followup_days ?? DEFAULT_CONFIG.defaults.followup_days,
    },
  };
}

const ENV_VAR_TO_SECRET_KEY: Record<string, keyof Secrets> = {
  GEMINI_API_KEY: "gemini_api_key",
  GOOGLE_API_KEY: "google_api_key",
  OPENAI_API_KEY: "openai_api_key",
  ANTHROPIC_API_KEY: "anthropic_api_key",
};

export function loadSecrets(): Secrets {
  return {
    gemini_api_key: process.env.GEMINI_API_KEY,
    google_api_key: process.env.GOOGLE_API_KEY,
    openai_api_key: process.env.OPENAI_API_KEY,
    anthropic_api_key: process.env.ANTHROPIC_API_KEY,
    google_calendar_client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    google_calendar_client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    google_calendar_refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
  };
}

export function resolveLlmApiKey(
  provider: LlmProvider,
  secrets: Secrets
): { apiKey?: string; envVar?: string } {
  const envVars = LLM_PROVIDER_ENV_VARS[provider];
  for (const envVar of envVars) {
    const secretKey = ENV_VAR_TO_SECRET_KEY[envVar];
    const value = secretKey ? secrets[secretKey] : undefined;
    if (value) {
      return { apiKey: value, envVar };
    }
  }
  return { apiKey: undefined, envVar: envVars[0] };
}

export function requireLlmApiKey(provider: LlmProvider, secrets: Secrets): string {
  const { apiKey } = resolveLlmApiKey(provider, secrets);
  if (apiKey) {
    return apiKey;
  }
  const envVars = getLlmProviderEnvVars(provider).join(" or ");
  throw new Error(`${envVars} not configured`);
}


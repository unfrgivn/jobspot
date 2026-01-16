import {
  getLlmProviderEnvVars,
  getLlmProviderLabel,
  loadConfig,
  loadSecrets,
  resolveLlmApiKey,
} from "../config";
import { findLatexEngine } from "../render/pandoc";
import { getDatabaseUrl, getDb } from "../db";
import { getUserProfile } from "../db/user_profile";
import { getCandidateContext } from "../db/candidate_context";
import { findRoot } from "../workspace";

interface DoctorResult {
  label: string;
  ok: boolean;
}

export async function runDoctor(): Promise<DoctorResult[]> {
  throw new Error("CLI commands are disabled. Use the web UI.");
}

export async function doctor(): Promise<void> {
  console.error("CLI commands are disabled. Use the web UI.");
  process.exit(1);
}

async function checkCommand(cmd: string, arg: string): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, arg], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

function maskDbUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const user = parsed.username ? `${parsed.username}@` : "";
    return `${parsed.protocol}//${user}${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "configured";
  }
}

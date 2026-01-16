import { findRoot, dbPath } from "../workspace";
import {
  getLlmProviderEnvVars,
  getLlmProviderLabel,
  loadConfig,
  loadSecrets,
  resolveLlmApiKey,
} from "../config";
import { findLatexEngine } from "../render/pandoc";
import { getDb } from "../db";
import { getUserProfile } from "../db/user_profile";
import { getCandidateContext } from "../db/candidate_context";

interface DoctorResult {
  label: string;
  ok: boolean;
}

export async function runDoctor(): Promise<DoctorResult[]> {
  const results: DoctorResult[] = [];

  let workspaceRoot: string | null = null;
  try {
    workspaceRoot = findRoot();
    results.push({ label: `Workspace found at ${workspaceRoot}`, ok: true });
  } catch {
    results.push({ label: "No workspace found. Run 'jobsearch init' first.", ok: false });
  }

  const pandocExists = await checkCommand("pandoc", "--version");
  results.push({
    label: pandocExists ? "pandoc is installed" : "pandoc not found. Install with: brew install pandoc",
    ok: pandocExists,
  });

  const latexEngine = await findLatexEngine();
  if (latexEngine) {
    results.push({ label: `LaTeX engine found: ${latexEngine}`, ok: true });
  } else {
    results.push({ label: "No LaTeX engine found. Install MacTeX or TinyTeX.", ok: false });
  }

  if (workspaceRoot) {
    try {
      const config = loadConfig(workspaceRoot);
      const provider = config.llm.provider;
      const providerLabel = getLlmProviderLabel(provider);
      const secrets = loadSecrets();
      const { apiKey } = resolveLlmApiKey(provider, secrets);
      const envVars = getLlmProviderEnvVars(provider).join(" or ");


      if (apiKey) {
        results.push({ label: `${providerLabel} API key configured`, ok: true });
      } else {
        results.push({
          label: `${providerLabel} API key not found. Set ${envVars} in .env`,
          ok: false,
        });
      }
    } catch (error) {
      results.push({
        label: error instanceof Error ? error.message : "Invalid LLM configuration",
        ok: false,
      });
    }

    const db = getDb(dbPath(workspaceRoot));
    const profile = getUserProfile(db);
    
    if (profile) {
      results.push({ label: "User profile exists in database", ok: true });
      
      if (profile.resume_text && profile.resume_text.length > 100) {
        results.push({ label: "Resume uploaded and parsed", ok: true });
      } else {
        results.push({ 
          label: "Resume not uploaded. Go to Settings in web UI to upload.", 
          ok: false 
        });
      }

      const context = getCandidateContext(db, profile.id);
      if (context?.full_context) {
        results.push({ label: "AI context generated", ok: true });
      } else {
        results.push({ 
          label: "AI context not generated. Click 'Generate Context' in Settings.", 
          ok: false 
        });
      }
    } else {
      results.push({ 
        label: "No user profile. Go to Settings in web UI to create one.", 
        ok: false 
      });
    }
  }

  return results;
}

export async function doctor(): Promise<void> {
  console.log("Checking jobsearch workspace...\n");

  const results = await runDoctor();
  let hasErrors = false;

  for (const result of results) {
    const icon = result.ok ? "✓" : "✗";
    console.log(`${icon} ${result.label}`);
    if (!result.ok) hasErrors = true;
  }

  console.log("");
  if (hasErrors) {
    console.log("Some checks failed. Fix the issues above before proceeding.");
    process.exit(1);
  } else {
    console.log("All checks passed!");
  }
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

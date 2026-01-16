import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getDb, runMigrations } from "../db";
import { dbPath, companiesDir, promptsDir, templatesDir } from "../workspace";

export function initWorkspace(): void {
  const cwd = process.cwd();
  const dbFile = dbPath(cwd);

  if (existsSync(dbFile)) {
    return;
  }

  mkdirSync(companiesDir(cwd), { recursive: true });
  mkdirSync(promptsDir(cwd), { recursive: true });
  mkdirSync(join(templatesDir(cwd), "pandoc"), { recursive: true });

  const db = getDb(dbFile);
  runMigrations(db);

  const configPath = join(cwd, "jobsearch.toml");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DEFAULT_CONFIG);
  }

  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) {
    writeFileSync(envPath, DEFAULT_ENV);
  }
}

export async function init(): Promise<void> {
  const cwd = process.cwd();
  const dbFile = dbPath(cwd);

  if (existsSync(dbFile)) {
    console.log(`Workspace already initialized at ${cwd}`);
    return;
  }

  initWorkspace();

  console.log(`Initialized jobsearch workspace at ${cwd}`);
  console.log("Next steps:");
  console.log("  1. Start the server: bun run dev");
  console.log("  2. Open http://localhost:3001/settings");
  console.log("  3. Upload your resume and fill in your profile");
  console.log("  4. Click 'Generate Context' to create your AI profile");
}

const DEFAULT_CONFIG = `[llm]
provider = "gemini"
model = "gemini-2.0-flash"

[renderer]
latex_engine = "xelatex"

[defaults]
followup_days = 5
`;

const DEFAULT_ENV = `# LLM provider API keys
# GEMINI_API_KEY=your-gemini-key
# OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key

# Legacy Gemini key (still supported)
# GOOGLE_API_KEY=your-legacy-google-key

# Google Calendar integration (optional)
# GOOGLE_CALENDAR_CLIENT_ID=your-client-id
# GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
# GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token
`;

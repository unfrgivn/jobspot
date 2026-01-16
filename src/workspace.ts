import { existsSync } from "fs";
import { join, dirname } from "path";

const WORKSPACE_MARKER = "jobsearch.toml";

export function findRoot(startDir?: string): string;
export function findRoot(
  startDir: string | undefined,
  options: { throwOnMissing: false }
): string | null;
export function findRoot(
  startDir?: string,
  options?: { throwOnMissing?: boolean }
): string | null {
  let current = startDir ?? process.cwd();
  const throwOnMissing = options?.throwOnMissing ?? true;
  
  while (true) {
    if (existsSync(join(current, WORKSPACE_MARKER))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      if (throwOnMissing) {
        throw new Error("No jobsearch workspace found. Run `jobsearch init` first.");
      }
      return null;
    }
    current = parent;
  }
}

export function profileDir(root: string): string {
  return join(root, "profile");
}

export function companiesDir(root: string): string {
  return join(root, "companies");
}

export function promptsDir(root: string): string {
  return join(root, "prompts");
}

export function templatesDir(root: string): string {
  return join(root, "templates");
}

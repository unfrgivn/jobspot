import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { findRoot, dbPath } from "../workspace";
import { getDb } from "../db";
import { loadConfig } from "../config";
import { renderPdf } from "../render/pandoc";

export async function renderCoverLetter(applicationId: string): Promise<void> {
  const root = findRoot();
  const db = getDb(dbPath(root));
  const config = loadConfig(root);

  const artifact = db.query<{ path: string }, [string, string]>(
    "SELECT path FROM artifacts WHERE application_id = ? AND kind = ?"
  ).get(applicationId, "cover_letter_md");

  if (!artifact) {
    console.error(`No cover letter markdown found for application: ${applicationId}`);
    process.exit(1);
  }

  if (!existsSync(artifact.path)) {
    console.error(`Markdown file not found: ${artifact.path}`);
    process.exit(1);
  }

  const pdfPath = artifact.path.replace(/\.md$/, ".pdf");

  await renderPdf(artifact.path, pdfPath, config.renderer.latex_engine);

  console.log(`Rendered: ${pdfPath}`);
}

import { existsSync } from "fs";
import { join, dirname } from "path";
import { findRoot } from "../workspace";
import { getDb } from "../db";
import { loadConfig } from "../config";
import { renderPdf } from "../render/pandoc";

export async function renderCoverLetter(applicationId: string): Promise<void> {
  const root = findRoot();
  const db = getDb();
  const config = loadConfig(root);

  const artifactRows = (await db.unsafe(
    "SELECT path FROM artifacts WHERE application_id = $1 AND kind = $2",
    [applicationId, "cover_letter_md"]
  )) as Array<{ path: string }>;
  const artifact = artifactRows[0];

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

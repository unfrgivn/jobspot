import { existsSync } from "fs";

export async function findLatexEngine(): Promise<string | null> {
  const engines = ["xelatex", "pdflatex", "lualatex"];
  const commonPaths = ["/Library/TeX/texbin", "/usr/texbin"];

  for (const engine of engines) {
    const proc = Bun.spawn(["which", engine], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    if (proc.exitCode === 0) return engine;

    for (const path of commonPaths) {
      const fullPath = `${path}/${engine}`;
      if (existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

export async function renderPdf(
  markdownPath: string,
  pdfPath: string,
  latexEngine: string | null
): Promise<boolean> {
  if (!latexEngine) {
    console.warn("No LaTeX engine found, skipping PDF generation");
    return false;
  }

  const proc = Bun.spawn([
    "pandoc",
    markdownPath,
    "-o", pdfPath,
    "--pdf-engine", latexEngine,
    "-V", "geometry:margin=1in",
    "-V", "fontsize=11pt",
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  if (proc.exitCode !== 0) {
    console.error("Pandoc failed:", stderr);
    return false;
  }
  return true;
}

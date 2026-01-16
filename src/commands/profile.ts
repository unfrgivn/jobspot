export async function importProfile(_resumePdfPath: string): Promise<void> {
  console.log("Resume import via CLI is deprecated.");
  console.log("");
  console.log("Please use the web UI to manage your profile:");
  console.log("  1. Start the server: bun run dev");
  console.log("  2. Open http://localhost:3001/settings");
  console.log("  3. Upload your resume in the Profile section");
  console.log("  4. Click 'Generate Context' to create your AI profile");
}

export async function profileImport(resumePdfPath: string): Promise<void> {
  return importProfile(resumePdfPath);
}

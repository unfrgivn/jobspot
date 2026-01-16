import { findRoot, dbPath } from "../workspace";
import { getDb } from "../db";

export async function pasteJd(roleId: string): Promise<void> {
  const root = findRoot();
  const db = getDb(dbPath(root));

  const role = db.query<{ id: string; title: string }, [string]>(
    "SELECT id, title FROM roles WHERE id = ?"
  ).get(roleId);

  if (!role) {
    console.error(`Role not found: ${roleId}`);
    process.exit(1);
  }

  console.log(`Paste job description for "${role.title}" (press Ctrl+D when done):\n`);

  const chunks: string[] = [];
  const reader = Bun.stdin.stream().getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }

  const jdText = chunks.join("").trim();

  if (!jdText) {
    console.error("No input received.");
    process.exit(1);
  }

  db.run("UPDATE roles SET jd_text = ?, updated_at = datetime('now') WHERE id = ?", [jdText, roleId]);

  console.log(`\nSaved job description (${jdText.length} chars) for ${role.title}`);
}

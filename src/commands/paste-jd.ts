import { getDb } from "../db";
import { findRoot } from "../workspace";

export async function pasteJd(roleId: string): Promise<void> {
  findRoot();
  const db = getDb();

  const roleRows = (await db.unsafe(
    "SELECT id, title FROM roles WHERE id = $1",
    [roleId]
  )) as Array<{ id: string; title: string }>;
  const role = roleRows[0];

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

  await db.unsafe("UPDATE roles SET jd_text = $1, updated_at = now()::text WHERE id = $2", [
    jdText,
    roleId,
  ]);

  console.log(`\nSaved job description (${jdText.length} chars) for ${role.title}`);
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(pdfBuffer));
  return result.text.join("\n");
}

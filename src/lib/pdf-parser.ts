import { PDFParse } from "pdf-parse";

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  const result = await parser.getText();
  return result.text || "";
}

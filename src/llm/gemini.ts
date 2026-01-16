import type { LlmProvider } from "../config";
import { generateText, streamText } from "./provider-client";

interface CoverLetterInput {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  jobDescription: string;
  candidateContext: string;
  companyName: string;
  roleTitle: string;
  additionalContext?: string;
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const prompt = buildCoverLetterPromptV2(input);

  return generateText({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    prompt,
  });
}

export async function* generateCoverLetterStream(
  profile: { candidateContext: string; apiKey: string; model: string; provider: LlmProvider },
  role: { title: string; jd_text: string | null; company_name?: string },
  additionalContext?: string
): AsyncGenerator<string> {
  const prompt = buildCoverLetterPromptV2({
    provider: profile.provider,
    apiKey: profile.apiKey,
    model: profile.model,
    jobDescription: role.jd_text ?? "",
    candidateContext: profile.candidateContext,
    companyName: role.company_name ?? "Unknown Company",
    roleTitle: role.title,
    additionalContext,
  });

  yield* streamText({
    provider: profile.provider,
    apiKey: profile.apiKey,
    model: profile.model,
    prompt,
  });
}

function buildCoverLetterPromptV2(input: CoverLetterInput): string {
  const additionalContextSection = input.additionalContext 
    ? `\nADDITIONAL GUIDANCE FROM USER:\n${input.additionalContext}\n`
    : "";

  return `You are writing a cover letter for a senior engineering leadership role (CTO/VP/Director level).

REQUIREMENTS:
- Exactly 2-3 short paragraphs in the body, separated by blank lines
- Professional, punchy, "high agency" tone
- NO fluff, NO generic mission praise, NO "I'm excited to..."
- Lead with a "Command over Craftsmanship" win OR a major financial unlock (cost savings, revenue impact, efficiency gains)
- Include 2-3 quantified metrics from DIFFERENT companies in the candidate's career history
- Draw from the FULL career history (all companies mentioned), not just the most recent role
- Strong, professional call to action at the end
- Sign off with: Sincerely, followed by a blank line, then the candidate's name
${additionalContextSection}
CANDIDATE CONTEXT (AI-synthesized profile):
${input.candidateContext}

TARGET COMPANY: ${input.companyName}
TARGET ROLE: ${input.roleTitle}

JOB DESCRIPTION:
${input.jobDescription}

INSTRUCTIONS:
1. Analyze the job description to identify key requirements and signals (cost, scale, reliability, data, leadership, partnerships, etc.)
2. Review the candidate's ENTIRE career history and select 2-3 quantified wins from DIFFERENT companies that best match the role requirements
3. Write 2-3 tight paragraphs that demonstrate command over the problem space, referencing achievements across multiple prior roles
4. End with a strong CTA and "Sincerely," sign-off

OUTPUT FORMAT:
Return ONLY the cover letter text as markdown. Use blank lines between paragraphs for proper spacing. Format:

Dear [Company] Hiring Team,

[Opening paragraph with quantified win]

[Second paragraph connecting experience to role]

[Optional third paragraph with CTA]

Sincerely,

[Candidate Name]`;
}

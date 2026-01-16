import type { LlmProvider } from "../config";
import { streamText } from "./provider-client";

export interface ResearchInput {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  companyName: string;
  companyWebsite: string | null;
  companyDescription: string | null;
  companyHeadquarters: string | null;
  roleTitle: string;
  jobDescription: string;
  candidateContext: string;
}

export async function* generateCompanyResearch(
  input: ResearchInput
): AsyncGenerator<{ section: string; content: string }> {
  const companyProfile = buildCompanyProfilePrompt(input);
  const interviewQuestions = buildInterviewQuestionsPrompt(input);
  const talkingPoints = buildTalkingPointsPrompt(input);

  let companyProfileContent = "";
  for await (const chunk of streamText({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    prompt: companyProfile,
  })) {
    companyProfileContent += chunk;
  }
  yield { section: "company_profile", content: companyProfileContent };

  const { analyzeFit } = await import("./fit-analysis");
  const fitResult = await analyzeFit(
    input.provider,
    input.apiKey,
    input.model,
    input.candidateContext,
    input.jobDescription
  );
  const fitContent = JSON.stringify(fitResult, null, 2);
  yield { section: "fit_analysis", content: fitContent };

  let interviewQuestionsContent = "";
  for await (const chunk of streamText({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    prompt: interviewQuestions,
  })) {
    interviewQuestionsContent += chunk;
  }
  yield { section: "interview_questions", content: interviewQuestionsContent };

  let talkingPointsContent = "";
  for await (const chunk of streamText({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    prompt: talkingPoints,
  })) {
    talkingPointsContent += chunk;
  }
  yield { section: "talking_points", content: talkingPointsContent };
}

function buildCompanyProfilePrompt(input: ResearchInput): string {
  return `You are a senior executive recruiter researching a company for a CTO/VP/Director candidate.

COMPANY: ${input.companyName}
${input.companyWebsite ? `WEBSITE: ${input.companyWebsite}` : ""}
${input.companyHeadquarters ? `HEADQUARTERS: ${input.companyHeadquarters}` : ""}
${input.companyDescription ? `\nABOUT:\n${input.companyDescription}` : ""}

ROLE: ${input.roleTitle}

JOB DESCRIPTION:
${input.jobDescription}

TASK: Based on the job description and any company information provided, generate a concise company profile covering:

1. **Mission & Product** - What they build and who they serve (2-3 sentences)
2. **Engineering Culture** - Tech stack, engineering values, team structure signals from the JD (2-3 sentences)
3. **Growth Stage** - Signals about company maturity, scale, funding (if inferable from JD language) (1-2 sentences)
4. **Key Challenges** - What engineering problems they're likely solving based on the role requirements (2-3 bullet points)

Keep it factual and grounded in the job description. If you infer something, say "likely" or "appears to be".

OUTPUT: Markdown format, ready to display.`;
}

function buildFitAnalysisPrompt(input: ResearchInput): string {
  return `You are a senior executive coach helping a CTO/VP/Director candidate understand their fit for a role.

${input.candidateContext}

TARGET COMPANY: ${input.companyName}
TARGET ROLE: ${input.roleTitle}

JOB DESCRIPTION:
${input.jobDescription}

TASK: Analyze why this candidate would be a strong fit for this role. Focus on:

1. **Leadership Match** - How their experience level aligns with the role's scope
2. **Technical Alignment** - Relevant technical experiences from their background
3. **Impact Potential** - Specific ways they could deliver value based on past wins
4. **Cultural Signals** - How their leadership style matches what the JD suggests

Be specific - reference actual achievements from the resume and actual requirements from the JD.
Highlight 3-4 strongest connection points with quantified evidence where possible.

OUTPUT: Markdown format with clear sections. Be concise but compelling.`;
}

function buildInterviewQuestionsPrompt(input: ResearchInput): string {
  return `You are a senior executive coach preparing a candidate for interviews.

${input.candidateContext}

TARGET COMPANY: ${input.companyName}
TARGET ROLE: ${input.roleTitle}

JOB DESCRIPTION:
${input.jobDescription}

TASK: Generate 8-10 likely interview questions this candidate should prepare for. Include:

1. **Behavioral Questions** (3-4) - Based on required competencies in the JD
2. **Technical/Domain Questions** (3-4) - Based on technical requirements
3. **Situational Questions** (2-3) - Common scenarios for this role level

For each question, provide:
- The question itself
- Why they'll likely ask it (what they're testing for)
- Key elements to include in a strong answer

OUTPUT: Markdown format. Be specific to THIS role and THIS candidate's background.`;
}

function buildTalkingPointsPrompt(input: ResearchInput): string {
  return `You are a senior executive coach preparing talking points for an interview.

${input.candidateContext}

TARGET COMPANY: ${input.companyName}
TARGET ROLE: ${input.roleTitle}

JOB DESCRIPTION:
${input.jobDescription}

TASK: Create 5-6 powerful talking points the candidate can use in interviews. Each should:
- Connect a specific achievement from their background to a requirement in the JD
- Include quantified impact where possible
- Be concise (1-2 sentences max)
- Demonstrate command over the problem space

Format as:
**[Job Requirement Area]**: [Your specific achievement and impact]

Example:
**Scaling Infrastructure**: "At [Company], led migration to microservices that reduced p99 latency by 60% and cut infrastructure costs by $2M annually while supporting 10x traffic growth."

OUTPUT: Markdown format with 5-6 targeted talking points.`;
}

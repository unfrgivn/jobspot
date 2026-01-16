import type { LlmProvider } from "../config";
import { generateJson } from "./provider-client";

export interface FitAnalysisResult {
  overall_fit_summary: string;
  enjoyment_fit: {
    why_the_candidate_would_enjoy_this_role: string[];
    why_the_company_environment_is_a_good_match: string[];
  };
  qualification_fit: {
    strong_matches: string[];
    partial_matches: string[];
    gaps_or_risks: string[];
  };
  growth_and_trajectory: {
    how_this_role_supports_career_goals: string;
    skills_or_experiences_the_candidate_would_gain: string[];
  };
  confidence_score: {
    overall: number;
    enjoyment: number;
    qualifications: number;
  };
  recommendations: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function analyzeFit(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  candidateContext: string,
  jobDescription: string
): Promise<FitAnalysisResult> {
  const prompt = `You are a career strategy assistant.

Given known context about the candidate, including background, skills, preferences, and career goals, and a job description, analyze the mutual fit between the candidate and the role.

Your goal is to explain:

Why the candidate would enjoy working in this role and at this company

Why the candidate would be a strong match for the role's requirements

Be honest and balanced. If gaps exist, call them out constructively and suggest how they could be addressed. Avoid generic advice and tailor insights directly to the provided context.

Candidate Context:
${candidateContext}

Job Description:
${jobDescription}

Instructions:

Ground all claims in the provided candidate context and job description.

Do not invent experience or qualifications.

Distinguish clearly between interest/motivation fit and skills/experience fit.

Keep insights concise but specific.

Output Format (JSON only):

{
  "overall_fit_summary": "",
  "enjoyment_fit": {
    "why_the_candidate_would_enjoy_this_role": [],
    "why_the_company_environment_is_a_good_match": []
  },
  "qualification_fit": {
    "strong_matches": [],
    "partial_matches": [],
    "gaps_or_risks": []
  },
  "growth_and_trajectory": {
    "how_this_role_supports_career_goals": "",
    "skills_or_experiences_the_candidate_would_gain": []
  },
  "confidence_score": {
    "overall": 0,
    "enjoyment": 0,
    "qualifications": 0
  },
  "recommendations": []
}

Scoring Guidance:

Confidence scores should range from 1–10.

Base scores on evidence strength and alignment, not optimism.

Notes:

strong_matches should map clearly to explicit job requirements.

partial_matches may include adjacent or transferable skills.

gaps_or_risks should be factual, not speculative.

recommendations may include resume framing, interview emphasis, or upskilling suggestions.`;

  try {
    const parsed = await generateJson({
      provider,
      apiKey,
      model,
      prompt,
      temperature: 0.3,
      maxTokens: 2048,
    });

    const parsedRecord = isRecord(parsed) ? parsed : {};
    const enjoymentFit = isRecord(parsedRecord.enjoyment_fit) ? parsedRecord.enjoyment_fit : {};
    const qualificationFit = isRecord(parsedRecord.qualification_fit) ? parsedRecord.qualification_fit : {};
    const growthTrajectory = isRecord(parsedRecord.growth_and_trajectory)
      ? parsedRecord.growth_and_trajectory
      : {};
    const confidence = isRecord(parsedRecord.confidence_score) ? parsedRecord.confidence_score : {};

    return {
      overall_fit_summary: getString(parsedRecord.overall_fit_summary),
      enjoyment_fit: {
        why_the_candidate_would_enjoy_this_role: getStringArray(
          enjoymentFit.why_the_candidate_would_enjoy_this_role
        ),
        why_the_company_environment_is_a_good_match: getStringArray(
          enjoymentFit.why_the_company_environment_is_a_good_match
        ),
      },
      qualification_fit: {
        strong_matches: getStringArray(qualificationFit.strong_matches),
        partial_matches: getStringArray(qualificationFit.partial_matches),
        gaps_or_risks: getStringArray(qualificationFit.gaps_or_risks),
      },
      growth_and_trajectory: {
        how_this_role_supports_career_goals: getString(growthTrajectory.how_this_role_supports_career_goals),
        skills_or_experiences_the_candidate_would_gain: getStringArray(
          growthTrajectory.skills_or_experiences_the_candidate_would_gain
        ),
      },
      confidence_score: {
        overall: getNumber(confidence.overall),
        enjoyment: getNumber(confidence.enjoyment),
        qualifications: getNumber(confidence.qualifications),
      },
      recommendations: getStringArray(parsedRecord.recommendations),
    };
  } catch (error) {
    console.error("Error analyzing fit:", error);
    return {
      overall_fit_summary: "Unable to analyze fit at this time.",
      enjoyment_fit: {
        why_the_candidate_would_enjoy_this_role: [],
        why_the_company_environment_is_a_good_match: [],
      },
      qualification_fit: {
        strong_matches: [],
        partial_matches: [],
        gaps_or_risks: [],
      },
      growth_and_trajectory: {
        how_this_role_supports_career_goals: "",
        skills_or_experiences_the_candidate_would_gain: [],
      },
      confidence_score: {
        overall: 0,
        enjoyment: 0,
        qualifications: 0,
      },
      recommendations: [],
    };
  }
}

import type { LlmProvider } from "../config";
import { generateJson } from "./provider-client";

export interface CompanyResearchResult {
  company_name: string;
  website: string | null;
  industry: {
    primary: string | null;
    secondary: string[];
  };
  funding_status: {
    type: string | null;
    last_known_round: string | null;
    last_known_round_year: number | null;
  };
  company_size: {
    employees_estimate: string | null;
    source: string | null;
  };
  established_date: string | null;
  headquarters: {
    city: string | null;
    state_province: string | null;
    country: string | null;
  };
  description: string | null;
  sources: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function researchCompany(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  companyName: string
): Promise<CompanyResearchResult | null> {
  const prompt = `You are a business research assistant.

Given a company name, perform basic research using reliable public sources to identify high-confidence information about the company. If information is not publicly available or cannot be verified, return null for that field rather than guessing.

Return the results in the structured JSON format defined below and include a short factual summary of what the company does.

Company Name: ${companyName}

Instructions:

Prefer the company's official website and reputable business directories (e.g., Crunchbase, LinkedIn, Wikipedia, SEC filings when applicable).

Keep descriptions concise and factual.

Do not speculate.

Normalize data where possible (e.g., employee count as an estimated range).

Output Format (JSON only):

{
  "company_name": "",
  "website": "",
  "industry": {
    "primary": "",
    "secondary": []
  },
  "funding_status": {
    "type": "",
    "last_known_round": "",
    "last_known_round_year": null
  },
  "company_size": {
    "employees_estimate": "",
    "source": ""
  },
  "established_date": "",
  "headquarters": {
    "city": "",
    "state_province": "",
    "country": ""
  },
  "description": "",
  "sources": []
}

Notes:

industry.primary should be the most commonly cited industry label (e.g., "SaaS", "FinTech", "Healthcare").

industry.secondary may include related or adjacent industries if applicable.

funding_status.type examples: "Bootstrapped", "Private", "Venture-backed", "Public", "Subsidiary".

last_known_round examples: "Seed", "Series A", "Series B", "IPO".

established_date should be in ISO format (YYYY or YYYY-MM-DD) when possible.

sources should be a list of URLs used to verify the information.`;

  try {
    const parsed = await generateJson({
      provider,
      apiKey,
      model,
      prompt,
      temperature: 0.3,
      maxTokens: 2048,
    });

    if (!isRecord(parsed)) {
      return null;
    }

    const industry = isRecord(parsed.industry) ? parsed.industry : {};
    const funding = isRecord(parsed.funding_status) ? parsed.funding_status : {};
    const size = isRecord(parsed.company_size) ? parsed.company_size : {};
    const headquarters = isRecord(parsed.headquarters) ? parsed.headquarters : {};

    return {
      company_name: getNullableString(parsed.company_name) ?? "",
      website: getNullableString(parsed.website),
      industry: {
        primary: getNullableString(industry.primary),
        secondary: getStringArray(industry.secondary),
      },
      funding_status: {
        type: getNullableString(funding.type),
        last_known_round: getNullableString(funding.last_known_round),
        last_known_round_year: getNullableNumber(funding.last_known_round_year),
      },
      company_size: {
        employees_estimate: getNullableString(size.employees_estimate),
        source: getNullableString(size.source),
      },
      established_date: getNullableString(parsed.established_date),
      headquarters: {
        city: getNullableString(headquarters.city),
        state_province: getNullableString(headquarters.state_province),
        country: getNullableString(headquarters.country),
      },
      description: getNullableString(parsed.description),
      sources: getStringArray(parsed.sources),
    };
  } catch (error) {
    console.error("Error researching company:", error);
    return null;
  }
}

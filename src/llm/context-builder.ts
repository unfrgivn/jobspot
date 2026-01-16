import type { UserProfile } from "../db/user_profile";
import type { LlmProvider } from "../config";
import { generateJson } from "./provider-client";

interface ScrapedLinkedInData {
  headline: string | null;
  summary: string | null;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  skills: string[];
  recommendations: string[];
}

interface ScrapedPortfolioData {
  projects: Array<{
    title: string;
    description: string;
    technologies: string[];
  }>;
  content: string;
}

interface ContextSources {
  profile: UserProfile;
  linkedinData: ScrapedLinkedInData | null;
  portfolioData: ScrapedPortfolioData | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function scrapeLinkedInProfile(linkedinUrl: string): Promise<ScrapedLinkedInData | null> {
  try {
    const response = await fetch(linkedinUrl);
    const html = await response.text();
    
    const headline = html.match(/<h2[^>]*class="[^"]*top-card-layout__headline[^"]*"[^>]*>(.*?)<\/h2>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || null;
    
    const summaryMatch = html.match(/<section[^>]*class="[^"]*summary[^"]*"[^>]*>(.*?)<\/section>/s);
    const summary = summaryMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || null;
    
    const experienceMatches = Array.from(html.matchAll(/<li[^>]*class="[^"]*experience-item[^"]*"[^>]*>(.*?)<\/li>/gs));
    const experience = experienceMatches.map(match => {
      const content = match[1] || '';
      const title = content.match(/<h3[^>]*>(.*?)<\/h3>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      const company = content.match(/<h4[^>]*>(.*?)<\/h4>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      const duration = content.match(/<time[^>]*>(.*?)<\/time>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      const description = content.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/p>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      
      return { title, company, duration, description };
    });
    
    const skillsMatches = Array.from(html.matchAll(/<span[^>]*class="[^"]*skill-name[^"]*"[^>]*>(.*?)<\/span>/gs));
    const skills = skillsMatches.map(m => m[1]?.replace(/<[^>]+>/g, '').trim()).filter(Boolean) as string[];
    
    return {
      headline,
      summary,
      experience: experience.filter(e => e.title || e.company),
      skills,
      recommendations: []
    };
  } catch (error) {
    console.error('Failed to scrape LinkedIn:', error);
    return null;
  }
}

export async function scrapePortfolioSite(portfolioUrl: string): Promise<ScrapedPortfolioData | null> {
  try {
    const response = await fetch(portfolioUrl);
    const html = await response.text();
    
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const projectMatches = Array.from(html.matchAll(/<(article|div)[^>]*class="[^"]*project[^"]*"[^>]*>(.*?)<\/\1>/gs));
    const projects = projectMatches.map(match => {
      const content = match[2] || '';
      const title = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      const description = content.match(/<p[^>]*>(.*?)<\/p>/s)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      
      const techMatches = Array.from(content.matchAll(/\b(React|TypeScript|JavaScript|Python|Go|Rust|AWS|Docker|Kubernetes|Node\.js|Next\.js|Vue|Angular|GraphQL|REST|PostgreSQL|MongoDB|Redis|Tailwind|CSS|HTML)\b/gi));
      const technologies = [...new Set(techMatches.map(m => m[0]))];
      
      return { title, description, technologies };
    }).filter(p => p.title || p.description);
    
    return {
      projects,
      content: textContent.slice(0, 10000)
    };
  } catch (error) {
    console.error('Failed to scrape portfolio:', error);
    return null;
  }
}

export async function buildCandidateContext(
  sources: ContextSources,
  input: { provider: LlmProvider; apiKey: string; model: string }
): Promise<{
  executive_summary: string;
  key_strengths: string;
  leadership_narrative: string;
  technical_expertise: string;
  impact_highlights: string;
  career_trajectory: string;
  full_context: string;
}> {
  const { profile, linkedinData, portfolioData } = sources;
  
  const experienceData: unknown = profile.experience_json 
    ? JSON.parse(profile.experience_json) 
    : null;
  
  const prompt = `You are a career narrative expert. Synthesize the following information about a candidate into a comprehensive professional profile.

PROFILE DATA:
Name: ${profile.full_name || 'Not provided'}
Email: ${profile.email || 'Not provided'}
Phone: ${profile.phone || 'Not provided'}
LinkedIn: ${profile.linkedin_url || 'Not provided'}
Portfolio: ${profile.portfolio_url || 'Not provided'}

CAREER NARRATIVE:
About Me: ${profile.about_me || 'Not provided'}
Why Looking: ${profile.why_looking || 'Not provided'}
Building Teams: ${profile.building_teams || 'Not provided'}
AI Shift: ${profile.ai_shift || 'Not provided'}

RESUME:
${profile.resume_text || 'Not provided'}

${experienceData ? `STRUCTURED EXPERIENCE:
${JSON.stringify(experienceData, null, 2)}` : ''}

${linkedinData ? `LINKEDIN DATA:
Headline: ${linkedinData.headline || 'Not available'}
Summary: ${linkedinData.summary || 'Not available'}
Experience: ${linkedinData.experience.length} positions listed
Skills: ${linkedinData.skills.join(', ') || 'Not available'}` : ''}

${portfolioData ? `PORTFOLIO DATA:
Projects: ${portfolioData.projects.length} projects showcased
Portfolio Content: ${portfolioData.content.slice(0, 2000)}...` : ''}

TASK:
Create a comprehensive candidate profile with these sections:

1. EXECUTIVE_SUMMARY: 2-3 paragraphs capturing who they are professionally, their unique value proposition, and what makes them stand out.

2. KEY_STRENGTHS: List 5-7 core strengths with specific evidence from their background. Format as bullet points.

3. LEADERSHIP_NARRATIVE: 2 paragraphs on their leadership philosophy, team-building approach, and management style (if applicable).

4. TECHNICAL_EXPERTISE: Detailed breakdown of technical skills, technologies, frameworks, and domains of expertise. Be specific.

5. IMPACT_HIGHLIGHTS: 5-7 quantified achievements and major career wins. Format as bullet points with metrics when available.

6. CAREER_TRAJECTORY: 2 paragraphs explaining their career arc, growth pattern, and where they're headed.

Respond ONLY with valid JSON in this exact format:
{
  "executive_summary": "...",
  "key_strengths": "...",
  "leadership_narrative": "...",
  "technical_expertise": "...",
  "impact_highlights": "...",
  "career_trajectory": "..."
}`;

  const synthesized = await generateJson({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    prompt,
    temperature: 0.7,
    maxTokens: 4096,
  });
  
  const synthesizedRecord = isRecord(synthesized) ? synthesized : {};

  const ensureString = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.map(v => `• ${v}`).join('\n');
    if (val && typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val ?? '');
  };
  
  const full_context = `CANDIDATE PROFILE: ${profile.full_name || 'Candidate'}

EXECUTIVE SUMMARY:
${ensureString(synthesizedRecord.executive_summary)}

KEY STRENGTHS:
${ensureString(synthesizedRecord.key_strengths)}

LEADERSHIP NARRATIVE:
${ensureString(synthesizedRecord.leadership_narrative)}

TECHNICAL EXPERTISE:
${ensureString(synthesizedRecord.technical_expertise)}

IMPACT HIGHLIGHTS:
${ensureString(synthesizedRecord.impact_highlights)}

CAREER TRAJECTORY:
${ensureString(synthesizedRecord.career_trajectory)}

CONTACT:
Email: ${profile.email || 'Not provided'}
Phone: ${profile.phone || 'Not provided'}
LinkedIn: ${profile.linkedin_url || 'Not provided'}
Portfolio: ${profile.portfolio_url || 'Not provided'}`;

  return {
    executive_summary: ensureString(synthesizedRecord.executive_summary),
    key_strengths: ensureString(synthesizedRecord.key_strengths),
    leadership_narrative: ensureString(synthesizedRecord.leadership_narrative),
    technical_expertise: ensureString(synthesizedRecord.technical_expertise),
    impact_highlights: ensureString(synthesizedRecord.impact_highlights),
    career_trajectory: ensureString(synthesizedRecord.career_trajectory),
    full_context
  };
}

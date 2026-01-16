import { randomUUID } from "crypto";
import { findRoot, dbPath } from "../workspace";
import { getDb } from "../db";
import { loadConfig, loadSecrets, resolveLlmApiKey } from "../config";
import * as cheerio from "cheerio";

export interface AddRoleOptions {
  url?: string;
  company?: string;
  title?: string;
  location?: string;
  compensation_range?: string;
}

export interface AddRoleResult {
  roleId: string;
  company: string;
  title: string;
  hasJd: boolean;
}

export async function addRole(opts: AddRoleOptions): Promise<AddRoleResult> {
  const root = findRoot();
  const db = getDb(dbPath(root));

  let companyName = opts.company;
  let jobTitle = opts.title;
  let jobUrl = opts.url;
  let jdText: string | null = null;
  let location: string | null = opts.location ?? null;
  let compensationRange: string | null = opts.compensation_range ?? null;
  let compensationMin: number | null = null;
  let compensationMax: number | null = null;
  let companyWebsite: string | null = null;
  let companyHeadquarters: string | null = null;
  let companyLogoUrl: string | null = null;
  let companyDescription: string | null = null;

  if (opts.url) {
    const scraped = await scrapeJobPosting(opts.url);

    if (scraped) {
      companyName = companyName ?? scraped.company;
      jobTitle = jobTitle ?? scraped.title;
      jdText = scraped.description;
      companyDescription = scraped.companyDescription ?? null;
      location = location ?? scraped.location ?? null;
      compensationRange = compensationRange ?? scraped.compensation ?? null;
      compensationMin = scraped.compensationMin ?? null;
      compensationMax = scraped.compensationMax ?? null;
      companyWebsite = scraped.companyWebsite ?? null;
      companyHeadquarters = scraped.companyHeadquarters ?? null;
      companyLogoUrl = scraped.companyLogoUrl ?? null;
    }
  }

  if (!companyName) {
    throw new Error("Company name required. Use --company or provide a scrapeable --url");
  }

  if (!jobTitle) {
    throw new Error("Job title required. Use --title or provide a scrapeable --url");
  }

  let companyRow = db
    .query<{ id: string }, [string]>("SELECT id FROM companies WHERE name = ?")
    .get(companyName);

  if (!companyRow) {
    const companyId = randomUUID();
    db.run(
      "INSERT INTO companies (id, name, website, headquarters, logo_url, description) VALUES (?, ?, ?, ?, ?, ?)",
      [companyId, companyName, companyWebsite, companyHeadquarters, companyLogoUrl, companyDescription]
    );
    companyRow = { id: companyId };
  } else if (companyWebsite || companyHeadquarters || companyLogoUrl || companyDescription) {
    db.run(
      "UPDATE companies SET website = COALESCE(?, website), headquarters = COALESCE(?, headquarters), logo_url = COALESCE(?, logo_url), description = COALESCE(?, description), updated_at = datetime('now') WHERE id = ?",
      [companyWebsite, companyHeadquarters, companyLogoUrl, companyDescription, companyRow.id]
    );
  }

  const existingRole = db
    .query<{ id: string }, [string | null]>("SELECT id FROM roles WHERE job_url = ?")
    .get(jobUrl ?? null);
  
  if (existingRole) {
    const error = new Error("Role already added") as Error & { existingRoleId?: string };
    error.existingRoleId = existingRole.id;
    throw error;
  }

  const duplicateByTitle = db
    .query<{ id: string }, [string, string]>(
      "SELECT id FROM roles WHERE company_id = ? AND title = ?"
    )
    .get(companyRow.id, jobTitle);
  
  if (duplicateByTitle) {
    const error = new Error("Role already added") as Error & { existingRoleId?: string };
    error.existingRoleId = duplicateByTitle.id;
    throw error;
  }

  const roleId = randomUUID();
  db.run(
    `INSERT INTO roles (id, company_id, title, job_url, jd_text, location, compensation_range, compensation_min, compensation_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [roleId, companyRow.id, jobTitle, jobUrl ?? null, jdText, location, compensationRange, compensationMin, compensationMax]
  );

  const applicationId = randomUUID();
  db.run(`INSERT INTO applications (id, role_id, status) VALUES (?, ?, 'wishlist')`, [
    applicationId,
    roleId,
  ]);

  if (jdText) {
    try {
      const config = loadConfig(root);
      const provider = config.llm.provider;
      const secrets = loadSecrets();
      const { apiKey } = resolveLlmApiKey(provider, secrets);

      if (apiKey) {
        const { generateRoleResearch } = await import("./research");
        await generateRoleResearch(roleId);
        
        const { researchCompany } = await import("../llm/company-research");
        const { updateCompany } = await import("../db/companies");
        const result = await researchCompany(provider, apiKey, config.llm.model, companyName);
        if (result) {
          const fundingStatus = result.funding_status.type 
            ? JSON.stringify(result.funding_status)
            : null;
          const industry = result.industry.primary
            ? JSON.stringify(result.industry)
            : null;
          const companySize = result.company_size.employees_estimate
            ? JSON.stringify(result.company_size)
            : null;
          
          updateCompany(db, companyRow.id, {
            website: result.website || undefined,
            headquarters: result.headquarters.city && result.headquarters.country 
              ? `${result.headquarters.city}, ${result.headquarters.state_province || ''} ${result.headquarters.country}`.trim()
              : undefined,
            description: result.description || undefined,
            industry: industry || undefined,
            funding_status: fundingStatus || undefined,
            company_size: companySize || undefined,
            established_date: result.established_date || undefined,
            research_sources: result.sources.length > 0 ? JSON.stringify(result.sources) : undefined
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate research during add:", error);
    }
  }

  return {
    roleId,
    company: companyName,
    title: jobTitle,
    hasJd: !!jdText,
  };
}

export async function add(opts: AddRoleOptions): Promise<void> {
  try {
    const result = await addRole(opts);
    console.log(`Added role: ${result.title} at ${result.company}`);
    console.log(`Role ID: ${result.roleId}`);

    if (!result.hasJd) {
      console.log(`\nNo job description yet. Run: jobsearch paste-jd ${result.roleId}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function refreshRole(roleId: string): Promise<{
  updated: boolean;
  message: string;
  researchGenerated?: boolean;
}> {
  const root = findRoot();
  const db = getDb(dbPath(root));

  const role = db
    .query<{ id: string; job_url: string | null; company_id: string }, [string]>(
      "SELECT id, job_url, company_id FROM roles WHERE id = ?"
    )
    .get(roleId);

  if (!role) {
    throw new Error("Role not found");
  }

  if (!role.job_url) {
    return { updated: false, message: "No job URL to refresh from" };
  }

  const scraped = await scrapeJobPosting(role.job_url);
  if (!scraped) {
    return { updated: false, message: "Failed to scrape job posting" };
  }

  db.run(
    `UPDATE roles SET 
      title = COALESCE(?, title),
      jd_text = COALESCE(?, jd_text),
      location = COALESCE(?, location),
      compensation_range = COALESCE(?, compensation_range),
      compensation_min = COALESCE(?, compensation_min),
      compensation_max = COALESCE(?, compensation_max),
      updated_at = datetime('now')
    WHERE id = ?`,
    [scraped.title || null, scraped.description || null, scraped.location || null, scraped.compensation || null, scraped.compensationMin || null, scraped.compensationMax || null, roleId]
  );

  if (scraped.companyWebsite || scraped.companyHeadquarters || scraped.companyLogoUrl || scraped.companyDescription) {
    db.run(
      `UPDATE companies SET 
        website = COALESCE(?, website),
        headquarters = COALESCE(?, headquarters),
        logo_url = COALESCE(?, logo_url),
        description = COALESCE(?, description),
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        scraped.companyWebsite || null,
        scraped.companyHeadquarters || null,
        scraped.companyLogoUrl || null,
        scraped.companyDescription || null,
        role.company_id,
      ]
    );
  }

  let researchGenerated = false;
  try {
    const config = loadConfig(root);
    const provider = config.llm.provider;
    const secrets = loadSecrets();
    const { apiKey } = resolveLlmApiKey(provider, secrets);

    if (apiKey && scraped.description) {
      const { generateRoleResearch } = await import("./research");
      await generateRoleResearch(roleId);
      researchGenerated = true;
    }
  } catch (error) {
    console.error("Failed to generate research during refresh:", error);
  }

  return { 
    updated: true, 
    message: "Role and company data refreshed", 
    researchGenerated 
  };
}

interface ScrapedJob {
  company?: string;
  title?: string;
  description: string;
  location?: string;
  compensation?: string;
  compensationMin?: number;
  compensationMax?: number;
  companyWebsite?: string;
  companyHeadquarters?: string;
  companyLogoUrl?: string;
  companyDescription?: string;
}

async function scrapeJobPosting(url: string): Promise<ScrapedJob | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let title = "";
    let company = "";
    let description = "";
    let location = "";
    let compensation = "";
    let compensationMin: number | undefined;
    let compensationMax: number | undefined;
    let companyWebsite = "";
    let companyHeadquarters = "";
    let companyLogoUrl = "";

    const jsonLdScript = $('script[type="application/ld+json"]').html();
    const isLinkedIn = url.includes("linkedin.com");
    
    if (jsonLdScript) {
      try {
        const jsonLd = JSON.parse(jsonLdScript);
        if (jsonLd["@type"] === "JobPosting") {
          title = jsonLd.title || "";
          company = jsonLd.hiringOrganization?.name || "";
          description = jsonLd.description || "";
          
          if (jsonLd.jobLocation) {
            const jobLoc = jsonLd.jobLocation;
            if (jobLoc.address) {
              const addr = jobLoc.address;
              location = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
                .filter(Boolean)
                .join(", ");
            } else if (typeof jobLoc === "string") {
              location = jobLoc;
            }
          }
          
          if (jsonLd.baseSalary?.value) {
            const { minValue, maxValue } = jsonLd.baseSalary.value;
            compensationMin = minValue;
            compensationMax = maxValue;
            
            const formatNum = (n: number) => {
              if (n >= 1000) return `${Math.floor(n / 1000)}K`;
              return n.toString();
            };
            compensation = `$${formatNum(minValue)} - $${formatNum(maxValue)}`;
          }
          
          if (jsonLd.hiringOrganization) {
            const org = jsonLd.hiringOrganization;
            companyWebsite = org.url || org.sameAs || "";
            companyLogoUrl = org.logo || "";
            
            if (org.address) {
              const addr = org.address;
              companyHeadquarters = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
                .filter(Boolean)
                .join(", ");
            }
          }
        }
      } catch {
        // JSON-LD parsing failed, continue with HTML scraping
      }
    }

    $("script, style, nav, header, footer").remove();

    if (isLinkedIn && (!compensationMin || !compensationMax)) {
      const salaryText = $('body').text();
      const salaryMatch = salaryText.match(/\$(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/yr)?\s*-\s*\$(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/yr)?/);
      if (salaryMatch && salaryMatch[1] && salaryMatch[2]) {
        const parseAmount = (str: string) => parseFloat(str.replace(/,/g, ''));
        
        compensationMin = parseAmount(salaryMatch[1]);
        compensationMax = parseAmount(salaryMatch[2]);
        
        const formatNum = (n: number) => {
          if (n >= 1000) return `$${Math.floor(n / 1000)}K`;
          return `$${n}`;
        };
        compensation = `${formatNum(compensationMin)} - ${formatNum(compensationMax)}`;
      }
    }

    if (!title) {
      // Special handling for LinkedIn - parse the title from og:title
      if (isLinkedIn) {
        const ogTitle = $('meta[property="og:title"]').attr("content") || "";
        // LinkedIn format: "CompanyName hiring JobTitle | CompanyName in Location | LinkedIn"
        // or: "JobTitle - CompanyName | LinkedIn"
        if (ogTitle) {
          // Try pattern 1: "CompanyName hiring JobTitle in Location | ..." or "CompanyName hiring JobTitle | ..."
          let match = ogTitle.match(/hiring (.+?)(?: in .+?)? \|/);
          if (match && match[1]) {
            title = match[1].trim();
          } else {
            // Try pattern 2: "JobTitle - CompanyName | LinkedIn"
            match = ogTitle.match(/^(.+?) - .+ \| LinkedIn$/);
            if (match && match[1]) {
              title = match[1].trim();
            } else {
              // Fallback: just remove " | LinkedIn" suffix and everything after first " | "
              const parts = ogTitle.split(" | ");
              if (parts.length > 0 && parts[0]) {
                title = parts[0].trim();
              }
            }
          }
        }
      }
      
      // If still no title, try other methods
      if (!title) {
        title =
          $('meta[property="og:title"]').attr("content") ||
          $(".top-card-layout__title").text().trim() ||
          $("h1").first().text().trim() ||
          $("title").text().trim() ||
          "";
      }
    }

    if (!company) {
      company =
        $(".topcard__org-name-link").text().trim() ||
        $(".topcard__flavor--black-link").text().trim() ||
        $('meta[property="og:site_name"]').attr("content") ||
        $('[data-testid="company-name"]').text().trim() ||
        $('[class*="company"]').first().text().trim() ||
        $('[itemprop="hiringOrganization"] [itemprop="name"]').text().trim() ||
        "";
    }
    
    if (!location) {
      location =
        $(".topcard__flavor--bullet").text().trim() ||
        $('[class*="location"]').first().text().trim() ||
        $('[itemprop="jobLocation"]').text().trim() ||
        $('[data-testid="location"]').text().trim() ||
        "";
      
      location = location
        .replace(/\s*Over\s+\d+\s+applicants?.*/i, "")
        .replace(/\s*\d+\s+applicants?.*/i, "")
        .trim();
    }
    
    if (!companyLogoUrl) {
      const companyLogoFromDelayedUrl = company 
        ? $(`img[alt="${company}"]`).first().attr("data-delayed-url") ||
          $(`img[alt*="${company}"]`).first().attr("data-delayed-url")
        : null;
      
      companyLogoUrl =
        companyLogoFromDelayedUrl ||
        $('img[data-delayed-url*="company-logo"]').first().attr("data-delayed-url") ||
        $(".artdeco-entity-image").attr("src") ||
        $('meta[property="og:image"]').attr("content") ||
        $('link[rel="icon"]').attr("href") ||
        $('img[alt*="logo" i]').attr("src") ||
        "";
    }

    if (!description) {
      const descriptionEl = $(".show-more-less-html__markup").first();
      if (descriptionEl.length) {
        descriptionEl.find("br").replaceWith("\n");
        descriptionEl.find("p").append("\n\n");
        descriptionEl.find("div").append("\n");
        descriptionEl.find("li").prepend("• ").append("\n");
        descriptionEl.find("h1, h2, h3, h4, h5, h6, strong").before("\n").after("\n");
        descriptionEl.find("ul, ol").before("\n").after("\n");
        description = descriptionEl.text();
      } else {
        const fallbackEl = $(".description__text, main, article, body").first();
        fallbackEl.find("br").replaceWith("\n");
        fallbackEl.find("p").append("\n\n");
        fallbackEl.find("div").append("\n");
        fallbackEl.find("li").prepend("• ").append("\n");
        fallbackEl.find("h1, h2, h3, h4, h5, h6, strong").before("\n").after("\n");
        description = fallbackEl.text();
      }
    }

    const metaDescription = $('meta[name="description"]').attr("content");
    if (metaDescription && (!description || description.length < 100)) {
      description = metaDescription;
    }

    const cleanDescription = description
      .replace(/<[^>]*>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\.?\s*(About the Role)[:\s]/gi, "\n\n## About the Role\n\n")
      .replace(/\.?\s*(What [Yy]ou'?ll [Dd]o)[:\s]/gi, "\n\n## What You'll Do\n\n")
      .replace(/\.?\s*(How to be successful in this role)[:\s]/gi, "\n\n## How To Be Successful\n\n")
      .replace(/\.?\s*(Key Responsibilities)[:\s]/gi, "\n\n## Key Responsibilities\n\n")
      .replace(/\.?\s*(What [Ww]e [Oo]ffer)[:\s]/gi, "\n\n## What We Offer\n\n")
      .replace(/\.?\s*(Why [Jj]oin [Uu]s)[?:\s]/gi, "\n\n## Why Join Us\n\n")
      .replace(/\.?\s*(Who [Yy]ou [Aa]re)[:\s]/gi, "\n\n## Who You Are\n\n")
      .replace(/\.?\s*(What [Yy]ou'?ll [Bb]ring)[:\s]/gi, "\n\n## What You'll Bring\n\n")
      .replace(/\.?\s*(What you can expect)[:\s]/gi, "\n\n## What You Can Expect\n\n")
      .replace(/\.?\s*(Requirements?)[:\s]/gi, "\n\n## Requirements\n\n")
      .replace(/\.?\s*(Qualifications?)[:\s]/gi, "\n\n## Qualifications\n\n")
      .replace(/\.?\s*(Responsibilities)[:\s]/gi, "\n\n## Responsibilities\n\n")
      .replace(/\.?\s*(About (?:You|Us|the Company|Vanta))[:\s]/gi, "\n\n## About Us\n\n")
      .replace(/•\s*/g, "\n- ")
      .replace(/([a-z])([A-Z][a-z]{3,})/g, "$1 $2")
      .replace(/\.([A-Z][a-z]{2,})/g, ". $1")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/([^\n])(- [A-Z])/g, "$1\n$2")
      .trim()
      .slice(0, 10000);

    const { jobDescription, companyDescription } = separateJobAndCompanyDescription(cleanDescription);

    return {
      company: company || undefined,
      title: title || undefined,
      description: jobDescription,
      companyDescription: companyDescription || undefined,
      location: location || undefined,
      compensation: compensation || undefined,
      compensationMin: compensationMin,
      compensationMax: compensationMax,
      companyWebsite: companyWebsite || undefined,
      companyHeadquarters: companyHeadquarters || undefined,
      companyLogoUrl: companyLogoUrl || undefined,
    };
  } catch {
    return null;
  }
}

function separateJobAndCompanyDescription(fullText: string): {
  jobDescription: string;
  companyDescription: string | null;
} {
  const commonSeparators = [
    /about\s+(?:the\s+)?company/i,
    /about\s+us/i,
    /who\s+we\s+are/i,
    /our\s+company/i,
    /company\s+overview/i,
    /company\s+description/i,
    /about\s+\w+(?:\s+\w+)?$/i,
  ];

  for (const separator of commonSeparators) {
    const match = fullText.match(separator);
    if (match && match.index) {
      const splitIndex = match.index;
      const beforeSplit = fullText.slice(0, splitIndex).trim();
      const afterSplit = fullText.slice(splitIndex).trim();

      if (beforeSplit.length > 100 && afterSplit.length > 50) {
        return {
          jobDescription: beforeSplit,
          companyDescription: afterSplit,
        };
      }
    }
  }

  return {
    jobDescription: fullText,
    companyDescription: null,
  };
}

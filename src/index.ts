#!/usr/bin/env bun
import { program } from "commander";
import { init } from "./commands/init";
import { doctor } from "./commands/doctor";
import { profileImport } from "./commands/profile";
import { add } from "./commands/add";
import { pasteJd } from "./commands/paste-jd";
import { apply } from "./commands/apply";
import { renderCoverLetter } from "./commands/render";
import { review } from "./commands/review";
import { backfillCompanyResearch } from "./commands/research";

program
  .name("jobsearch")
  .description("CLI agent for managing job search pipeline, cover letters, and interview prep")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new jobsearch workspace in the current directory")
  .action(init);

program
  .command("doctor")
  .description("Check that all dependencies and credentials are configured")
  .action(doctor);

const profileCmd = program
  .command("profile")
  .description("Manage your profile");

profileCmd
  .command("import")
  .description("Import your resume PDF and extract text")
  .requiredOption("--resume-pdf <path>", "Path to your resume PDF")
  .action((opts) => profileImport(opts.resumePdf));

program
  .command("add")
  .description("Add a new role to track")
  .option("--url <url>", "Job posting URL")
  .option("--company <name>", "Company name")
  .option("--title <title>", "Job title")
  .action((opts) => add(opts));

program
  .command("paste-jd <roleId>")
  .description("Paste job description text for a role (reads from stdin)")
  .action(pasteJd);

program
  .command("apply <roleId>")
  .description("Generate cover letter and register application")
  .action((roleId) => apply(roleId));

const renderCmd = program
  .command("render")
  .description("Re-render artifacts");

renderCmd
  .command("cover-letter <applicationId>")
  .description("Re-render cover letter PDF from markdown")
  .action(renderCoverLetter);

program
  .command("review")
  .description("Review your pipeline")
  .option("--weekly", "Show weekly review summary")
  .action((opts) => review(opts.weekly));

program
  .command("backfill-research")
  .description("Backfill company research for all companies missing data")
  .action(async () => {
    console.log("Backfilling company research...\n");
    const { success, failed, skipped } = await backfillCompanyResearch();
    console.log(`\nDone: ${success} succeeded, ${failed} failed, ${skipped} skipped`);
  });

program.parse();

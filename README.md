# JobSpot

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-v1.0+-black)](https://bun.sh)

**Your AI-powered command center for the modern job hunt.**
Track applications, generate tailored cover letters, and prepare for interviews—all from your terminal.

</div>

---

## TL;DR

**The Problem**: Job hunting is a chaotic mess of spreadsheets, lost PDFs, generic cover letters, and forgotten follow-ups.

**The Solution**: A local-first CLI agent that treats your job search like a software engineering pipeline. It manages your profile, tracks role status, uses AI to write hyper-specific cover letters, and renders them to professional PDFs.

### Why Use JobSpot?

| Feature               | What It Does                                                            |
| --------------------- | ----------------------------------------------------------------------- |
| **Pipeline Tracking** | Kanban-style management for roles (Applied, Interview, Offer, Rejected) |
| **AI Cover Letters**  | Uses Gemini 2.0 to craft tailored letters based on your resume + JD     |
| **PDF Generation**    | Renders professional PDFs via LaTeX (no more Word formatting hell)      |
| **Company Research**  | Auto-fetches company details to prep you for interviews                 |
| **Local First**       | Your data stays on your machine (TOML/JSON storage)                     |

---

## Quick Example

Get from "zero" to "applied" in 4 steps:

```bash
# 1. Initialize a new workspace
bun run src/index.ts init

# 2. Import your resume
bun run src/index.ts profile import --resume-pdf ./my-resume.pdf

# 3. Add a role you found
bun run src/index.ts add --url "https://jobs.example.com/eng" --company "Acme Corp" --title "Senior Engineer"

# 4. Generate application materials
bun run src/index.ts apply <role-id>
```

---

## Installation

### Prerequisites

- **Bun**: This project runs on [Bun](https://bun.sh).
- **XeLaTeX**: Required for rendering PDFs (usually part of TeX Live or MiKTeX).
- **LLM API Key**: Supports Gemini, OpenAI, and Anthropic.

### Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/JobSpot.git
   cd JobSpot
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Configure Environment:**
   Create a `.env` file with the API key for your provider:
   ```bash
   GEMINI_API_KEY=your_gemini_key
   # OPENAI_API_KEY=your_openai_key
   # ANTHROPIC_API_KEY=your_anthropic_key
   # GOOGLE_API_KEY=legacy_gemini_key
   ```

---

## Commands

The CLI is your main interface. Run commands via `bun run src/index.ts <command>`.

### Core Workflow

| Command          | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| `init`           | Initialize a new workspace in the current directory.            |
| `doctor`         | Check if dependencies (LaTeX, API keys) are set up correctly.   |
| `profile import` | Import your resume PDF to seed the AI context.                  |
| `add`            | Add a new job role to your pipeline.                            |
| `apply`          | Generate a cover letter and register an application for a role. |
| `review`         | Review your pipeline status (add `--weekly` for a summary).     |

### Utilities

| Command               | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `paste-jd`            | Manually paste a job description for a specific role ID. |
| `render cover-letter` | Re-generate the PDF for an existing application.         |
| `backfill-research`   | AI-fetch missing data for companies in your pipeline.    |

---

## Configuration

The agent uses `jobsearch.toml` for behavior settings.

```toml
[llm]
provider = "gemini"
model = "gemini-2.0-flash"

[renderer]
latex_engine = "xelatex"  # Ensure this binary is in your PATH

[defaults]
followup_days = 5         # Remind me to follow up after X days
```

Provider options: `gemini`, `openai`, `anthropic`.

---

## Architecture

```
┌─────────────────┐       ┌──────────────┐       ┌─────────────┐
│  CLI / TUI      │──────▶│  Controller  │──────▶│  Database   │
│ (Commander/Ink) │       │  (Logic)     │       │ (JSON/TOML) │
└─────────────────┘       └──────────────┘       └─────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │  LLM Service │
                          │ (Provider API) │
                          └──────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │   Renderer   │
                          │ (LaTeX/PDF)  │
                          └──────────────┘
```

---

## Troubleshooting

### `Error: Spawn xelatex ENOENT`

**Cause**: The LaTeX engine is not installed or not in your PATH.
**Fix**: Install a TeX distribution (e.g., MacTeX on macOS, TeX Live on Linux).

### `Error: API key not found`

**Cause**: Missing provider API key (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or legacy `GOOGLE_API_KEY`).
**Fix**: Ensure `.env` exists and contains your key, or set it in your shell environment.

---

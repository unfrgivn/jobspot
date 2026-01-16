# JobSearch Agent - Project Plan

## Overview

A job search management agent targeting **CTO/VP/Director-level engineering leadership roles**. The app helps with tracking job applications, generating tailored cover letters using Gemini LLM, organizing application materials, and interview prep.

**Interfaces:**
- **TUI** (Terminal UI) - keyboard-driven, fast data entry, ideal for power users
- **Web App** - visual dashboard, drag-and-drop, mobile-friendly, ideal for pipeline review

Both interfaces share the same database, commands, and business logic.

## Tech Stack

### Core (Shared)
- **Runtime**: Bun + TypeScript
- **Database**: SQLite via `bun:sqlite`
- **LLM**: Google Gemini (pluggable, starts with `gemini-1.5-flash`)
- **PDF Generation**: Pandoc + MacTeX (xelatex)
- **Config**: TOML files (`jobsearch.toml`, `jobsearch.secrets.toml`)

### TUI
- **Framework**: OpenTUI (`@opentui/core`, `@opentui/react`)

### Web App
- **Server**: Hono (lightweight, Bun-native, excellent TypeScript support)
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Build**: Vite (for frontend bundling)
- **Realtime**: Server-Sent Events for LLM streaming

## Project Structure

```
/Users/bash/Sites/unfrgivn/job-search-agent/
├── package.json
├── tsconfig.json
├── .gitignore
├── vite.config.ts                    # Vite config for web frontend
├── tailwind.config.ts                # Tailwind configuration
├── prompts/
│   └── cover_letter_v1.md            # Cover letter prompt spec
├── templates/
│   └── pandoc/
│       └── cover-letter.tex          # LaTeX template
├── profile/
│   ├── identity.yml                  # Contact info
│   ├── notes.md                      # Leadership notes, experience bullets
│   └── stories.yml                   # Quantified wins for win-matching
├── src/
│   ├── tui.ts                        # TUI entry point (OpenTUI)
│   ├── index.ts                      # CLI entry point (commander)
│   ├── server.ts                     # Web server entry point (Hono)
│   ├── workspace.ts                  # Workspace root detection, path helpers
│   ├── config.ts                     # Config/secrets loading
│   ├── db/
│   │   ├── index.ts                  # SQLite connection, migrations
│   │   ├── companies.ts              # Company queries
│   │   ├── roles.ts                  # Role queries
│   │   ├── applications.ts           # Application queries
│   │   └── tasks.ts                  # Task queries
│   ├── commands/                     # Business logic (shared by TUI, CLI, Web)
│   │   ├── init.ts                   # Initialize workspace
│   │   ├── doctor.ts                 # System checks
│   │   ├── profile.ts                # Import resume PDF
│   │   ├── add.ts                    # Add role (scrape URL or manual)
│   │   ├── paste-jd.ts               # Attach JD to role
│   │   ├── apply.ts                  # Generate cover letter + apply
│   │   ├── render.ts                 # Re-render PDF from markdown
│   │   └── review.ts                 # Pipeline review
│   ├── llm/
│   │   └── gemini.ts                 # Gemini cover letter generation
│   ├── render/
│   │   └── pandoc.ts                 # Pandoc PDF rendering
│   └── web/
│       ├── routes/
│       │   ├── api.ts                # REST API routes
│       │   ├── dashboard.tsx         # Dashboard page
│       │   ├── pipeline.tsx          # Pipeline (kanban) page
│       │   ├── role.tsx              # Single role detail page
│       │   └── settings.tsx          # Settings page
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   ├── RoleCard.tsx          # Role card for pipeline
│       │   ├── StatusBadge.tsx       # Status indicator
│       │   ├── TaskList.tsx          # Upcoming tasks
│       │   ├── InterviewList.tsx     # Interview schedule
│       │   ├── CoverLetterPreview.tsx # Live cover letter preview
│       │   └── Layout.tsx            # App shell, nav
│       ├── hooks/
│       │   ├── useRoles.ts           # Role data fetching
│       │   ├── useApplications.ts    # Application data fetching
│       │   └── useSSE.ts             # Server-sent events hook
│       └── lib/
│           └── api.ts                # API client
├── public/
│   └── favicon.ico
└── dist/                             # Built web assets (gitignored)
```

## Database Schema

```sql
-- Companies
CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Roles (job postings)
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  title TEXT NOT NULL,
  level TEXT,
  location TEXT,
  job_url TEXT,
  jd_text TEXT,
  source TEXT,
  compensation_range TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Applications (tracks status through pipeline)
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  role_id TEXT REFERENCES roles(id),
  status TEXT DEFAULT 'wishlist',  -- wishlist, applied, interviewing, offer, rejected, withdrawn
  applied_at TEXT,
  via TEXT,
  next_followup_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Contacts (networking)
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  linkedin TEXT,
  notes TEXT,
  last_contacted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Interviews
CREATE TABLE interviews (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id),
  round_name TEXT NOT NULL,
  scheduled_at TEXT,
  format TEXT,
  interviewers_json TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks (follow-ups, prep items)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id),
  kind TEXT NOT NULL,  -- followup, prep, thank_you
  due_at TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Artifacts (generated files)
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id),
  kind TEXT NOT NULL,  -- cover_letter_md, cover_letter_pdf, resume_pdf
  path TEXT NOT NULL,
  sha256 TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Events (audit log)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id),
  event_type TEXT NOT NULL,
  occurred_at TEXT DEFAULT (datetime('now')),
  payload_json TEXT
);
```

## Web App Architecture

### API Routes (Hono)

```
GET  /api/health              # Health check
GET  /api/doctor              # System status

GET  /api/companies           # List companies
POST /api/companies           # Create company
GET  /api/companies/:id       # Get company

GET  /api/roles               # List roles (with filters)
POST /api/roles               # Create role (manual or from URL)
GET  /api/roles/:id           # Get role with company, application
PUT  /api/roles/:id           # Update role
PUT  /api/roles/:id/jd        # Update job description

GET  /api/applications        # List applications (pipeline view)
POST /api/applications        # Create application
GET  /api/applications/:id    # Get application details
PUT  /api/applications/:id    # Update status, notes
POST /api/applications/:id/apply  # Generate cover letter

GET  /api/tasks               # List pending tasks
PUT  /api/tasks/:id           # Update task status

GET  /api/interviews          # List upcoming interviews
POST /api/interviews          # Schedule interview

GET  /api/artifacts/:id       # Serve artifact file (PDF, etc.)

GET  /api/stream/cover-letter # SSE: stream cover letter generation
```

### Web Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview: pipeline stats, upcoming tasks, recent activity |
| Pipeline | `/pipeline` | Kanban board with drag-and-drop status changes |
| Role Detail | `/roles/:id` | Full role view, JD, cover letter, actions |
| Add Role | `/roles/new` | Form to add role (URL scrape or manual) |
| Settings | `/settings` | Profile, API key status, doctor output |

### Key Web Features

1. **Kanban Pipeline View**
   - Columns: Wishlist, Applied, Interviewing, Offer, Rejected
   - Drag roles between columns to update status
   - Visual indicators for overdue follow-ups

2. **Live Cover Letter Generation**
   - Stream Gemini output in real-time via SSE
   - Preview markdown before PDF render
   - One-click PDF download

3. **Quick Add via URL**
   - Paste job posting URL
   - Auto-scrape company, title, JD
   - Review and confirm before saving

4. **Task Dashboard**
   - Overdue tasks highlighted
   - Filter by type (follow-up, prep, thank-you)
   - One-click complete

5. **Mobile Responsive**
   - Review pipeline on phone
   - Quick status updates on the go

## Shared Command Layer

Both TUI and Web use the same command functions:

```typescript
// src/commands/apply.ts
export async function applyToRole(roleId: string, resumePath: string): Promise<ApplyResult>

// src/commands/add.ts
export async function addRole(opts: AddRoleOptions): Promise<Role>

// src/commands/review.ts
export function getReviewData(): ReviewData
```

The web layer wraps these in HTTP handlers; the TUI calls them directly.

## Application Workflow

### 1. Initialize Workspace

```bash
bun run cli init
```

Creates:
- `jobsearch.sqlite` database
- `profile/` directory with template files
- `companies/` directory for per-company artifacts
- `jobsearch.toml` config file

### 2. Import Resume

```bash
bun run cli profile import --resume-pdf /path/to/resume.pdf
```

- Copies PDF to `profile/resume.pdf`
- Extracts text to `profile/resume_extracted.txt` using `pdftotext`

### 3. Add a Role

**CLI:**
```bash
bun run cli add --url "https://company.com/jobs/123"
bun run cli add --company "Acme Corp" --title "VP Engineering"
```

**Web:**
- Navigate to `/roles/new`
- Paste URL or fill form
- Click "Add Role"

### 4. Paste Job Description

**CLI:**
```bash
pbpaste | bun run cli paste-jd <role-id>
```

**Web:**
- Open role detail page
- Paste JD into textarea
- Click "Save"

### 5. Apply (Generate Cover Letter)

**CLI:**
```bash
bun run cli apply --resume profile/resume.pdf <role-id>
```

**Web:**
- Open role detail page
- Click "Generate Cover Letter"
- Watch streaming output
- Download PDF

### 6. Review Pipeline

**CLI:**
```bash
bun run cli review
```

**Web:**
- Dashboard shows stats, tasks, recent activity
- Pipeline view shows kanban board

### 7. Doctor (System Check)

**CLI:**
```bash
bun run cli doctor
```

**Web:**
- Settings page shows doctor results

## TUI Interface

Launch with:
```bash
bun run start
```

Screens:
- **Main Menu**: Pipeline, Add Role, Review, Profile, Doctor, Quit
- **Pipeline**: List of roles with status, select to see actions
- **Role Actions**: Apply, Paste JD, Back
- **Add Role**: Form with URL, Company, Title fields
- **Profile**: Import Resume, Edit Identity, Edit Notes
- **Doctor**: System check results
- **Review**: Tasks, interviews, pipeline summary

Navigation:
- Arrow keys: Navigate menus
- Enter: Select item
- ESC: Go back
- Tab: Switch form fields
- q: Quit (from main menu)

## Web Interface

Launch with:
```bash
bun run web
```

Opens browser at `http://localhost:3000`

## Cover Letter Spec

- **Length**: 1-2 paragraphs only
- **Tone**: High-agency, confident
- **Structure**:
  1. Lead with quantified "command over craftsmanship" win matched to JD
  2. Connect experience to role requirements
  3. Strong CTA close
- **Sign-off**: "Sincerely, [Your Name]"

## Git Policy

**Commit:**
- Code (`src/`)
- Prompts (`prompts/`)
- Templates (`templates/`)
- Profile YAML/MD (`profile/identity.yml`, `profile/notes.md`, `profile/stories.yml`)
- Web components (`src/web/`)
- Config files (`vite.config.ts`, `tailwind.config.ts`)

**Gitignore:**
- `jobsearch.sqlite`
- `companies/**`
- `profile/resume.pdf`
- `profile/resume_extracted.txt`
- `jobsearch.secrets.toml`
- `node_modules/`
- `dist/`

## Environment Setup

### Required Dependencies

```bash
# Bun runtime
curl -fsSL https://bun.sh/install | bash

# LaTeX (for PDF generation)
brew install --cask mactex  # or basictex

# Pandoc
brew install pandoc

# pdftotext (for resume extraction)
brew install poppler
```

### API Key

Set Google API key for Gemini:

```bash
export GOOGLE_API_KEY="your-key-here"
```

Or add to `jobsearch.secrets.toml`:
```toml
google_api_key = "your-key-here"
```

## Profile Summary (Example)

- **Current**: [Role] at [Company]
- **Key wins**:
  - [Outcome or metric]
  - [Outcome or metric]
- **Philosophy**: [Leadership philosophy]
- **Looking because**: [Reason for search]

## Commands Reference

| Command | Description |
|---------|-------------|
| `bun run start` | Launch TUI |
| `bun run web` | Launch Web App (http://localhost:3000) |
| `bun run cli init` | Initialize workspace |
| `bun run cli doctor` | System health check |
| `bun run cli add` | Add new role |
| `bun run cli paste-jd <id>` | Attach JD to role |
| `bun run cli apply <id>` | Generate cover letter |
| `bun run cli review` | Pipeline overview |
| `bun run cli profile import` | Import resume PDF |
| `bun run cli render <id>` | Re-render PDF from markdown |

## New Dependencies for Web App

```bash
bun add hono @hono/node-server
bun add -d vite @vitejs/plugin-react tailwindcss postcss autoprefixer
bun add class-variance-authority clsx tailwind-merge lucide-react
bun add @radix-ui/react-slot @radix-ui/react-dropdown-menu @radix-ui/react-dialog
```

## Implementation Phases

### Phase 1: Core Web Infrastructure
- [ ] Add Hono server (`src/server.ts`)
- [ ] Create API routes for CRUD operations
- [ ] Set up Vite + React + Tailwind
- [ ] Create basic Layout component

### Phase 2: Dashboard & Pipeline
- [ ] Dashboard page with stats
- [ ] Pipeline kanban view
- [ ] Role cards with status badges
- [ ] Drag-and-drop status updates

### Phase 3: Role Management
- [ ] Role detail page
- [ ] Add role form (URL scrape + manual)
- [ ] JD paste/edit
- [ ] Cover letter generation with SSE streaming

### Phase 4: Tasks & Interviews
- [ ] Task list component
- [ ] Interview schedule
- [ ] Overdue highlighting
- [ ] Quick actions (complete, snooze)

### Phase 5: Polish
- [ ] Mobile responsive design
- [ ] Settings page
- [ ] Error handling & loading states
- [ ] Performance optimization

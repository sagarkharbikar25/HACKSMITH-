<div align="center">

<img src="docs/logo.svg" alt="Brandora AI Logo" width="380" />

<p align="center">
  <img src="docs/logo-a.svg" alt="Concept A: Range Bracket B (Primary Mark)" width="32" height="32" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/logo-b.svg" alt="Concept B: Governance Aperture" width="32" height="32" />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/logo-c.svg" alt="Concept C: Scan Line Monogram" width="32" height="32" />
</p>

# Brandora AI 🛡️
### Intelligent Brand Governance, Visual Asset Compliance & Content Safety Platform

[![CI/CD Pipeline](https://github.com/sagarkharbikar25/HACKSMITH-/actions/workflows/ci.yml/badge.svg)](https://github.com/sagarkharbikar25/HACKSMITH-/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Google%20Gemini%201.5%2F2.5-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Inkloom AI Brand Governance Challenge &bull; Round 3 Final Submission**  
**Team:** Sagar Kharbikar & Ayush Roy

</div>

---

> 📂 **Project Documentation & Submission Drive:**  
> **[Click Here to Open Project Google Drive Documentation](https://drive.google.com/)** *(Paste your final Drive report/video link here)*

---

## 📌 Executive Summary

Modern organizations scale content across employees, partner agencies, and AI generators—frequently introducing contradictory facts, banned hyperbole, off-palette visuals, and unsupported claims before anyone notices.

**Brandora AI** is an enterprise pre-publication governance platform that validates multi-channel marketing collateral (text copy, graphic assets, and brand guidelines) before publication. Rather than functioning as a black-box rewriter, Brandora AI:
1. **Detects** inconsistencies in tone, factual claims, terminology, visual color harmony ($\Delta\text{E}$ CIE76), and accessibility (WCAG AA 4.5:1).
2. **Explains** each issue with verifiable ground-truth citations to approved brand books and specifications.
3. **Preserves Human Agency** by suggesting in-place corrections without overriding human editorial intent.
4. **Governs Approval Lifecycles** through role-based review queues, collaborative compliance threads, and immutable audit logs.
5. **Heals Ambiguous Guidelines** using automated dispute clustering to surface unclear rules and offer 1-click wording refinements.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph UI ["Multi-Role Enterprise Frontend (React 19 + TypeScript + Tailwind)"]
        CS["Creator Studio (/creator/*)\nAuthoring, Fixes & Visual Uploads"]
        RT["Reviewer Terminal (/reviewer/*)\nEvaluation Queue & Decisions"]
        GC["Governance Center (/governance/*)\nInsights, Ingestion & Audit Logs"]
    end

    subgraph API ["FastAPI 0.115 Core Engine (Port 8000)"]
        Auth["Auth & Security Router\nBcrypt, JWT, Gmail SMTP Reset"]
        Submissions["Submission & Versioning Router\nV1 vs V2 Diffing, Gate Enforcement"]
        Orchestrator["Hybrid Audit Orchestrator"]
        Ingest["Guideline Ingestion Pipeline\nPDF/DOCX Extraction & Staging"]
        Insights["Gap Analysis & Self-Healing Service"]
    end

    subgraph Engines ["Audit & Verification Engines"]
        RuleEng["Deterministic Rule Engine\nSub-10ms Exact & Regex Matching"]
        FactEng["Factual Consistency Engine\nGround-Truth Spec Cross-Check"]
        VisionEng["Visual Asset Compliance\nPalette ΔE <= 25 & WCAG Contrast"]
        GeminiEng["Google Gemini Flash LLM\nNuanced Semantic & Tone Verification"]
    end

    subgraph Data ["Persistence & Security Layer"]
        PG[("Supabase Cloud PostgreSQL\nTransactions, JSONB & Row Clearance")]
        AuditStore[("Immutable Audit Trail\nCryptographic Metadata Logs")]
    end

    CS -->|Draft & Asset Upload| Submissions
    RT -->|Approve / Request Revision| Submissions
    GC -->|Ingest Guidelines & Refine| Ingest

    Submissions --> Orchestrator
    Ingest --> Insights
    Orchestrator --> RuleEng
    Orchestrator --> FactEng
    Orchestrator --> VisionEng
    Orchestrator --> GeminiEng

    API --> PG
    API --> AuditStore
```

---

## ✨ Core Product Capabilities

### 1. Pre-Publication Creator Studio
- **Real-Time Deterministic & Semantic Audits:** Intercepts claims, banned buzzwords, terminology deviations, and factual contradictions in under 10ms.
- **Explainable Finding Cards:** Each flagged issue cites the exact guideline number (e.g., `CLAIM-01`, `AF-014`), explains *why* it was flagged, and shows approved alternatives.
- **1-Click Suggestion Application & V1 vs V2 Diffing:** In-place suggestion adoption that updates version history and computes side-by-side unified diffs.
- **Enforced Workflow Gates:** Prevents submissions from reaching reviewers until all Critical and High severity violations are cleared.

### 2. Visual Asset Compliance Engine
- **Dominant Palette Detection:** Analyzes uploaded creative assets (`.png`, `.jpg`, `.webp`) and calculates color variance against brand colors using Euclidean Delta-E ($\Delta\text{E}$).
- **Color Bounding Box Highlights:** Overlays exact visual coordinates highlighting regions that deviate from brand standards (e.g. Lumora Amber `#F2A93B` tolerance $\le 25.0$).
- **WCAG AA 4.5:1 Contrast Meter:** Automatically calculates contrast ratios for embedded text over background regions to ensure accessibility compliance.
- **OWASP File Defense:** Validates file magic bytes to block disguised executable scripts or malicious polyglots.

### 3. Reviewer Terminal & Collaborative Thread
- **Centralized Review Queue (`/reviewer/queue`):** Reviewers evaluate pending campaigns across the organization with open findings summaries.
- **Collaborative Thread:** Integrated communication stream on every submission where creators, agencies, and reviewers track revision requirements.
- **Formal Decision Workflows:** One-click **Approve** or **Request Revision** with mandatory override justification if approving drafts with unresolved warnings.

### 4. Brand Governance, Ingestion & Self-Healing Rules
- **PDF & DOCX Guideline Ingestion:** Drag-and-drop brand books to automatically parse and extract brand rules and fact specifications.
- **Staging Review Drawer:** Interactive approval drawer where Brand Managers inspect candidate rules with exact page/section citations before publishing them to the live database.
- **Self-Healing Guideline Analytics:** Analyzes creator dismissal rates and dispute frequencies to identify confusing brand rules, generating 1-click wording refinements with explicit exceptions.
- **Custom Rule Authoring:** Create and tune custom phrase, regex, or claim rules with zero code.

### 5. Enterprise Security & Authentication
- **Role-Based Access Control (RBAC):** Five distinct clearances: `creator`, `agency`, `reviewer`, `brand_manager`, and `admin`.
- **Real Email SMTP Delivery:** Built-in Gmail SMTP integration delivering secure, single-use 15-minute reset tokens with direct-link auto-login (`/login?token=...`).
- **Data Privacy & Anti-Enumeration:** Strict payload sanitation ensuring reset tokens and confidential internal brand notes never leak in public API responses.
- **Immutable Audit Trail:** Chronological, tamper-evident audit stream logging all logins, document uploads, rule adoptions, and reviewer decisions.

---

## 👥 Demo Personas (Zero-Typing Quick Login)

All demo accounts use password: `demo1234`

| Persona | Email | Primary Responsibilities |
|---|---|---|
| **Creator** | `creator@lumora.demo` | Drafts social & ad campaigns, runs compliance audits, applies fixes, and submits to queue. |
| **Agency** | `agency@lumora.demo` | External contributor with automatic redaction of internal/confidential fact notes. |
| **Reviewer** | `reviewer@lumora.demo` | Manages review queue, inspects V1/V2 diffs, posts review notes, and approves or requests revision. |
| **Brand Manager** | `brand@lumora.demo` | Manages brand guidelines, ingests PDF/DOCX brand books, refines rules, and inspects analytics. |
| **Admin** | `admin@lumora.demo` | Inspects immutable system audit trail and oversees organization-wide security governance. |

---

## 🎬 7-Step Evaluation Walkthrough

Follow this 5-minute journey to test the complete end-to-end platform:

1. **Sign in as Creator (`creator@lumora.demo`):**
   - Click **Try the Lumora Sample Draft** in Creator Studio.
   - Click **Run Compliance Audit** &rarr; Observe `CLAIM-01` (Superlative claim) and `AF-014` (Territory contradiction) flagged.
2. **Resolve Violations & Upload Visual Asset:**
   - Click **Apply suggestion** on both findings and click **Save & Recheck (New Version)**.
   - Switch to the **Creative Assets** tab and drop `data/seed/assets/lumora_bad_palette.png` &rarr; Inspect the $\Delta\text{E} = 61.0$ alert and bounding box.
   - Click **Submit for Review** once compliant &rarr; Status updates to `IN_REVIEW`.
3. **Sign in as Reviewer (`reviewer@lumora.demo`):**
   - In `/reviewer/queue`, open the submitted campaign.
   - Click **Compare V1 vs V2** to review side-by-side diffs.
   - Add a collaborative note in the **Compliance Review Thread**.
   - Click **Record Compliance Decision** &rarr; Select **Approve** &rarr; Campaign locks as `APPROVED`.
4. **Sign in as Brand Manager (`brand@lumora.demo`):**
   - In `/governance/insights`, observe rule dispute telemetry.
   - Click **Adopt Improved Rule Wording** on `CLAIM-01` to adopt the self-healed guideline.
   - In `/governance/rules`, drop `data/seed/documents/lumora_guidelines.docx` into the Ingestion Dropzone.
   - Open the **Staging Review Drawer** &rarr; Click **Accept & Publish** on extracted rules.
   - Check `/governance/audit-trail` &rarr; Verify all actions logged in the immutable trail!

---

## ⚡ Quickstart & Local Installation

### Prerequisites
- **Python:** 3.11+
- **Node.js:** 20+
- **Database:** Supabase Cloud PostgreSQL (pre-configured) or local SQLite

### Option A: 1-Click Windows Launch (Recommended)
Double-click:
```cmd
start.bat
```
*Validates environment, installs dependencies, frees ports, starts both servers, and opens http://localhost:5173.*

### Option B: Manual Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## ⚙️ Environment Configuration (`.env`)

Copy `.env.example` to `backend/.env`:

```env
# Database (Supabase Pooler)
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# Security
JWT_SECRET=supersecret-demo-jwt-key-brandguard-2026
JWT_EXPIRE_MIN=720
DEMO_MODE=true

# Google Gemini LLM Engine
LLM_ENABLED=false                  # Set to true for live Gemini API calls
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# SMTP Email Delivery (Gmail)
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_char_google_app_password
SMTP_FROM=your_email@gmail.com
```

---

## 🧪 Testing & CI/CD Pipeline

Brandora AI includes a 100% automated test suite covering security, role matrix, visual checks, and API endpoints.

```bash
# Run backend test suite
cd backend
python -m pytest tests/ -v

# Run frontend production build & typecheck
cd frontend
npm run build
```

Every push to `main` triggers our GitHub Actions CI workflow (`.github/workflows/ci.yml`) to ensure regression-free releases.

---

## 🛡️ Responsible AI & Security Considerations

- **Confidentiality:** Draft copy is never sent to external AI servers when in deterministic mode. When Gemini is enabled, prompt boundaries and nonces strictly isolate brand data.
- **Anti-Hallucination Grounding:** Factual compliance requires exact matches against verified database specifications.
- **Tamper-Evident Accountability:** Every reviewer approval, rule change, and override is permanently etched into the PostgreSQL audit stream with user IDs and timestamps.
- **OWASP File Upload Hardening:** MIME detection validates magic bytes directly to prevent server-side execution attacks.

---

<div align="center">
<b>Brandora AI</b> &bull; Built with precision for the Inkloom AI Hackathon 2026.
</div>

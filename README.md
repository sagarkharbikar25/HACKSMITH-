# BrandGuard AI 🛡️
> Automated Content Compliance & Brand Safety Governance Engine for Multi-Channel Marketing

[![CI](https://github.com/sagarkharbikar25/HACKSMITH-/actions/workflows/ci.yml/badge.svg)](https://github.com/sagarkharbikar25/HACKSMITH-/actions/workflows/ci.yml)
**Round 2 Prototype Build** &bull; Team: Sagar Kharbikar + Ayush Roy

---

## 🚀 Quick Demo Personas (Zero-Typing Login)
All accounts use password: `demo1234`

| Persona | Demo Email | Role & Capabilities |
|---|---|---|
| **Creator** | `creator@lumora.demo` | Create drafts, load Lumora sample, run audit, apply suggestions, recheck, submit for review. |
| **Agency** | `agency@lumora.demo` | Agency creator role with automatic redaction of confidential internal fact statements. |
| **Reviewer** | `reviewer@lumora.demo` | Review queue, inspect version diffs, approve content, or request revisions with comments. |
| **Brand Manager** | `brand@lumora.demo` | Knowledge base editor (rules & facts), guideline management, and compliance analytics. |
| **Admin** | `admin@lumora.demo` | View immutable audit trail (no content logged), manage system, and reset demo data. |

---

## 🏃 3-Command Local Run

```bash
# 1. Clone & navigate
git clone https://github.com/sagarkharbikar25/HACKSMITH-.git
cd HACKSMITH-

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Start FastAPI server (seeds Lumora workspace automatically on boot)
cd backend
uvicorn app.main:app --reload --port 8000
```
API Documentation (Interactive OpenAPI Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)  
Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 🎯 The Core Demo Scenario (Lumora Smart Lamp)
1. **Load Sample Draft** &rarr; paste the Round 1 Lumora caption:
   > *"Experience the world's best smart lamp! Now available across the US for an unbelievable price of just $49. It's truly a revolutionary product with award-winning design!"*
2. **Click Audit / Check** &rarr; Engine flags 3 distinct findings:
   - **F-1 (High)**: `CLAIM-01` Superlative *"world's best"* &rarr; `unsupported_claim` (no backing substantiation).
   - **F-2 (Critical)**: `AF-014` Territory contradiction *"available across the US"* &rarr; `confirmed_contradiction` (Fact `AF-014` certifies India and UK only).
   - **F-3 (Medium)**: `TERM-03` Banned hype buzzword *"revolutionary"* &rarr; `style_issue`.
   *(Notice: "award-winning design" is verified and suppressed because `SUB-01` Design Award substantiation is on file).*
3. **Submit Gate Blocks Premature Submission** &rarr; Creator cannot submit with open critical/high findings (`422 CANNOT_SUBMIT_OPEN_FINDINGS`).
4. **Apply Suggestions & Save Version 2** &rarr; Fixes applied &rarr; Version 2 audited with 0 open findings.
5. **Submit for Review** &rarr; Status transitions to `in_review`.
6. **Reviewer Approves** &rarr; Marcus Cole approves &rarr; Status transitions to `approved` (locked against further edits).
7. **Audit Trail** &rarr; Immutable event recorded without logging sensitive draft text.

---

## 📊 Quantitative Evaluation Metrics
Benchmarked on 20 synthetic labeled test captions (`data/testset/testset.json`):

| Metric | Result |
|---|---|
| **Precision** | **100.0%** |
| **Recall** | **94.4%** |
| **F1 Score** | **97.1%** |
| Attribution Accuracy | 100% (exact evidence ID alignment) |

*Full results generated at `docs/eval_results.json` via `python -m app.engine.evaluate`.*

---

## 🏗️ Architecture & Technology Stack

```
Browser (React + Vite + Tailwind CSS)
   │  HTTPS, Bearer JWT
   ▼
FastAPI Backend (Python 3.11)
 ├─ Routers:   auth · submissions · findings · review · knowledge · insights · admin
 ├─ Services:  workflow (state gates) · audit_orchestrator · insights_service
 ├─ Engine:    normalize (1:1 offset mapping) · rules · facts · regions · retrieval · evidence
 └─ LLM:       untrusted adapter stub (Gemini REST ready, never blocks deterministic engine)
   │
   ▼
SQLAlchemy 2.0 (SQLite for local dev / PostgreSQL pooler for production)
```

---

## 🔄 Changes from Round 1 Proposal
1. **SQLite locally, PostgreSQL in deployment**: Host disks on free tiers are ephemeral; SQLAlchemy abstraction ensures seamless zero-code switch via `DATABASE_URL`.
2. **Reviewer / Marketing Manager consolidation**: Merged into `reviewer` role for clean role hierarchy.
3. **Critical Finding Protection**: Creators cannot dismiss critical contradictions without reviewer override.
4. **Deterministic Authority**: LLMs can only flag `style_issue` or `unsupported_claim`; only the deterministic engine can emit `confirmed_contradiction`.

---

## 🔮 Three Planned Improvements for Round 3
1. **Automated Guideline Ingestion**: Upload a brand-guideline PDF/DOCX and an approved-facts sheet; AI parses and proposes structured rules and facts with source-page citations for human brand-manager approval.
2. **Visual and Accessibility Checks**: Image asset validation with alt-text presence verification, WCAG contrast ratio calculations for text-on-image pairs, and brand color palette conformance checks.
3. **Semantic Retrieval + Guideline-Gap Analytics**: Embedding-based retrieval (`pgvector`) for fuzzy semantic violation matching, plus clustering repeatedly dismissed or overridden rules to suggest clearer brand guideline wording.

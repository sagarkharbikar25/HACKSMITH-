# BrandGuard AI — Round 2 Master Plan (The Build)

**Team:** Sagar Kharbikar + Ayush Roy (duo)
**Window:** 26 Oct 10:00 IST → 28 Oct 10:00 IST (48 hours). Call 26 Oct 10:00 = **T0**.
**Goal:** a live link where a judge, with zero guidance, completes: login → submit draft → see evidence-backed findings → fix → recheck → send for review → reviewer approves → audit trail. Then qualify in the top 100 of 300.

Companion files: `02_PROTOTYPE_BUILD_PLAN.md` (contract, schema, architecture, demo), and one plan per branch (`03`–`06`).

---

## 1. What the judges score, and what that means for us

| Criterion | Pts | What wins it | Our decision |
|---|---|---|---|
| Working core workflow | 30 | One path that never breaks, on the live URL | The Lumora scenario from the Round 1 PDF (Section 6.1) must run end to end on production. Everything else is secondary. |
| Technical depth and reliability | 25 | Real data flow, real AI component, graceful failure | Deterministic engine + validated LLM review + fallback banner + evidence resolver + audit log. Show `engines: {rules: ran, llm: ran}` in the UI. |
| Progress from Round 1 | 20 | Visible mapping from PDF to product | Every Round 1 section gets a "built / changed / deferred" line in the Round 2 PDF. Do not silently drop things. |
| Three planned improvements | 15 | Substantial, specific, feasible | See Section 8. Decided now so the PDF is easy. |
| Usability | 10 | Judges need no explanation | Demo-account quick-login buttons, a "Load sample draft" button, empty states that tell you what to click, a 4-step progress indicator on a submission. |

Your biggest scoring risk is not code quality. It is **a judge opening the link, hitting a cold-started backend or an empty database, and giving up**. Sections 3 and 6 are designed around that.

---

## 2. Decisions I'm making (push back if you disagree)

1. **Keep FastAPI + React + Tailwind.** It matches the Round 1 PDF, and "Progress from Round 1" is 20 points. Switching to Express/Supabase now would need a written justification and gains nothing.
2. **SQLite locally, Postgres in production.** Render/Fly free disks are ephemeral and free instances spin down, so a judge's draft would vanish after the instance sleeps. Use SQLAlchemy so only `DATABASE_URL` changes. Use Supabase (or Neon) purely as hosted Postgres, with no Supabase client. On Render use the **pooler connection string**, since the direct connection is IPv6-only. This is a documented change from the plan: "SQLite for dev, Postgres in deployment because host disks are ephemeral." Judges read that as maturity, not deviation.
3. **Rules-first, LLM optional, never required.** The demo must pass with `LLM_ENABLED=false`. The LLM adds a second layer, with a strict allowed-output set (Section 5 of file 02).
4. **Seed on boot, idempotent.** Production always starts with the Lumora workspace, five demo users, and three ready-made sample drafts.
5. **Marketing manager is merged into the reviewer role.** Five roles total: `creator`, `agency`, `reviewer`, `brand_manager`, `admin`. Report this as a change.
6. **Critical findings cannot be dismissed** (they must be fixed or overridden by a reviewer with a reason). High/medium/low can be dismissed with a reason.

---

## 3. Repo, branches, workflow

**Repo:** `brandguard-ai` (monorepo: `backend/`, `frontend/`, `data/`, `docs/`).

```
main        ← deployed to production, protected, merge only at gates
develop     ← integration branch, deployed to staging (optional) / used for gate testing
├─ sagar/backend-core        (file 03)
├─ sagar/audit-engine        (file 04)
├─ ayush/frontend-workspace  (file 05)
└─ ayush/review-ai-insights  (file 06)
```

Rules:
- Each person works only in their own branch's files (ownership tables in files 03–06). To change a file you don't own, open a PR comment, don't edit.
- Commit often (conventional commits: `feat(engine): region extractor`). Push at least hourly.
- Merge branch → `develop` through PR **only at the gates below** (plus hotfixes). The other person reviews within 20 minutes, or self-merge if CI is green and they're asleep.
- `develop` → `main` only at G2, G3 and the final freeze.
- CI (GitHub Actions): backend `pytest` + `ruff`; frontend `tsc --noEmit` + `vite build`. Red CI blocks merge.
- The OpenAPI schema is the contract. Frontend types are generated: `npx openapi-typescript $API/openapi.json -o src/types/api.d.ts`. Do not hand-write request/response types.

### Ownership map

| Area | Owner | Branch |
|---|---|---|
| DB models, auth, submissions, versions, findings PATCH, review/decision, knowledge CRUD, admin, seed, CI, deploy | Sagar | `sagar/backend-core` |
| Rule engine, fact lookup, region extractor, retrieval, evidence resolver, audit orchestrator, insights query, test set + evaluator | Sagar | `sagar/audit-engine` |
| App shell, auth/login, creator workspace, editor with highlights, findings panel, versions, API client, error/empty states | Ayush | `ayush/frontend-workspace` |
| Reviewer queue + decision panel, KB editor, insights dashboard, audit log view, **LLM adapter (backend/app/llm/)**, role-guarded routes | Ayush | `ayush/review-ai-insights` |
| API contract, test set labelling, bug triage, demo script, PDF | Both | — |
| Deployment + CI | Sagar | — |
| Round 2 PDF layout + screenshots | Ayush (layout), Sagar (technical sections) | — |

Workload note: Ayush's branches are heavier in total hours. Sagar's backend-core is front-loaded and finishes earlier, so after G2 Sagar picks up QA, deployment hardening, the test-set evaluation and most of the PDF text.

---

## 4. Timeline (T0 = 26 Oct 10:00 IST)

Adjust if you have already started: compress Phase 0, never skip the contract freeze.

| Phase | Hours | Clock (IST) | Outcome |
|---|---|---|---|
| **0 Setup + contract** | T+0 → T+2 | 26 Oct 10:00–12:00 | Repo, CI, branches, OpenAPI skeleton with all endpoints returning mock JSON, both apps deployed with "hello" (**Gate G0**) |
| **1 Vertical slice** | T+2 → T+8 | 12:00–18:00 | Login → create submission → audit with 3 hard-coded rules → highlighted findings in UI (**Gate G1**) |
| **2 Full workflow** | T+8 → T+18 | 18:00–04:00 (sleep window inside) | Real rule + fact engine, versions/recheck, submit, reviewer decision, evidence panel, audit log, KB editor. LLM adapter behind a flag (**Gate G2**, merge to `main`, production live) |
| **3 Depth + proof** | T+18 → T+30 | 27 Oct morning–evening | Insights, LLM wired, test-set metrics, role guards, error states, keep-alive, seeded samples (**Gate G3**) |
| **4 Freeze + docs** | T+30 → T+40 | 27 Oct evening–28 Oct 02:00 | Bug-bash from a clean browser, PDF, screenshots, demo recording (**Gate G4 = feature freeze at T+34**) |
| **5 Submit** | T+40 → T+46 | 28 Oct early morning | Final deploy, smoke test, fill form, submit by **28 Oct 07:00**. 10:00 is the hard deadline; 3 hours of buffer is intentional. |

Sleep: each of you take at least 5 hours, ideally staggered so one person is awake while the other sleeps. A sleeping teammate wakes up to a green `develop`, not a broken one.

### Gate checklists

- **G0 (T+2):** `GET /health` live on prod URL; frontend deployed and calls it; OpenAPI lists all endpoints; both branches created from `develop`; `.env.example` committed; seed users exist.
- **G1 (T+8):** log in as creator, paste the Lumora caption, click Check, see ≥2 highlighted findings with evidence IDs (rules can be hard-coded).
- **G2 (T+18):** the whole Round 1 §6.1 example works on production: three findings, apply suggestions, recheck clean, submit, reviewer approves, audit log shows it. Deploy `main`.
- **G3 (T+30):** metrics script run and numbers saved, insights page shows data, LLM on/off both verified, role guards verified, cold-start handling verified.
- **G4 (T+34):** feature freeze. Only bug fixes. Tag `v0.9`.

---

## 5. Scope

**MUST (cut nothing here):** knowledge base seed + editor, text submission, versions + recheck, deterministic term/phrase/claim/tone rules, fact contradiction for availability and one more fact type, evidence resolver, suggested corrections, submit gate, reviewer approve / request revision with comment, override with reason, audit log, role-based access (server-side), rules-only fallback banner, deployed live link.

**SHOULD (if on schedule at G2):** LLM review, insights dashboard (most-triggered, most-dismissed, most-overridden), comments, per-rule dismissal rates, agency redaction of fact statements, "Reset demo data" for admin.

**COULD (only if everything is green at G3):** playground endpoint (anonymous paste-and-check), text file upload (.txt/.md), alt-text check on pasted markdown images.

**NOT NOW (Round 3):** see Section 8.

---

## 6. Judge-proofing (usability = 10 pts, workflow = 30 pts)

- **Login page:** five big buttons, "Continue as Creator / Reviewer / Brand Manager / Agency / Admin". No typing. Passwords exist for real login but are shown on the page.
- **First screen after login (creator):** a banner "Try the sample: Lumora Smart Lamp caption" → one click creates a submission with the Round 1 example text.
- **Backend cold start:** the frontend shows "Waking up the server (free tier, ~30–60 s)…" with retry. A GitHub Actions cron pings `/health` every 10 minutes during 26–28 Oct (Sagar). Verify the cron actually runs.
- **Every page has an empty state** that says what to do next. No blank tables.
- **Visible engine status** on every audit: "Rules: ran · AI review: ran/unavailable". It proves the fallback story without anyone reading docs.
- **Readme + in-app "How to evaluate" drawer** listing the 6 clicks of the main journey.
- Never log submitted content (matches the privacy promise in Round 1 §11).

---

## 7. Round 2 submission pack (checklist)

| Item | Owner | Notes |
|---|---|---|
| Working project link | Sagar | Frontend URL (Vercel). Test in a private window on mobile data. |
| Repository link | Sagar | Public, clean README, `.env.example`, run instructions, no secrets in history. |
| Updated project PDF | Both | Outline below. |
| List of completed features | Both | Table with status (built / partial / deferred) and the route or screen where it is visible. |
| Technology and implementation details | Sagar | Stack, architecture diagram (updated), data flow, schema, engine logic, LLM guardrails, deployment. |
| Explanation of changes from original plan | Both | Honest list. See below. |
| Three Round 3 improvements | Both | Section 8. |

### Updated PDF outline (keep it ≤ 12 pages; judges skim)

1. Status of this document (what is built and live; link; demo accounts)
2. Recap of problem + proposal (half a page, not the whole Round 1)
3. What we built: feature table mapped to Round 1 sections (built/partial/deferred)
4. Live demo walkthrough with 6–8 annotated screenshots
5. Architecture and data flow (updated Figure 2) + schema highlights
6. Compliance engine: rules, facts, evidence resolution, LLM guardrails, failure modes actually exercised
7. Test results: labelled test set precision/recall per category, **with the optimistic-bias caveat** already written in Round 1 §13
8. Changes from the Round 1 plan and why
9. Known limitations (be upfront; credibility scores)
10. Three Round 3 improvements (detailed)
11. Team contributions per member
12. Tools and AI disclosure (update with what code was AI-assisted, templates, libraries)

Anything you promised in Round 1 that you did not build goes in the "deferred" column with a reason. Do not hide it; the judges have the Round 1 PDF.

### Expected "changes from plan" list (edit as reality changes)

- Postgres in deployment, SQLite in local dev (ephemeral hosting disks).
- Marketing/comms manager merged into reviewer role; agency role implemented with redacted fact statements (if done).
- Critical findings cannot be dismissed; dismissals are carried over between versions.
- LLM may only emit `style_issue`, `unsupported_claim`, `needs_human_verification`; only the deterministic engine can emit `confirmed_contradiction`.
- Image/document checks deferred to Round 3 (unless the COULD tier lands).
- Interviews: state honestly what was and wasn't done during the 48 hours. If you can get even 2–3 short real conversations, record them; otherwise say "not done, planned".

---

## 8. The three Round 3 improvements (decide now, put in PDF)

They must be meaningful additions, not cosmetic. Proposed:

1. **Guideline ingestion.** Upload a brand-guideline PDF/DOCX and an approved-facts sheet; an LLM proposes structured rules and facts with source-page citations; a brand manager approves/edits each before it enters the knowledge base. This removes the manual KB setup, which is the biggest adoption barrier. *(Feasible: parse → chunk → schema-validated extraction → human approval queue; reuses the existing evidence model.)*
2. **Visual and accessibility checks for assets.** Image upload with alt-text presence, WCAG contrast ratio computation for text-on-image/colour pairs, brand palette conformance (dominant-colour distance to approved palette) and logo-presence/clear-space check against approved assets. Extends the `visual` and `accessibility` categories already in the finding schema.
3. **Semantic retrieval + guideline-gap analytics.** Embedding-based retrieval (pgvector) so paraphrased violations are matched to the right rule, plus an analytics view that clusters repeatedly dismissed or overridden rules and proposes a clearer rule wording for the brand manager to accept. This delivers the "guideline-gap insights" differentiator from Round 1 beyond simple counts.

Reserve (swap in if one is weak): multi-organisation tenancy with SSO; publishing integrations (Slack/CMS webhook that blocks publish until approved).

---

## 9. Risks and mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Free-tier backend cold start/sleep during judging | High | Keep-alive cron, wake-up UI, Postgres persistence, seed-on-boot |
| Free LLM quota or terms problem | Medium | `LLM_ENABLED` flag, 8 s timeout, one retry, banner; demo does not depend on it |
| Region/fact extraction too brittle | Medium | Narrow to availability + price + 3 feature claims; alias dictionary; unknowns go to `needs_human_verification` rather than guessing |
| Integration drift between UI and API | High | Generated TS types from OpenAPI; G0 mock endpoints; **hourly pull of `develop`** into your branch |
| Merge conflicts | Medium | File ownership, add-don't-edit rule, small PRs at gates |
| Scope creep | High | MUST list frozen; SHOULD only after G2; feature freeze at T+34 |
| One person blocked/asleep | Medium | Mock stubs: Ayush can run on `MOCK_API=true`; Sagar can test with curl/pytest, so neither blocks the other |
| Secrets leak in repo | Low, severe | `.env` ignored from commit 1; rotate any key that is ever committed |
| Submitting at the last minute | High | Internal deadline 28 Oct 07:00; form filled as a draft by T+36 |

---

## 10. Presentation / demo strategy (also use for the PDF and recording)

Record a 2.5-minute screen capture (link in the PDF and form if there is a field). Storyline:

1. (15 s) Problem: a freelancer's caption contradicts the product facts.
2. (45 s) Creator pastes the sample, clicks Check: three findings, each with a **named rule/fact ID**. Open the evidence drawer for AF-014.
3. (30 s) Apply suggestions → recheck → clean. Send for review.
4. (30 s) Reviewer sees history, resolved and dismissed findings, approves. Audit log entry.
5. (20 s) Turn the AI off (or show it unavailable): the banner appears, the core flow still works.
6. (20 s) Brand Manager's insights: which rules fire most, which are disputed.
7. (10 s) Close with the three Round 3 upgrades.

What distinguishes us from the likely crowd of "paste text → LLM says issues" entries: **evidence IDs, named rules, graded uncertainty ("unsupported" is not "false"), human decision, audit trail, and measured precision/recall**. Say these in that order in the PDF and video.

---

## 11. First 30 minutes (do this now)

1. Sagar: create repo, `main`/`develop`, branch protection, CI skeleton, FastAPI app with `/health` and all endpoints returning mock JSON from `02_PROTOTYPE_BUILD_PLAN.md` §6. Push.
2. Ayush: `npm create vite@latest frontend -- --template react-ts`, add Tailwind, React Router, TanStack Query; deploy "hello" to Vercel. Pull Sagar's `develop` once the OpenAPI is up.
3. Both: skim `02` §6 (API contract) and §4 (schema) and confirm or amend in one 15-minute call. After that, the contract changes only via a PR touching `02`.
4. Create the Supabase/Neon project and the Render service; put `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY` in Render env (never in the repo).

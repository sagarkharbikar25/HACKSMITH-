# SAGAR — Prototype Build Plan
**Branches:** `sagar/backend-core` and `sagar/audit-engine`
**Role in the final merge:** integrator (deploy, CI, keep-alive, submission form)
**Companion docs:** `01_MASTER_PLAN.md` (strategy), `02_PROTOTYPE_BUILD_PLAN.md` (full spec, source of truth), `03`/`04` (branch detail). This file is self-contained: you can work from it alone.

Build window: 26 Oct 10:00 IST (T0) → 28 Oct 10:00 IST. Internal submit deadline: **28 Oct 07:00 IST**.

---

## 1. What you deliver (the backend of the prototype)

By the end, the live API must support this journey with no UI help:

`login → GET /samples → POST /submissions → POST /submissions/{id}/audit → PATCH /findings/{id} → POST /submissions/{id}/versions (recheck) → POST /submissions/{id}/submit → POST /submissions/{id}/decision → GET /admin/audit-log → GET /insights/recurring`

Plus knowledge-base CRUD, evidence resolver, seeded Lumora data, role enforcement on every route, graceful behaviour when the LLM is off.

Ayush delivers: all frontend, and `backend/app/llm/*` (the LLM adapter). You only provide a stub for it at G0.

---

## 2. Branch split

| Branch | Contents | Hours |
|---|---|---|
| `sagar/backend-core` | models, db, auth, submissions/versions, workflow gates, findings PATCH, review decision, knowledge CRUD + evidence endpoint, admin, seed, CI, deploy, keep-alive | ~14 |
| `sagar/audit-engine` | normalize, rules, facts, regions, retrieval, evidence resolver, orchestrator, insights service + router, test set, evaluator | ~16 |

You work on both. Recommended interleaving (keeps Ayush unblocked):

1. `backend-core` G0 (mock endpoints + deploy) — **first 2 hours, nothing else**.
2. `audit-engine` pure modules (`normalize`, `rules`, `regions`, `facts`) — no DB needed, test with pytest.
3. `backend-core` real models/auth/submissions (G1).
4. `audit-engine` orchestrator + persistence → remove the `TEMP-G1` fake.
5. `backend-core` workflow gates, decision, knowledge, admin.
6. `audit-engine` retrieval, LLM merge, carry-over, insights, test set + evaluator.
7. Hardening, deploy checks, README, PDF technical sections.

---

## 3. Files you own

```
backend/app/main.py config.py db.py models.py schemas.py security.py deps.py seed.py
backend/app/routers/auth.py submissions.py findings.py review.py knowledge.py admin.py insights.py
backend/app/services/workflow.py audit_orchestrator.py insights_service.py
backend/app/engine/types.py normalize.py rules.py facts.py regions.py retrieval.py evidence.py evaluate.py
backend/app/llm/adapter.py            ← STUB ONLY (Ayush replaces it in his branch)
backend/tests/*  backend/requirements.txt  backend/.env.example
data/seed/*.json  data/testset/testset.json
.github/workflows/ci.yml keepalive.yml   README.md
```
Never edit `frontend/*` or real `llm/*` code. Ask Ayush via PR comment.

---

## 4. Contract snapshot (what Ayush builds against)

If this conflicts with `02_PROTOTYPE_BUILD_PLAN.md` §6, `02` wins. Change the contract only by PR touching `02` and the Pydantic models together.

**Errors:** `{"error": {"code": "STRING", "message": "text", "details": {}}}`
**Auth:** `Authorization: Bearer <jwt>`. Roles: `creator, agency, reviewer, brand_manager, admin`.

| Method + path | Roles | Notes |
|---|---|---|
| `GET /api/health` | public | `{status, db, llm_enabled, version}` |
| `POST /api/auth/login` | public | `{email,password}` → `{token,user}` |
| `GET /api/auth/me` | any | |
| `GET /api/samples` | creator, agency | seeded drafts |
| `GET /api/submissions` | any (scoped) | creator/agency: own; others: all |
| `POST /api/submissions` | creator, agency | `{title,content_type,body}` → submission + v1 (no audit) |
| `GET /api/submissions/{id}` | scoped | submission, versions, latest findings, reviews, comments |
| `POST /api/submissions/{id}/audit` | owner | audit latest version → AuditResult |
| `POST /api/submissions/{id}/versions` | owner | `{body}` → new version + AuditResult (409 if approved) |
| `PATCH /api/findings/{id}` | owner, brand_manager | `{resolution, reason?}` |
| `POST /api/submissions/{id}/submit` | owner | gate: no open critical/high |
| `POST /api/submissions/{id}/decision` | reviewer, brand_manager | `{decision: approve|request_revision, comment, override_reason?}` |
| `POST /api/submissions/{id}/comments` | scoped | `{body}` (SHOULD) |
| `GET /api/knowledge/rules`, `/facts` | reviewer, brand_manager, admin (agency redacted) | |
| `POST/PUT /api/knowledge/{rules|facts}[/{id}]` | brand_manager, admin | PUT bumps `last_reviewed` |
| `POST /api/knowledge/{rules|facts}/{id}/retire` | brand_manager, admin | |
| `GET /api/knowledge/evidence/{id}` | any authenticated | full record; agency redacted |
| `GET /api/insights/recurring` | reviewer, brand_manager, admin | |
| `GET /api/admin/audit-log` | admin, brand_manager | no content stored |
| `POST /api/admin/reset-demo` | admin | only if `DEMO_MODE=true` |

**AuditResult**
```json
{"submission_id":17,"version_id":5,"version":1,
 "engines":{"rules":"ran","llm":"unavailable","llm_reason":"timeout"},
 "summary":{"critical":1,"high":1,"medium":1,"low":0,"total":3},
 "findings":[ Finding ]}
```
`engines.llm` ∈ `ran | disabled | unavailable | discarded`.

**Finding**
```json
{"id":101,"issue_id":"F-2","version_id":5,"category":"factual","severity":"critical",
 "excerpt":{"text":"available across the US","start":38,"end":61},
 "explanation":"The approved availability record lists India and the UK only.",
 "evidence":{"id":"AF-014","kind":"fact","label":"Availability: Lumora Smart Lamp","last_reviewed":"2026-09-01"},
 "suggested_correction":"available in India and the UK",
 "verification_status":"confirmed_contradiction","source_engine":"rules",
 "resolution":"open","resolution_reason":null}
```
Enums: `category` terminology|factual|claim|tone|accessibility|visual; `severity` critical|high|medium|low; `verification_status` confirmed_contradiction|unsupported_claim|style_issue|needs_human_verification; `resolution` open|accepted|edited|dismissed; submission `status` draft|in_review|approved|revision_requested.

**Offsets:** Python Unicode code points, `end` exclusive, relative to `versions.body`.

**Gates:** submit blocked if the latest version has an open critical/high finding (`422 CANNOT_SUBMIT_OPEN_FINDINGS`); dismiss needs a reason, critical cannot be dismissed (`422 CANNOT_DISMISS_CRITICAL`); approving with open critical findings needs `override_reason`; approved submissions are locked (`409 SUBMISSION_LOCKED`); wrong role `403 FORBIDDEN`. Dismissals carry over when the same `(evidence_id, normalized excerpt)` reappears in the next version.

---

## 5. Task checklist with checkpoints

### G0 — T+0 → T+2 (hard stop; Ayush is waiting on this)
- [ ] Repo, `main`, `develop`, branch protection, `.gitignore`, `.env.example`
- [ ] FastAPI app, CORS from env, `/api/health`, error-shape handler
- [ ] **All endpoints above return mock JSON** with real Pydantic response models (so OpenAPI is accurate)
- [ ] `llm/adapter.py` stub: `review(body, ctx) -> LLMResult("disabled", None, [])`
- [ ] Register every router in `main.py` now (even empty files) so later PRs don't conflict there
- [ ] CI running ruff + pytest; Render deploy live; Postgres project created (pooler URL in Render env)
- [ ] Tell Ayush: API URL, Vercel origin for CORS, seed users

### G1 — T+2 → T+8
- [ ] `normalize.py` (1:1 mapping), `rules.py` (phrase/term/claim), `regions.py`, `facts.py` availability
- [ ] Pytest that reproduces Round 1 sample exactly: F-1 `CLAIM-01` (11–23), F-2 `AF-014` (38–61), F-3 `TERM-03`
- [ ] `models.py`, `db.py`, `security.py`, `deps.py`, `seed.py` (Lumora data from `02` §10), auth router
- [ ] Submissions router real (create/list/get), `/samples`; audit endpoint uses temporary fake if orchestrator not ready (`# TEMP-G1`)
- [ ] Prod on Postgres, data survives a restart

### G2 — T+8 → T+18
- [ ] Orchestrator v1/v2: normalize → rules → facts → retrieve → `llm.adapter.review` (safe wrapper) → validate/merge → carry-over → persist → audit_log
- [ ] Workflow gates, PATCH findings, submit, decision (+ override), versions endpoint
- [ ] Tone rules, substantiation suppression (`SUB-01`), price/battery detectors, outdated-fact handling, `retrieval.py`, `evidence.py`
- [ ] Knowledge CRUD + evidence endpoint (agency redaction), admin audit-log, reset-demo
- [ ] Scenario test of the whole Round 1 §6.1 journey; remove `TEMP-G1`
- [ ] 403 matrix tests (role × endpoint); deploy `main`

### G3 — T+18 → T+30
- [ ] Insights service + endpoint; script to seed ~10 varied submissions for a non-empty demo
- [ ] Test set (40–60 items), independent labelling with Ayush (45 min), `evaluate.py`, `docs/eval_results.json`
- [ ] Hardening: body size cap, login rate limit, no content in logs (test), `SAVE_FAILED` rollback path, ReDoS/long-input tests
- [ ] Keep-alive cron verified in Actions; load sanity check (20 audits)

### G4 — T+30 → T+40 (feature freeze at T+34)
- [ ] README (5-command local run, env vars, demo accounts, architecture)
- [ ] PDF technical sections: architecture, data flow, schema, engine, security, test results with the optimistic-bias caveat, limitations
- [ ] Bug-bash on production in a private window

---

## 6. Key signatures (keep identical so branches plug together)

```python
# engine/types.py
@dataclass
class RawFinding:
    category: str; severity: str; start: int; end: int; excerpt_text: str
    explanation: str; evidence_id: str; evidence_kind: str   # "rule" | "fact"
    suggestion: str | None; verification_status: str; source_engine: str  # "rules" | "llm"

@dataclass
class ContextPack:
    rules: list[dict]; facts: list[dict]; ids: set[str]

# llm/adapter.py (Ayush's real one replaces your stub; signature must not change)
@dataclass
class LLMResult:
    status: Literal["ran","disabled","unavailable","discarded"]
    reason: str | None
    findings: list[RawFinding]
def review(body: str, ctx: ContextPack) -> LLMResult: ...   # never raises

# services/audit_orchestrator.py
def run_audit(db: Session, version: Version) -> AuditResult: ...
```

---

## 7. Merge and submission protocol (you are the integrator)

Individual work first; integration after both of you are feature-complete (target G3, T+30), but **merge to `develop` at each gate** so integration is never a surprise.

**Before opening any PR:** `git fetch && git rebase origin/develop` (or merge develop into your branch), CI green, your own tests green.

**Final merge order** (backend first so Ayush regenerates types against the real API):

1. `sagar/backend-core` → `develop` (PR, Ayush reviews or you self-merge if he is asleep and CI is green)
2. `sagar/audit-engine` → `develop`; remove all `TEMP-G1` code
3. `ayush/frontend-workspace` → `develop`
4. `ayush/review-ai-insights` → `develop`
5. After each merge: run the smoke test (below). Fix forward on `develop`, small commits.
6. `develop` → `main` with a PR titled `Round 2 release`; tag `v1.0-round2`. Render and Vercel deploy from `main`.

**Known conflict hotspots (decide up front):** `main.py` router registration (pre-registered at G0), `requirements.txt` and `package.json` (resolve by taking the union and re-running install), frontend route table `App.tsx` (Ayush owns; the second branch only adds lines).

**Smoke test on production (private window, backend cold):**
1. Quick-login Creator → sample → Check → 3 findings with the Round 1 IDs
2. Evidence drawer opens `AF-014`
3. Apply suggestions → recheck → 0 open → Send for review
4. Reviewer approves → creator sees "Approved"
5. Audit log shows login/audit/submit/approve; Insights non-empty
6. Run again with `LLM_ENABLED=false` and with a wrong key: banner shows, core flow unaffected
7. Wrong-role curl to 3 protected endpoints returns 403

**Submission (you fill the form, Ayush proofreads):**
- [ ] Working project link (Vercel URL) opened on mobile data
- [ ] Repository link (public, no secrets in history, README, `.env.example`)
- [ ] Updated PDF (outline in `01_MASTER_PLAN.md` §7)
- [ ] Completed features list (built / partial / deferred, with screen or route)
- [ ] Technology and implementation details
- [ ] Changes from original plan (Postgres in prod, role merge, critical-not-dismissable, LLM statuses restricted, image/document checks deferred)
- [ ] Three Round 3 improvements (ingestion, visual/accessibility checks, semantic retrieval + guideline-gap analytics)
- [ ] Submit by **28 Oct 07:00 IST**; confirmation screenshot saved

---

## 8. Done when

- [ ] All routes implemented with the specified codes; 403 matrix green
- [ ] Round 1 example reproduced exactly; every deterministic finding resolves to a stored record
- [ ] LLM off/failing → identical deterministic findings and correct `engines` status
- [ ] Production on Postgres, survives restart; seed idempotent
- [ ] Evaluation numbers saved and honestly caveated
- [ ] No secrets in git; CI green on `develop` and `main`

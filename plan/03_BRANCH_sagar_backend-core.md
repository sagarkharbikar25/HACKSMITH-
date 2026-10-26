# Branch 1 of 4 — `sagar/backend-core` (Sagar)

**Mission:** the platform underneath everything: database, auth, submissions/versions, workflow gates, review decisions, knowledge-base CRUD, admin, seed data, CI and deployment. If this branch is late, nobody can integrate, so it front-loads work in the first 8 hours.

Read first: `02_PROTOTYPE_BUILD_PLAN.md` §4 (schema), §5 (state machine), §6 (contract), §9 (roles), §10 (seed).

**Base:** `develop`  **Merges into:** `develop` at G0, G1, G2, G3  **Estimated effort:** ~14 h

---

## 1. Files you own

```
backend/app/main.py  config.py  db.py  models.py  schemas.py  security.py  deps.py  seed.py
backend/app/routers/auth.py submissions.py findings.py review.py knowledge.py admin.py
backend/app/services/workflow.py
backend/app/llm/adapter.py          (STUB ONLY at G0; Ayush replaces it in his branch)
backend/tests/test_auth.py test_workflow.py test_roles.py test_knowledge.py
backend/requirements.txt  backend/.env.example
data/seed/*.json
.github/workflows/ci.yml  keepalive.yml
README.md
```
You do **not** edit: `engine/*`, `services/audit_orchestrator.py`, `insights*` (branch 2), `frontend/*`, `llm/*` beyond the stub (Ayush).

---

## 2. Task list (in order)

### Phase 0 — G0 (T+0 → T+2): unblock everyone
- [ ] Repo, `main`/`develop`, branch protection (PR required on `main`), `.gitignore` (`.env`, `*.db`, `node_modules`, `__pycache__`).
- [ ] FastAPI app factory, CORS from env, `/api/health`, global exception handler producing the `{"error": {...}}` shape.
- [ ] **Every endpoint in the contract exists and returns mock JSON** shaped exactly like `02` §6 (use Pydantic response models so OpenAPI is accurate). Ayush generates TS types from this.
- [ ] `llm/adapter.py` stub returning `LLMResult("disabled", None, [])`, plus the dataclasses in `engine/types.py`? (No: `engine/types.py` is branch 2. Put a temporary copy of `RawFinding`/`ContextPack` in `schemas.py`; branch 2 moves it at G1.)
- [ ] CI workflow running `ruff` + `pytest`.
- [ ] Deploy to Render with SQLite; confirm `/api/health` is reachable from the internet.
- [ ] Create the Postgres project (Supabase/Neon), save the **pooler** connection string in Render env.

### Phase 1 — G1 (T+2 → T+8): real storage and auth
- [ ] `models.py` for all tables in `02` §4 (SQLAlchemy 2.0 declarative). `created_at` defaults. Enums as strings with validation in Pydantic.
- [ ] `db.py`: engine from `DATABASE_URL`, `pool_pre_ping=True`, session dependency, `create_all` on startup (no Alembic; a 48-hour build does not need migrations).
- [ ] `security.py`: password hashing (`passlib[bcrypt]` or `argon2`), JWT create/verify. `deps.py`: `get_current_user` loads the user **from the DB** each request, and `require_roles(...)`.
- [ ] `seed.py`: idempotent upserts from `data/seed/*.json` (users, rules, facts, assets, sample drafts). Runs at startup. Write the Lumora data exactly as in `02` §10.
- [ ] `routers/auth.py`: login, me. Write `login` audit entry.
- [ ] `routers/submissions.py`: create (writes version 1), list (scoped by role), get (with versions, latest findings, reviews). **Audit and versions endpoints call `audit_orchestrator.run_audit`**: until branch 2 delivers, use a tiny in-file fake that returns the 3 Round 1 findings when the body contains "world's best" so Ayush can build the UI. Mark it `# TEMP-G1` and remove at G2.
- [ ] `GET /samples`.
- [ ] Tests: login success/failure, ownership scoping, version numbering.

**G1 PR checklist:** swagger shows real models; creator can create a submission and get mock findings; DB tables created on Postgres in prod.

### Phase 2 — G2 (T+8 → T+18): workflow, review, knowledge base
- [ ] `services/workflow.py`: the state machine and gates from `02` §5 as small pure functions + a service layer that writes `audit_log`. Functions: `can_submit(version, findings)`, `resolve_finding(...)`, `submit(...)`, `decide(...)`.
- [ ] `POST /submissions/{id}/versions`: creates the next version (409 if approved), sets status to `draft` if it was `revision_requested`, calls `run_audit`, returns the audit result.
- [ ] `PATCH /findings/{id}`: resolution + reason; owner or brand_manager only; `CANNOT_DISMISS_CRITICAL`.
- [ ] `POST /submissions/{id}/submit` and `/decision` with the gates, `override_reason` rule, `reviews` row, status update, audit log.
- [ ] `routers/knowledge.py`: list/create/update/retire for rules and facts (validate pattern JSON shapes per rule type), `GET /knowledge/evidence/{id}` (agency redaction: replace `statement`/`structured_value` with a placeholder), `PUT` bumps `last_reviewed`.
- [ ] `routers/admin.py`: `GET /admin/audit-log`, `POST /admin/reset-demo` guarded by `DEMO_MODE`.
- [ ] Remove the `TEMP-G1` fake once branch 2's orchestrator is merged (coordinate at G2).
- [ ] Tests: every gate (open critical blocks submit, dismiss critical rejected, approve w/o override rejected when critical open, locked after approval), the 403 matrix for all roles × endpoints (parametrised).

**G2 PR checklist:** the whole Round 1 §6.1 journey passes in a pytest "scenario test" using the real engine; deploy `main`.

### Phase 3 — G3 (T+18 → T+30): hardening
- [ ] Rate-limit login attempts lightly (in-memory is fine) and cap request body size (e.g. 20 000 chars per draft; return `413`/`422` with a clear message).
- [ ] Structured logging of `event, user_id, route, status, duration_ms`. **No bodies, no prompts, no tokens.** Add a test that greps captured logs for a sample draft text.
- [ ] Add `comments` endpoint (SHOULD).
- [ ] Keep-alive workflow, verified by a real run in the Actions tab.
- [ ] DB failure path: wrap writes so a failure returns `500` `{"code":"SAVE_FAILED","message":"Could not save. Your text is preserved. Try again."}` (rolled back). Test it with a forced exception.
- [ ] Load sanity check: 20 sequential audits on prod, check no 5xx and latency.

### Phase 4 — after G3: pull shared work
- [ ] Run the labelled-test evaluation (branch 2) on production data, save results.
- [ ] Draft the technical sections of the Round 2 PDF (architecture, data flow, schema, security controls, deployment).
- [ ] Final `README.md`: what it is, live URL, demo accounts, run locally in 5 commands, env vars, architecture diagram, link to PDF.

---

## 3. What you provide to others

| To | What | When |
|---|---|---|
| Ayush (frontend) | OpenAPI with accurate models and mock responses | G0 |
| Ayush (frontend) | Real submissions/audit endpoints, auth | G1 |
| Ayush (LLM) | `llm/adapter.py` stub + `LLMResult`/`ContextPack` dataclasses location | G0 |
| Branch 2 (yourself) | Tables for `findings`, `rules`, `facts`, `audit_log`; `get_db` dependency | G1 (do this first, before engine work) |

## 4. What you consume

- `services/audit_orchestrator.run_audit(db, version) -> AuditResult` from `sagar/audit-engine` (G1/G2).
- `llm.adapter.review(...)` from Ayush (G2/G3).

---

## 5. Definition of done

- [ ] All endpoints in `02` §6 implemented with the specified status codes and error codes.
- [ ] 403 matrix test green; no route relies on the UI for access control.
- [ ] Seed idempotent: restart twice, counts unchanged, user submissions untouched.
- [ ] Production on Postgres, survives a Render restart with data intact.
- [ ] No secrets in git history; `.env.example` complete.
- [ ] CI green on `develop` and `main`.

## 6. Branch hygiene

Commit style: `feat(auth): jwt login`, `fix(workflow): block dismiss on critical`. Push hourly. Open the PR at each gate with the checklist above in the description. If Ayush asks for a contract change, change `02` and the Pydantic model **in the same PR**, ping him, and he regenerates types.

## 7. Risks specific to this branch

| Risk | Mitigation |
|---|---|
| Supabase direct connection fails from Render (IPv6) | Use the pooler URL from the start; test at G0, not at G2 |
| Seed overwrites reviewer edits to the KB | Upsert only if the record does not exist (or `seed_version` is newer); never touch records with `last_reviewed` set by a user |
| Token claims out of date after role change | Load the user from DB each request, don't trust the role claim alone |
| Mock responses drift from real ones | Real endpoints replace mocks one at a time; Pydantic models are shared, so shape cannot drift |

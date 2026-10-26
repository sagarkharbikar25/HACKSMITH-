# Branch 3 of 4 — `ayush/frontend-workspace` (Ayush)

**Mission:** everything a **creator** (and agency) sees, plus the app foundation the other front-end branch builds on: shell, auth, API client, generated types, error/empty states, and the highlighted-text editor with findings. This is the first screen every judge touches, so it carries most of the 10 usability points and a big part of the 30-point workflow score.

Read first: `02_PROTOTYPE_BUILD_PLAN.md` §0 (definition of done), §5 (gates), §6 (contract), §11 (frontend map), §12 (env).

**Base:** `develop`  **Merges into:** `develop` at G0, G1, G2, G3  **Estimated effort:** ~16 h
**Depends on:** Sagar's OpenAPI (G0 mocks, G1 real). You can work against mocks from hour 2.

---

## 1. Files you own

```
frontend/ (entire app scaffold)
frontend/src/api/client.ts  auth.ts  submissions.ts  findings.ts
frontend/src/types/api.d.ts            (generated, do not hand-edit)
frontend/src/auth/    AuthContext.tsx  ProtectedRoute.tsx  roles.ts
frontend/src/components/  AppShell RoleBadge StatusBadge SeverityChip EngineStatusBar
                          HighlightedText FindingCard EvidenceDrawer VersionTimeline
                          EmptyState ErrorBanner ServerWakingScreen Stepper
frontend/src/pages/   Login.tsx  Workspace.tsx  SubmissionDetail.tsx  HowToEvaluate.tsx
frontend/src/lib/     codepoints.ts  format.ts
```
Branch 4 (`ayush/review-ai-insights`) **adds** pages `Review*`, `Knowledge`, `Insights`, `AdminAudit` and uses your shell/components. Don't edit its files; it won't edit yours. Shared components you need to change for it: change them yourself on request.

---

## 2. Task list (in order)

### Phase 0 — G0 (T+0 → T+2)
- [ ] `npm create vite@latest frontend -- --template react-ts`; Tailwind; React Router; TanStack Query; `openapi-typescript` as a dev dependency with an npm script `gen:api`.
- [ ] Env: `VITE_API_URL`. A single `client.ts` with `fetch` wrapper: bearer token, JSON, maps the `{"error":{code,message}}` shape to a typed `ApiError`.
- [ ] Deploy "hello" to Vercel including the SPA rewrite (`vercel.json` rewrites all to `/index.html`). Call `/api/health` and show the result.
- [ ] Mock mode: `VITE_MOCK_API=true` makes `client.ts` return fixtures (copy the JSON in `02` §6), so you are never blocked on the backend.

### Phase 1 — G1 (T+2 → T+8): login → create → check → highlights
- [ ] `ServerWakingScreen`: if `/health` takes > 3 s or fails, show "Waking up the server (free tier, ~30–60 s)…" with auto-retry every 3 s and a spinner; then continue.
- [ ] `Login`: five quick-login buttons (Creator, Agency, Reviewer, Brand Manager, Admin) that call login with the demo credentials, plus a small manual form. Persist token in memory + `sessionStorage` (not `localStorage` with long expiry; judges share browsers).
- [ ] `AuthContext` and `ProtectedRoute` by role; role-based redirect from `/`.
- [ ] `AppShell`: header with product name, current user + role badge, role-aware nav, logout, link to `HowToEvaluate`.
- [ ] `Workspace`: list "My submissions" (status badge, updated time), **"Try the sample draft"** button (loads `GET /samples`, creates a submission with the Lumora caption, navigates to it), "New draft" form (title, content type, body).
- [ ] `SubmissionDetail` v1: editor (textarea) + **Check** button → `POST /submissions/{id}/audit` → `HighlightedText` with colored spans by severity, findings list beside it.
- [ ] `lib/codepoints.ts`: helpers to slice by **code points** (`Array.from(text)`), since backend offsets are code points. Unit-test it with an emoji string.
- [ ] `FindingCard`: severity chip, category, excerpt, explanation, evidence ID (button), suggested correction, source chip ("Rules" / "AI-suggested"), status label ("Confirmed contradiction", "Unsupported claim — needs verification", "Style issue", "Needs human verification"). Wording must never say an unsupported claim is false.

**G1 PR checklist:** Quick-login as creator → sample → Check → ≥2 highlighted findings with evidence IDs on the deployed site.

### Phase 2 — G2 (T+8 → T+18): the full creator journey
- [ ] `EvidenceDrawer`: click an evidence ID → `GET /knowledge/evidence/{id}` → shows the stored rule/fact text, status, `last_reviewed`; warn if outdated.
- [ ] **Apply suggestion** (per finding) replaces that excerpt in the editor using code-point offsets and marks the finding as accepted locally; **Apply all**; **Dismiss** opens a reason field (disabled with a tooltip for `critical`; server enforces too); editing manually is also fine.
- [ ] **Save & recheck** → `POST /submissions/{id}/versions` → render the new audit result, push a new row into `VersionTimeline`. Persist resolutions with `PATCH /findings/{id}` (accepted/edited/dismissed) before saving the version.
- [ ] `Stepper` on the submission: Draft → Checked → Sent for review → Decision. Status is always visible.
- [ ] **Send for review** button: disabled with a clear message while the latest version has open critical/high findings (listing which); calls `/submit`; then shows "In review" read-only state.
- [ ] Show reviewer decision and comment when `revision_requested` or `approved`; for `revision_requested`, the editor is editable again and the next save makes a new version.
- [ ] `EngineStatusBar` under every audit: "Rules: ran · AI review: ran / not available (reason) / discarded", plus the banner "AI review did not run. Rule-based results only." when needed.
- [ ] Error states: network down, 401 (redirect to login), 403 (friendly "not allowed for your role"), 422 gate errors (render server message), `SAVE_FAILED` ("Could not save. Your text is preserved. Try again." and keep the textarea content).
- [ ] Empty states for every list with a clear next action.

**G2 PR checklist:** the Round 1 §6.1 journey works in the browser on production up to "In review", including recheck → 0 open findings.

### Phase 3 — G3 (T+18 → T+30): usability polish
- [ ] `HowToEvaluate` page/drawer: the 6-click journey, demo accounts, what each role can do.
- [ ] Version compare: show previous version's body and which findings were cleared (simple side-by-side or toggle).
- [ ] Keyboard and accessibility basics that match the Round 1 promise (WCAG 2.2 AA as a target): labels on inputs, visible focus, not color-only severity (icon + text), contrast checked with a browser tool, buttons have text. Don't claim conformance in the PDF; say "targeted, partially tested".
- [ ] Responsive layout down to ~375 px (judges may open on a phone): stack editor above findings.
- [ ] Loading skeletons for audits; disable buttons while requests run (no double submit).
- [ ] Test: run the whole journey in a private window on a phone with the backend asleep.

### Phase 4 — Final
- [ ] Capture 8 annotated screenshots for the PDF (login, sample loaded, findings, evidence drawer, recheck clean, in-review, reviewer decision, banner when AI off).
- [ ] Record the 2.5-minute demo (script in master plan §10).

---

## 3. UX details that matter for scoring

- Highlight rendering: split the body at finding boundaries into segments; overlapping findings: render the higher severity on top and keep every finding clickable from the list. Clicking a highlight scrolls and flashes the matching card.
- Never use red/green alone. Severity chips: Critical, High, Medium, Low with icons.
- Keep copy plain: "Suggested fix" not "remediation".
- Don't block judges on login: quick-login buttons, visible demo password.
- The first-load path: Vercel loads instantly, backend may take a minute. The waking screen is **mandatory** (this is the #1 way to lose usability points).

## 4. What you provide

| To | What | When |
|---|---|---|
| Branch 4 | `AppShell`, `ProtectedRoute`, `client.ts`, shared components (`StatusBadge`, `SeverityChip`, `EvidenceDrawer`, `EngineStatusBar`, `EmptyState`, `ErrorBanner`) | G1 |
| Sagar | Bug reports with request/response samples; confirmations of contract changes | continuous |
| PDF | Screenshots, UI feature list | G4 |

## 5. What you consume

- OpenAPI/types from backend-core (`npm run gen:api`).
- Audit results from the engine through the same endpoints.

---

## 6. Definition of done

- [ ] Whole creator journey on production, from a cold browser, without explanation.
- [ ] No hand-written API types; `tsc --noEmit` clean; `vite build` green in CI.
- [ ] Offsets verified with emoji and curly quotes (unit test + manual).
- [ ] Every error code in `02` §5/§6 has a friendly message.
- [ ] Works at 375 px width and with the backend cold-starting.

## 7. Risks specific to this branch

| Risk | Mitigation |
|---|---|
| Highlight drift due to UTF-16 vs code points | `Array.from` helpers + unit test |
| Waiting on backend | `VITE_MOCK_API` mode from hour 2 |
| Textarea editing breaks highlights | Edit mode vs review mode: highlight in a read-only overlay; after any edit, clear highlights until recheck (state "Out of date, recheck") |
| State bugs across apply/dismiss/save | Keep server as source of truth; refetch the submission after each mutation via TanStack Query invalidation |
| Merge conflicts with branch 4 | You own shell and shared components; branch 4 only adds pages. Change shared components on a request issue, small PRs |
| CORS errors on first deploy | Agree the exact Vercel URL with Sagar at G0 |

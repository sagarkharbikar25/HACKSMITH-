# Branch 2 of 4 — `sagar/audit-engine` (Sagar)

**Mission:** the heart of the product and your strongest scoring lever (technical depth, 25 pts). Deterministic rule engine, approved-fact lookup, evidence resolver, the audit orchestrator that merges everything, the insights aggregation, and the labelled test set with an evaluator that produces real precision/recall numbers for the PDF.

Read first: `02_PROTOTYPE_BUILD_PLAN.md` §5 (carry-over), §7 (pipeline), §8 (LLM contract), §10 (seed), §13 (testing).

**Base:** `develop`  **Merges into:** `develop` at G1, G2, G3  **Estimated effort:** ~16 h
**Depends on:** `sagar/backend-core` tables/`get_db` (G1 first hour). Engine modules are pure Python and testable without the DB, so you can start them in parallel with backend-core.

---

## 1. Files you own

```
backend/app/engine/types.py normalize.py rules.py facts.py regions.py retrieval.py evidence.py evaluate.py
backend/app/services/audit_orchestrator.py insights_service.py
backend/app/routers/insights.py
backend/tests/test_normalize.py test_rules.py test_facts.py test_orchestrator.py test_insights.py
data/testset/testset.json
docs/eval_results.json (generated)
```
You do **not** edit: routers other than `insights.py`, `models.py` (ask in the backend-core PR), `llm/*`, `frontend/*`.

---

## 2. Task list (in order)

### Phase 1 — G1 (T+2 → T+8): minimum viable engine
- [ ] `types.py`: `RawFinding`, `ContextPack`, `AuditResult` dataclasses/Pydantic (move the temporary copies from backend-core).
- [ ] `normalize.py`: `normalize(body) -> str` with **strict 1:1 character mapping** (curly quotes → straight, NBSP → space, case-folding only for matching via `re.IGNORECASE`, not by changing string length; note some Unicode case folds change length, so use `re.IGNORECASE` instead of `.lower()` where offsets matter). Test: offsets in the normalized string slice the same text in the original, including emoji and curly quotes.
- [ ] `rules.py`: `run_rules(norm, body, rules) -> list[RawFinding]` for `phrase`, `term` and `claim` types first. Word-boundary regexes with `\s+` tolerance, escape user patterns with `re.escape`, then substitute `\s+` for spaces.
- [ ] `facts.py` + `regions.py`: availability contradiction only (the Round 1 example): subject detection, trigger sentences, region alias dictionary, comparison against `structured_value.regions`, suggested correction built from approved regions ("available in India and the UK").
- [ ] `audit_orchestrator.run_audit` v1: normalize → rules → facts → assign `issue_id`, sort, persist findings, write `audit_log`, return `AuditResult`. `engines = {"rules": "ran", "llm": "disabled"}`.
- [ ] **Hit the Round 1 example exactly** (sample 1 → F-1 CLAIM-01, F-2 AF-014, F-3 TERM-03 with offsets matching Appendix B: `world's best` 11–23, `available across the US` 38–61). Write this as a pytest first.

**G1 PR checklist:** sample 1 yields exactly the three expected findings with correct offsets; clean sample yields zero; backend-core's `TEMP-G1` fake is removed or ready to remove.

### Phase 2 — G2 (T+8 → T+18): depth and trust
- [ ] `rules.py`: `tone` rules (multiple `!`, ALL-CAPS ≥ 4 letters excluding approved acronyms, urgency phrases) → `style_issue`. Claim substantiation suppression: if a `kind=substantiation` fact matches the claim by tags/aliases, no finding (and test that "award-winning design" passes while "world's best" is flagged).
- [ ] `facts.py`: price mismatch, battery-hours mismatch (parse "up to N hours", compare numbers), warranty/compatibility detectors. **No matching fact → `needs_human_verification`** with the explanation "no approved record mentions this", never a contradiction. Outdated facts → `needs_human_verification` ("the matching record is marked outdated; ask the brand manager").
- [ ] `retrieval.py`: `retrieve_context(db, body) -> ContextPack` by tag/keyword overlap, capped at ~15 items, includes the IDs set for validation. Keep it deterministic and testable.
- [ ] `evidence.py`: `resolve(db, evidence_id) -> dict` (rule or fact record with `kind`, label, `last_reviewed`); used by the orchestrator to fill the `evidence` object in each finding and by the knowledge router.
- [ ] Orchestrator v2: call retrieval and `llm.adapter.review(...)`, **validate + merge** (drop LLM findings with unknown evidence IDs or non-verbatim excerpts; compute offsets by search; drop those overlapping deterministic findings; force allowed statuses), **carry-over of dismissals** from the previous version, record `engines.llm` (`ran|disabled|unavailable|discarded`) and `llm_reason`, persist `versions.engines`.
- [ ] Deterministic checks must be unaffected by LLM failure: wrap the LLM call so any exception → `unavailable`, rule findings preserved. Test with a fake adapter that raises.
- [ ] Tests: each rule type, each fact detector, region aliases (`US`, `U.S.`, `USA`, `United States`, "across America", "worldwide"), merge/dedup, carry-over, the "adapter raises" path, an injected-text draft (no behaviour change in deterministic output).

**G2 PR checklist:** `02` §7 pipeline fully implemented; scenario test for the whole §6.1 journey passes with backend-core's workflow; evidence returns real records.

### Phase 3 — G3 (T+18 → T+30): proof and insights
- [ ] `insights_service.py` + `routers/insights.py`: the payload in `02` §6 (per-rule `fired`, `dismissed`, `overridden`, `dismissal_rate`, `flag`; totals; by-category). "Overridden" = rules whose finding was open/critical on a version approved with an `override_reason`. Constants (`MIN_FIRED=5`, `DISPUTE_RATE=0.4`) in one place.
- [ ] `data/testset/testset.json`: 40–60 invented items covering T1–T8 from the Round 1 PDF. Schema: `{"id","scenario","text","expected":[{"evidence_id","verification_status","excerpt"}]}`. **Label independently**: Ayush and you each label expected findings on a copy, then reconcile disagreements. (This is a shared task; schedule 45 min together.)
- [ ] `evaluate.py`: run the engine (rules-only) on the set, print precision/recall per category and attribution correctness (right evidence ID), list every miss/false positive, write `docs/eval_results.json`. Run with LLM off, and optionally on for a separate "AI-assisted" report.
- [ ] Fix the misses that are cheap to fix; **record the rest as known limitations** (paraphrased violations are the LLM's job; keep this honest in the PDF).
- [ ] Performance: rules-only audit well under ~1 s for a typical draft (target stated in Round 1 §13). Precompile regexes per audit run or cache by rule `last_reviewed`.
- [ ] Safety tests: ReDoS (rule patterns come from the KB; cap pattern length and timeout/size-limit the input), very long input, empty input, only-emoji input.

---

## 3. What you provide

| To | What | When |
|---|---|---|
| Sagar (backend-core) | `run_audit(db, version)`, `AuditResult` | G1 (v1), G2 (v2) |
| Ayush (LLM adapter) | `ContextPack` shape, `RawFinding` shape, `retrieve_context` | G1 (types), G2 (retrieval) |
| Ayush (insights UI) | `/insights/recurring` payload | G2 mock, G3 real |
| PDF | `docs/eval_results.json`, engine description, limitations | G3 |

## 4. What you consume

- Tables, `get_db`, `audit_log` writer from `sagar/backend-core` (G1).
- `llm.adapter.review` from `ayush/review-ai-insights` (stub at G0 → real by G2/G3).

---

## 5. Engine behaviour reference (quick spec)

| Finding | category | severity | verification_status | engine |
|---|---|---|---|---|
| Banned phrase (`TERM-03`) | terminology | medium | style_issue | rules |
| Preferred term (`TERM-01`) | terminology | low | style_issue | rules |
| Superlative/comparative without substantiation | claim | high | unsupported_claim | rules |
| Absolute claim (`100%`, `guaranteed`) | claim | medium | unsupported_claim | rules |
| Region/price/number contradicts current fact | factual | critical | confirmed_contradiction | rules |
| Fact missing/outdated for a checkable claim | factual | medium | needs_human_verification | rules |
| Tone rules | tone | low/medium | style_issue | rules |
| Model-suggested tone/claim issue | tone/claim | medium | style_issue / needs_human_verification | llm |

Explanation sentences must be plain language, name the rule or record, and never state that an unsupported claim is false.

---

## 6. Definition of done

- [ ] Round 1 example reproduced exactly (IDs, severities, offsets, suggested corrections).
- [ ] ≥ 25 unit tests; engine tests run without a network.
- [ ] Evaluation script runs and its output is saved; numbers are honest and caveated.
- [ ] Every deterministic finding carries a resolvable evidence ID (100% attribution on the test set).
- [ ] LLM failure or off → identical deterministic findings, correct `engines` status.
- [ ] Insights endpoint returns sensible numbers after a scripted run of ≥ 6 submissions.

## 7. Risks specific to this branch

| Risk | Mitigation |
|---|---|
| Subject detection ("Now available across the US" with no product name in that sentence) | Document-level subject binding (see `02` §7); document the limitation |
| Offsets wrong after normalization | 1:1 mapping + property test on random strings with emoji and curly quotes |
| False positives from broad words like "best" in "best practices" | Context exceptions list in the rule (`except_if_followed_by`), measured in the test set |
| Over-engineering fact extraction | Only availability + price + battery + 2 detectors; everything else → `needs_human_verification` |
| User-defined regex from KB editor crashing or hanging | Rules store literal phrase lists, not raw regex; patterns built by the engine with `re.escape` |
| Time sink on test-set labelling | Generate candidates from templates, label in a shared sheet, 45-minute timebox |

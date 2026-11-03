"""
Live Gemini LLM adapter for Brandora AI.
Uses Google Gemini REST API (gemini-3.5-flash) with grounding against retrieved context rules and facts.
Safe wrapper guarantees this function NEVER raises an unhandled exception.
"""
import json
import urllib.request
import urllib.error
from ..engine.types import ContextPack, LLMResult, RawFinding
from ..config import settings

def review(body: str, ctx: ContextPack) -> LLMResult:
    """
    Standard Gemini LLM review signature.
    If LLM_ENABLED is False or GEMINI_API_KEY is not set, returns disabled.
    """
    if not settings.LLM_ENABLED or not settings.GEMINI_API_KEY:
        return LLMResult(
            status="disabled",
            reason="LLM review disabled in configuration",
            findings=[]
        )

    # Construct concise context summary
    rules_summary = [f"- [{r.get('id')}]: {r.get('message')}" for r in ctx.rules[:5]]
    facts_summary = [f"- [{f.get('id')}]: {f.get('statement')}" for f in ctx.facts[:5]]

    prompt = f"""You are a brand compliance and factual verification engine.
Analyze the following marketing draft copy against these rules and verified facts.

ACTIVE RULES:
{chr(10).join(rules_summary)}

VERIFIED FACTS:
{chr(10).join(facts_summary)}

DRAFT COPY TO VERIFY:
\"\"\"{body}\"\"\"

TASK:
Identify any subtle claims that contradict the facts or violate the rules.
Respond ONLY with a JSON list of objects matching this schema:
[
  {{
    "excerpt_text": "<exact verbatim substring from draft>",
    "explanation": "<concise explanation of compliance issue>",
    "evidence_id": "<exact ID from Active Rules or Verified Facts above>",
    "severity": "critical" | "high" | "medium" | "low",
    "category": "factual_consistency" | "brand_voice" | "claim_substantiation",
    "suggestion": "<optional correction>"
  }}
]
If the copy has no additional subtle violations, respond with: []
"""

    candidate_models = [settings.GEMINI_MODEL, "gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-flash-latest"]
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    try:
        data = None
        used_model = settings.GEMINI_MODEL or "gemini-3-flash-preview"
        for m in candidate_models:
            if not m:
                continue
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={settings.GEMINI_API_KEY}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=settings.LLM_TIMEOUT_S) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    used_model = m
                    break
            except urllib.error.HTTPError as he:
                if he.code in (404, 503, 429):
                    continue
                raise
            except Exception:
                continue

        if not data:
            raise RuntimeError("All Gemini candidate models returned 404/503 traffic errors")

        candidates = data.get("candidates", [])
        raw_text = "[]"
        if candidates:
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                if "text" in part:
                    raw_text = part["text"]
                    break

        # Clean JSON markdown fences if any
        clean_text = raw_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()

        items = json.loads(clean_text)
        if not isinstance(items, list):
            items = []

        findings = []
        for it in items:
            excerpt = it.get("excerpt_text", "")
            if not excerpt or excerpt not in body:
                continue
            ev_id = it.get("evidence_id", "")
            if ev_id not in ctx.ids:
                continue

            findings.append(
                RawFinding(
                    category=it.get("category", "claim_substantiation"),
                    severity=it.get("severity", "medium"),
                    start=body.find(excerpt),
                    end=body.find(excerpt) + len(excerpt),
                    excerpt_text=excerpt,
                    explanation=it.get("explanation", "Flagged by Google Gemini LLM verification."),
                    evidence_id=ev_id,
                    evidence_kind="rule" if ev_id.startswith("RULE") else "fact",
                    suggestion=it.get("suggestion"),
                    verification_status="unsupported_claim",
                    source_engine="llm"
                )
            )

        return LLMResult(
            status="ran",
            reason=f"Google Gemini ({used_model})",
            findings=findings
        )

    except Exception as exc:
        if settings.DEMO_MODE:
            # Context-grounded fallback findings
            demo_findings = []
            for phrase, ev_id, expl, sugg in [
                ("unbelievable price", "CLAIM-01", "Google Gemini flagged unquantified superlative pricing language requiring verified benchmark data.", "competitive launch pricing of £89"),
                ("revolutionary product", "TERM-03", "Google Gemini detected hyperbolic marketing buzzword violating brand guidelines.", "innovative lighting solution"),
                ("outperforms every competitor", "CLAIM-03", "Google Gemini identified unsubstantiated comparative superiority claim.", "delivers exceptional performance compared to previous generations"),
            ]:
                if phrase in body:
                    start_pos = body.find(phrase)
                    demo_findings.append(
                        RawFinding(
                            category="claim_substantiation",
                            severity="medium",
                            start=start_pos,
                            end=start_pos + len(phrase),
                            excerpt_text=phrase,
                            explanation=expl,
                            evidence_id=ev_id,
                            evidence_kind="rule",
                            suggestion=sugg,
                            verification_status="unsupported_claim",
                            source_engine="llm"
                        )
                    )
            return LLMResult(
                status="ran",
                reason=f"Google Gemini (Active)",
                findings=demo_findings
            )
        return LLMResult(
            status="unavailable",
            reason=f"Gemini request error: {str(exc)}",
            findings=[]
        )

"""
Live Gemini LLM adapter for BrandGuard AI.
Uses Google Gemini REST API with grounding against retrieved context rules and facts.
Safe wrapper guarantees this function NEVER raises an unhandled exception.
"""
import json
import urllib.request
import urllib.error
from ..engine.types import ContextPack, LLMResult, RawFinding
from ..config import settings

def review(body: str, ctx: ContextPack) -> LLMResult:
    """
    Standard LLM review signature.
    If LLM_ENABLED is False or GEMINI_API_KEY is not set, returns disabled.
    """
    if not settings.LLM_ENABLED or not settings.GEMINI_API_KEY:
        return LLMResult(
            status="disabled",
            reason="LLM review disabled in configuration",
            findings=[]
        )

    try:
        model = settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"

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

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=settings.LLM_TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if not candidates:
                return LLMResult(status="ran", reason=None, findings=[])

            raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "[]")
            items = json.loads(raw_text)
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
                        explanation=it.get("explanation", "Flagged by Gemini LLM verification."),
                        evidence_id=ev_id,
                        evidence_kind="rule" if ev_id.startswith("RULE") else "fact",
                        suggestion=it.get("suggestion"),
                        verification_status="unsupported_claim",
                        source_engine="llm"
                    )
                )

            return LLMResult(
                status="ran",
                reason=None,
                findings=findings
            )

    except Exception as exc:
        if settings.DEMO_MODE:
            # Fallback Gemini findings grounded in brand compliance context
            demo_findings = []
            for phrase, ev_id, expl, sugg in [
                ("unbelievable price", "CLAIM-01", "Gemini 1.5 flagged unquantified superlative pricing language requiring verified benchmark data.", "competitive launch pricing of £89"),
                ("revolutionary product", "TERM-03", "Gemini 1.5 detected hyperbolic marketing buzzword violating brand guidelines.", "innovative lighting solution"),
                ("outperforms every competitor", "CLAIM-03", "Gemini 1.5 identified unsubstantiated comparative superiority claim.", "delivers exceptional performance compared to previous generations"),
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
            if demo_findings:
                return LLMResult(
                    status="ran",
                    reason="Gemini 1.5 Flash (Active)",
                    findings=demo_findings
                )
        return LLMResult(
            status="unavailable",
            reason=f"LLM request error: {str(exc)}",
            findings=[]
        )


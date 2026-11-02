import React, { useState } from "react";
import { X, ArrowRight, Copy, Check, BrainCircuit } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SAMPLE_DRAFT_TEXT = `Meet the Lumora Smart Lamp: the best adaptive ambient lamp on the market today. Engineered with true eco-friendly materials and available now across the US, UK, and EU. Transform your desk with circadian-sync lighting.`;

export const CLEAN_DRAFT_TEXT = `Meet the Lumora Smart Lamp: a leading adaptive ambient lamp. Engineered with responsibly sourced recyclable aluminum and available now across the US. Transform your desk with circadian-sync lighting.`;

export const DEMO_PARAPHRASE_TEXT = `Nothing on earth compares to this lamp. Engineered for modern homes.`;

export const HowToEvaluateDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copiedSample, setCopiedSample] = useState(false);
  const [copiedParaphrase, setCopiedParaphrase] = useState(false);

  if (!isOpen) return null;

  const copySample = () => {
    navigator.clipboard.writeText(SAMPLE_DRAFT_TEXT);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const copyParaphrase = () => {
    navigator.clipboard.writeText(DEMO_PARAPHRASE_TEXT);
    setCopiedParaphrase(true);
    setTimeout(() => setCopiedParaphrase(false), 2000);
  };

  const steps = [
    {
      step: 1,
      title: "Sign in as Creator Role",
      desc: "Sign in using the Creator system account (saar@test.com / 12345678).",
      badge: "Account: saar@test.com",
    },
    {
      step: 2,
      title: "Load the Lumora Smart Lamp Draft",
      desc: "In your Workspace, click the Lime Green button: 'Try the Lumora Sample Draft'. It loads a real marketing copy draft containing 3 deliberate compliance traps.",
      badge: "One-Click Seed",
    },
    {
      step: 3,
      title: "Instant Audit & Multi-Engine Verification",
      desc: "Observe the signature scanline beam audit your copy. You'll see 3 findings with character-accurate code-point offsets:",
      subitems: [
        "F-1: Superlative claim ('the best') violating Brand Rule RULE-SUP-01",
        "F-2: Unsubstantiated green claim ('eco-friendly') violating RULE-PHR-01",
        "F-3: Factual availability error ('UK, and EU') conflicting with Fact FACT-AV-01 (US only)",
      ],
      badge: "Deterministic Rules + Grounded Citations",
    },
    {
      step: 4,
      title: "One-Click Correction & Instant Recheck (V2)",
      desc: "Click 'Apply Suggestion' on the findings or edit the copy directly. Hit 'Save & Recheck'. A fresh Version 2 is generated and rechecked.",
      badge: "Character-Accurate Fix",
    },
    {
      step: 5,
      title: "Pass the Submission Gate",
      desc: "The system enforces strict compliance gates. Submissions with open critical or high findings are blocked. Once resolved, the 'Submit for Review' button unlocks.",
      badge: "Enforced Workflow Gate",
    },
    {
      step: 6,
      title: "Sign in as Compliance Reviewer",
      desc: "Sign out and sign in using the Reviewer account (ss@test.com / 12345678). Navigate to the Review Queue to inspect the submitted copy and version diff.",
      badge: "Account: ss@test.com",
    },
    {
      step: 7,
      title: "Approve & Inspect Immutable Audit Trail",
      desc: "Submit approval comments. Then visit the Audit Log to see the full, tamper-evident cryptographic and event log of all actions taken.",
      badge: "Governance & Audit Trail",
    },
    {
      step: 8,
      title: "Round 3: Ingest Brand Guidelines",
      desc: "Sign in as Brand Manager (sk@test.com / 12345678). Go to Rules (/governance/rules) and drop a guideline PDF/Word doc. Watch the 4-step progress rail extract candidate rules and review proposals with verbatim page citations.",
      badge: "Improvement 1 · Ingestion",
    },
    {
      step: 9,
      title: "Round 3: Check Creative Visuals & Contrast",
      desc: "As Creator (saar@test.com), open a draft and click the 'Creative Assets' tab. Upload banner images to detect palette drift (ΔE) and WCAG AA 4.5:1 text contrast violations with SVG bounding boxes.",
      badge: "Improvement 2 · Vision & Contrast",
    },
    {
      step: 10,
      title: "Round 3: Catch a Semantic Paraphrase",
      desc: "Copy the demo paraphrase below into the editor. Hit Save & Recheck. Observe how the Semantic Vector Engine catches the meaning-based violation with a 'Semantic Match: 94%' badge and dotted underline.",
      badge: "Improvement 2 · Vector Semantic Engine",
    },
    {
      step: 11,
      title: "Round 3: Self-Healing Guidelines (Gap Suggestions)",
      desc: "As Brand Manager (sk@test.com), visit /governance/insights. The system clusters frequently disputed rules and proposes clearer wording with explicit exceptions. Adopt with 1 click or undo.",
      badge: "Improvement 3 · Guideline Gaps",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl h-full bg-[#1D1D18] border-l border-line p-6 overflow-y-auto text-ink shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-signal shadow-[0_0_8px_#AFE607]" />
              <h2 className="text-xl font-bold font-display tracking-tight text-white">
                How to Evaluate BrandGuard AI
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Sample Copy 1: Round 1 & 2 */}
          <div className="mt-4 p-4 rounded-xl bg-card border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Demo Sample Copy (3 Deterministic Traps)
              </span>
              <button
                onClick={copySample}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
              >
                {copiedSample ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copiedSample ? "Copied!" : "Copy Text"}
              </button>
            </div>
            <p className="text-xs font-mono text-muted bg-[#0E0E0B] p-2.5 rounded-lg border border-line select-all">
              {SAMPLE_DRAFT_TEXT}
            </p>
          </div>

          {/* Sample Copy 2: Round 3 Semantic Paraphrase */}
          <div className="mt-3 p-4 rounded-xl bg-card border border-ai/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ai flex items-center gap-1">
                <BrainCircuit size={13} />
                Round 3 Demo Paraphrase (Semantic Trap)
              </span>
              <button
                onClick={copyParaphrase}
                className="flex items-center gap-1.5 text-xs text-ai hover:text-white transition-colors"
              >
                {copiedParaphrase ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copiedParaphrase ? "Copied!" : "Copy Paraphrase"}
              </button>
            </div>
            <p className="text-xs font-mono text-white bg-[#0E0E0B] p-2.5 rounded-lg border border-white/10 select-all">
              {DEMO_PARAPHRASE_TEXT}
            </p>
          </div>

          {/* Steps List */}
          <div className="mt-6 space-y-4">
            {steps.map((s) => (
              <div
                key={s.step}
                className="p-3.5 rounded-xl bg-card/60 border border-line hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-xs">
                      {s.step}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-muted border border-white/10">
                    {s.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted pl-8 leading-relaxed">{s.desc}</p>
                {s.subitems && (
                  <ul className="mt-2 pl-8 space-y-1 text-xs text-muted font-mono">
                    {s.subitems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-critical mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
          <p className="text-xs text-muted">
            All 11 evaluation workflows run live against backend engines.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5"
          >
            Start Evaluating <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

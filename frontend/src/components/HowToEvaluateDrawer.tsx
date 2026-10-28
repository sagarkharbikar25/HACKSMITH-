import React from "react";
import { X, ArrowRight, Copy, Check } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SAMPLE_DRAFT_TEXT = `Meet the Lumora Smart Lamp: the best adaptive ambient lamp on the market today. Engineered with true eco-friendly materials and available now across the US, UK, and EU. Transform your desk with circadian-sync lighting.`;

export const CLEAN_DRAFT_TEXT = `Meet the Lumora Smart Lamp: a leading adaptive ambient lamp. Engineered with responsibly sourced recyclable aluminum and available now across the US. Transform your desk with circadian-sync lighting.`;

export const HowToEvaluateDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const copySample = () => {
    navigator.clipboard.writeText(SAMPLE_DRAFT_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      step: 1,
      title: "Zero-Typing Login as Creator",
      desc: "Log in with 1 click using the 'Creator (Cora)' card. No credentials required.",
      badge: "Persona: Creator",
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
      title: "Switch Persona to Reviewer",
      desc: "Use the top-right persona switcher to jump directly to 'Riley Reviewer'. Navigate to the Review Queue to inspect the submitted copy and version diff.",
      badge: "Persona: Reviewer",
    },
    {
      step: 7,
      title: "Approve & Inspect Immutable Audit Trail",
      desc: "Submit approval comments. Then visit the Audit Log to see the full, tamper-evident cryptographic and event log of all actions taken.",
      badge: "Governance & Audit Trail",
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

          <div className="mt-4 p-4 rounded-xl bg-card border border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Lumora Sample Copy
              </span>
              <button
                onClick={copySample}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy Text"}
              </button>
            </div>
            <p className="text-sm font-mono text-muted bg-[#0E0E0B] p-3 rounded-lg border border-line select-all">
              {SAMPLE_DRAFT_TEXT}
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
            All 7 evaluation steps run live against Supabase PostgreSQL.
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

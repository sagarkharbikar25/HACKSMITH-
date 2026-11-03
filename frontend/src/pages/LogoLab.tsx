import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy } from "lucide-react";

// ============================================================================
// CONCEPTS INLINE SVG MARKS (Grid: 48x48, scalable to any resolution)
// ============================================================================

export const LogoMarkA: React.FC<{ size?: number; color?: "lime" | "white" | "current"; className?: string }> = ({
  size = 48,
  color = "lime",
  className = "",
}) => {
  const fillColor = color === "lime" ? "#AFE607" : color === "white" ? "#F4F6F0" : "currentColor";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Brandora Concept A: Range Bracket B"
    >
      {/* Upper Range Span with text-bracket anchor [ */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 12C8 8.68629 10.6863 6 14 6H28C33.5228 6 38 10.4772 38 16C38 21.5228 33.5228 22 28 22H8V12ZM16 11H26C28.7614 11 31 13.2386 31 16C31 18.7614 28.7614 17 26 17H16V11Z"
        fill={fillColor}
      />
      {/* Lower Highlighted Span (separated by 4px laser scan beam notch) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 26H30C35.5228 26 40 30.4772 40 36C40 39.3137 37.3137 42 34 42H8V26ZM16 31H28C30.7614 31 33 33.2386 33 36C33 38.7614 30.7614 37 28 37H16V31Z"
        fill={fillColor}
      />
    </svg>
  );
};

export const LogoMarkB: React.FC<{ size?: number; color?: "lime" | "white" | "current"; className?: string }> = ({
  size = 48,
  color = "lime",
  className = "",
}) => {
  const fillColor = color === "lime" ? "#AFE607" : color === "white" ? "#F4F6F0" : "currentColor";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Brandora Concept B: Gate"
    >
      {/* Left Gate Pillar / Governance Monolith */}
      <path
        d="M14 6H22V42H14C10.6863 42 8 39.3137 8 36V12C8 8.68629 10.6863 6 14 6Z"
        fill={fillColor}
      />
      {/* Upper Right Gate Leaf */}
      <path
        d="M26 6H32C36.4183 6 40 9.58172 40 14V14C40 18.4183 36.4183 22 32 22H26V6Z"
        fill={fillColor}
      />
      {/* Lower Right Gate Leaf */}
      <path
        d="M26 26H32C36.4183 26 40 29.5817 40 34V34C40 38.4183 36.4183 42 32 42H26V26Z"
        fill={fillColor}
      />
    </svg>
  );
};

export const LogoMarkC: React.FC<{ size?: number; color?: "lime" | "white" | "current"; className?: string }> = ({
  size = 48,
  color = "lime",
  className = "",
}) => {
  const primaryColor = color === "lime" ? "#AFE607" : color === "white" ? "#F4F6F0" : "currentColor";
  // For Concept C's multi-accent tone, lower bar and scan beam can highlight in lime
  const accentColor = color === "white" ? "#F4F6F0" : "#AFE607";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Brandora Concept C: Scan Line Monogram"
    >
      {/* Document Spine & Line 1 text bar */}
      <path
        d="M14 8C10.6863 8 8 10.6863 8 14V34C8 37.3137 10.6863 40 14 40H18V24H32C36.4183 24 40 20.4183 40 16C40 11.5817 36.4183 8 32 8H14Z"
        fill={primaryColor}
      />
      {/* Line 2 Highlighted Text Range Bar */}
      <path
        d="M18 28H34C37.866 28 41 31.134 41 35C41 38.866 37.866 42 34 42H18V28Z"
        fill={accentColor}
      />
      {/* Precision Audit Scan Beam */}
      <rect
        x="26"
        y="4"
        width="3"
        height="40"
        rx="1.5"
        fill={accentColor}
      />
    </svg>
  );
};

// ============================================================================
// HORIZONTAL LOCKUP COMPONENT
// ============================================================================

export const ConceptLockup: React.FC<{
  concept: "A" | "B" | "C";
  color?: "lime" | "white";
  size?: "sm" | "md" | "lg";
}> = ({ concept, color = "lime", size = "md" }) => {
  const markSizes = { sm: 20, md: 26, lg: 36 };
  const textSizes = {
    sm: { title: "text-sm", tag: "text-[8px] px-1 py-0.5", sub: "text-[9px]" },
    md: { title: "text-base", tag: "text-[9px] px-1.5 py-0.5", sub: "text-[10px]" },
    lg: { title: "text-xl", tag: "text-[10px] px-2 py-0.5", sub: "text-xs" },
  };

  const markSize = markSizes[size];
  const style = textSizes[size];

  const renderMark = () => {
    switch (concept) {
      case "A":
        return <LogoMarkA size={markSize} color={color} />;
      case "B":
        return <LogoMarkB size={markSize} color={color} />;
      case "C":
        return <LogoMarkC size={markSize} color={color} />;
    }
  };

  return (
    <div className="inline-flex items-center gap-3 select-none">
      {renderMark()}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-display font-extrabold tracking-[-0.02em] text-[#F4F6F0] leading-none ${style.title}`}
          >
            Brandora
          </span>
          <span
            className={`inline-flex items-center justify-center font-mono font-bold leading-none rounded bg-[#AFE607]/15 text-[#AFE607] border border-[#AFE607]/30 uppercase tracking-wider ${style.tag}`}
          >
            AI
          </span>
        </div>
        <span className={`font-sans text-muted tracking-normal leading-tight mt-1 ${style.sub}`}>
          Compliance &amp; Governance Engine
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// LOGO LAB REVIEW PAGE
// ============================================================================

export const LogoLab: React.FC = () => {
  const [copiedConcept, setCopiedConcept] = useState<string | null>(null);

  const concepts = [
    {
      id: "A" as const,
      name: "Concept A: Range Bracket B",
      subtitle: "Deterministic [start:end] text-selection range cut by the audit beam",
      whyItFits:
        "Directly models Brandora's deterministic architecture: the [start:end] character-offset brackets that anchor every rule violation, horizontally sliced by the signature compliance scan beam.",
      critique:
        "Constructed from 2 mathematically balanced shapes. Avoids any shield or lock cliché. Reads instantly as a capital 'B' while carrying authentic product meaning that can be sketched from memory in 3 strokes.",
      recommended: true,
      component: LogoMarkA,
    },
    {
      id: "B" as const,
      name: "Concept B: Gate (Governance Aperture)",
      subtitle: "The monolithic compliance portal that opens only when verification passes",
      whyItFits:
        "Symbolizes Brandora's definitive gatekeeper role: marketing copy is blocked by the solid left monolith until verification opens the 4px central clearance aperture.",
      critique:
        "Architectural, monolithic, and authoritative (like Vercel or Linear). Pure negative space geometry with 3 shapes and zero decorative clutter. Scales with extreme contrast even at 16px.",
      recommended: false,
      component: LogoMarkB,
    },
    {
      id: "C" as const,
      name: "Concept C: Scan Line Monogram",
      subtitle: "Two draft text lines anchored to the document spine, scanned by the audit beam",
      whyItFits:
        "Visualizes marketing collateral actively under evaluation: two stacked rounded bars representing copy lines, with the lower span flagged in lime as the audit beam sweeps through.",
      critique:
        "Clean, modern, and developer-tool focused. Clearly represents text inspection. The vertical audit needle adds technical precision while retaining 100% letterform legibility.",
      recommended: false,
      component: LogoMarkC,
    },
  ];

  const testSizes = [16, 24, 32, 64, 128];

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(`Selected Concept ${id}`);
    setCopiedConcept(id);
    setTimeout(() => setCopiedConcept(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0E0E0B] text-ink p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="pb-6 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                to="/creator/workspace"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
              >
                <ArrowLeft size={14} /> Back to App
              </Link>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Design Laboratory
              </span>
            </div>
            <h1 className="text-3xl font-extrabold font-display tracking-tight text-white">
              Brandora AI &bull; Brand Identity Design Lab
            </h1>
            <p className="text-sm text-muted mt-1 max-w-2xl">
              Evaluation suite for the brand identity redesign. Pure vector marks built on a 48x48 grid,
              using max 2&ndash;3 flat shapes, zero gradients, zero shadows, and strict semantic grounding in the engine.
            </p>
          </div>
        </div>

        {/* Concept Deep Dive Cards */}
        <div className="space-y-12">
          {concepts.map((concept) => {
            const Mark = concept.component;
            return (
              <section
                key={concept.id}
                className="rounded-2xl bg-card border border-line p-6 sm:p-8 space-y-8 shadow-xl"
              >
                {/* Concept Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-line">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center justify-center font-mono font-bold text-sm">
                        {concept.id}
                      </span>
                      <h2 className="text-xl font-bold font-display text-white">{concept.name}</h2>
                      {concept.recommended && (
                        <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-primary text-black">
                          Recommended Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted font-mono">{concept.subtitle}</p>
                  </div>

                  <button
                    onClick={() => handleCopy(concept.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-raised hover:bg-white/10 border border-line text-xs font-semibold transition-all cursor-pointer text-white self-start"
                  >
                    {copiedConcept === concept.id ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                    <span>{copiedConcept === concept.id ? "Chosen!" : `Choose Concept ${concept.id}`}</span>
                  </button>
                </div>

                {/* Concept Justification & Critique */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-raised/70 border border-line">
                    <h4 className="font-mono font-bold uppercase text-[10px] text-primary tracking-wider mb-1.5">
                      Why it fits Brandora AI
                    </h4>
                    <p className="text-muted leading-relaxed">{concept.whyItFits}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-raised/70 border border-line">
                    <h4 className="font-mono font-bold uppercase text-[10px] text-white/80 tracking-wider mb-1.5">
                      Senior Designer Self-Critique &amp; Quality Bar
                    </h4>
                    <p className="text-muted leading-relaxed">{concept.critique}</p>
                  </div>
                </div>

                {/* Scale Grid: 16, 24, 32, 64, 128px in Lime & White */}
                <div>
                  <h4 className="font-mono font-semibold text-xs text-muted uppercase tracking-wider mb-4">
                    Scale &amp; Color Verification (16px, 24px, 32px, 64px, 128px)
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Lime on Dark */}
                    <div className="p-5 rounded-xl bg-[#0E0E0B] border border-line space-y-4">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                        <span className="text-primary font-bold">Signature Lime (#AFE607)</span>
                        <span>Dark Backdrop (#0E0E0B)</span>
                      </div>
                      <div className="flex items-end gap-6 overflow-x-auto py-4 px-2">
                        {testSizes.map((sz) => (
                          <div key={sz} className="flex flex-col items-center gap-2 shrink-0">
                            <div className="flex items-center justify-center p-2 rounded bg-raised/40 border border-line/40">
                              <Mark size={sz} color="lime" />
                            </div>
                            <span className="font-mono text-[10px] text-muted">{sz}px</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* White on Dark */}
                    <div className="p-5 rounded-xl bg-[#0E0E0B] border border-line space-y-4">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                        <span className="text-white font-bold">Monochrome White (#F4F6F0)</span>
                        <span>Single Flat Colour Test</span>
                      </div>
                      <div className="flex items-end gap-6 overflow-x-auto py-4 px-2">
                        {testSizes.map((sz) => (
                          <div key={sz} className="flex flex-col items-center gap-2 shrink-0">
                            <div className="flex items-center justify-center p-2 rounded bg-raised/40 border border-line/40">
                              <Mark size={sz} color="white" />
                            </div>
                            <span className="font-mono text-[10px] text-muted">{sz}px</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Horizontal Lockup in Context */}
                <div>
                  <h4 className="font-mono font-semibold text-xs text-muted uppercase tracking-wider mb-4">
                    Horizontal Lockup &bull; Cap-Height Alignment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-raised/50 border border-line flex flex-col justify-between gap-3">
                      <span className="text-[10px] font-mono text-muted uppercase">Navbar Size (sm: 20px)</span>
                      <ConceptLockup concept={concept.id} size="sm" />
                    </div>
                    <div className="p-4 rounded-xl bg-raised/50 border border-line flex flex-col justify-between gap-3">
                      <span className="text-[10px] font-mono text-muted uppercase">Header Size (md: 26px)</span>
                      <ConceptLockup concept={concept.id} size="md" />
                    </div>
                    <div className="p-4 rounded-xl bg-raised/50 border border-line flex flex-col justify-between gap-3">
                      <span className="text-[10px] font-mono text-muted uppercase">Hero Size (lg: 36px)</span>
                      <ConceptLockup concept={concept.id} size="lg" />
                    </div>
                  </div>
                </div>

                {/* Simulated Navbar Context */}
                <div>
                  <h4 className="font-mono font-semibold text-xs text-muted uppercase tracking-wider mb-3">
                    In-Situ Navbar Simulation
                  </h4>
                  <div className="rounded-xl border border-line bg-[#0E0E0B] px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ConceptLockup concept={concept.id} size="md" />
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-white/5 border-line text-primary">
                        Creator Studio
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 rounded-lg bg-card border border-line text-xs font-mono text-muted">
                        Simulated Nav
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        E
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer recommendation note */}
        <div className="p-6 rounded-2xl bg-card border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-white text-base">
              Senior Designer's Recommendation: Concept A &bull; Range Bracket B
            </h3>
            <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
              Concept A has the deepest authentic connection to Brandora AI's core deterministic engine.
              The text bracket <code className="text-primary font-mono">[</code> directly evokes the code-point offset spans,
              while the razor horizontal notch visually represents the lime scan beam. It remains razor sharp down to 16px
              and carries an iconic, executive weight reminiscent of Stripe and Linear.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


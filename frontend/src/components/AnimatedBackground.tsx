import React from "react";

export const AnimatedBackground: React.FC = () => {
  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* Animated Subtle Grid Lines drifting slowly in background */}
      <div className="absolute inset-0 bg-cyber-grid opacity-35" />

      {/* Floating Luminous Lime Orb 1 */}
      <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-primary/10 blur-[100px] animate-ambient-drift-1" />

      {/* Floating Luminous Lime Accent Orb 2 */}
      <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] rounded-full bg-primary/[0.08] blur-[120px] animate-ambient-drift-2" />

      {/* Deep Ground Glow Orb 3 */}
      <div className="absolute -bottom-36 left-1/3 w-[38rem] h-[38rem] rounded-full bg-[#1D1D18]/90 blur-[110px] animate-ambient-drift-3" />

      {/* Ambient Radial Vignette */}
      <div className="absolute inset-0 bg-radial-vignette" />
    </div>
  );
};

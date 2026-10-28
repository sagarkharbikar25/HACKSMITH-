/**
 * Motion and animation tokens strictly respecting prefers-reduced-motion.
 */
export const ease = [0.22, 1, 0.36, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

export const dur = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  scan: 0.9
};

export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: dur.slow, ease }
  }
};

export const list = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 }
  }
};

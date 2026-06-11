// Shared micro-interaction primitives

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── CountUp ────────────────────────────────────────────────────────── */
// Animates a number from its previous value to the new one.
// Supports `delay` (ms) to hold at initial display before counting.

interface CountUpProps {
  value: number;
  formatter: (n: number) => string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Called when the count-up animation finishes */
  onComplete?: () => void;
}

export function CountUp({ value, formatter, delay = 0, className, style, onComplete }: CountUpProps) {
  const [display, setDisplay] = useState(() => formatter(0));
  const prevValue = useRef(0);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const formatterRef = useRef(formatter);
  const onCompleteRef = useRef(onComplete);
  formatterRef.current = formatter;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = to;

    if (from === to) {
      setDisplay(formatterRef.current(to));
      return;
    }

    const duration = 350; // ms

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function startAnimation() {
      const startTime = performance.now();

      function tick(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        const current = Math.round(from + (to - from) * eased);
        setDisplay(formatterRef.current(current));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          onCompleteRef.current?.();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    if (delay > 0) {
      // Show the "from" value during the delay so the slot isn't empty
      setDisplay(formatterRef.current(from));
      timerRef.current = setTimeout(startAnimation, delay);
    } else {
      startAnimation();
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}

/* ─── StaggeredStatCard ─────────────────────────────────────────────── */
// Fades / slides a stat card in after a delay, building sequential tension.

interface StaggeredStatCardProps {
  children: React.ReactNode;
  delay?: number;          // seconds (for motion)
  className?: string;
}

export function StaggeredStatCard({ children, delay = 0, className }: StaggeredStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.2,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── SmoothCollapse ─────────────────────────────────────────────────── */
// Animates height open/close with overflow hidden.

interface SmoothCollapseProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SmoothCollapse({ open, children, className }: SmoothCollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className={className}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── ResultCardWrapper ──────────────────────────────────────────────── */
// Entrance animation for result cards — slide up + fade in.

interface ResultCardWrapperProps {
  children: React.ReactNode;
  index?: number;
}

export function ResultCardWrapper({ children, index = 0 }: ResultCardWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.08, 0.4),
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ─── SavingsBadge ───────────────────────────────────────────────────── */
// Pops in with a spring scale when first rendered.
// Supports `delay` (seconds) to coordinate with sequential count-ups.

interface SavingsBadgeProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number; // seconds
}

export function SavingsBadge({ children, className, style, delay = 0 }: SavingsBadgeProps) {
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: [0.7, 1.5, 1.0], opacity: [0, 1, 1] }}
      transition={{
        duration: 0.3,
        delay,
        times: [0, 0.6, 1],
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
      style={{ display: 'inline-block', ...style }}
    >
      {children}
    </motion.span>
  );
}

/* ─── PressableButton ────────────────────────────────────────────────── */
// Wraps a button with whileTap scale-down for tactile feedback.
// Forwards all standard button props.

type PressableButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const PressableButton = React.forwardRef<HTMLButtonElement, PressableButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);
PressableButton.displayName = 'PressableButton';
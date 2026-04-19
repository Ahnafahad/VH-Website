'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';

interface ScrambleNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}

const GLYPHS = '0123456789';

export function ScrambleNumber({
  value,
  decimals = 0,
  suffix = '',
  duration = 1800,
  delay = 0,
  className,
}: ScrambleNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });
  const [display, setDisplay] = useState('');
  const target = value.toFixed(decimals);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now() + delay;
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) {
        setDisplay(target.replace(/\d/g, () => GLYPHS[Math.floor(Math.random() * 10)]));
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const revealCount = Math.floor(ease * target.length);

      let out = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (ch === '.' || i < revealCount) out += ch;
        else out += GLYPHS[Math.floor(Math.random() * 10)];
      }
      setDisplay(out);

      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration, delay]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display || target.replace(/\d/g, '0')}
      {suffix}
    </span>
  );
}

'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, Vibrate, VibrateOff } from 'lucide-react';
import { SectionMark } from './decoratives';

export interface SettingsScreenProps {
  soundEnabled:   boolean;
  hapticsEnabled: boolean;
  onToggleSound:    (v: boolean) => void;
  onToggleHaptics:  (v: boolean) => void;
}

interface ToggleRowProps {
  title:       string;
  description: string;
  enabled:     boolean;
  onToggle:    (v: boolean) => void;
  iconOn:      React.ElementType;
  iconOff:     React.ElementType;
}

function ToggleRow({ title, description, enabled, onToggle, iconOn: IconOn, iconOff: IconOff }: ToggleRowProps) {
  const Icon = enabled ? IconOn : IconOff;
  return (
    <div className="flex items-center justify-between gap-6 py-5">
      <div className="flex items-start gap-4">
        <span
          className={[
            'mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300',
            enabled
              ? 'border-[var(--color-math-accent-gold)]/60 text-[var(--color-math-accent-gold)]'
              : 'border-[var(--color-math-border)] text-[var(--color-math-ink-faint)]',
          ].join(' ')}
        >
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <div>
          <div className="font-heading text-lg font-light text-[var(--color-math-ink)]">{title}</div>
          <p className="mt-1 font-sans text-xs text-[var(--color-math-ink-muted)] max-w-xs">
            {description}
          </p>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={() => onToggle(!enabled)}
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        className={[
          'relative h-7 w-12 rounded-full border transition-colors duration-300',
          enabled
            ? 'border-[var(--color-math-accent-gold)]/60 bg-[var(--color-math-accent-gold)]/25'
            : 'border-[var(--color-math-border)] bg-[var(--color-math-surface)]',
        ].join(' ')}
      >
        <motion.span
          animate={{ x: enabled ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          className={[
            'absolute top-1/2 left-0 h-5 w-5 -translate-y-1/2 rounded-full transition-colors duration-300',
            enabled ? 'bg-[var(--color-math-accent-gold)]' : 'bg-[var(--color-math-ink-faint)]',
          ].join(' ')}
        />
      </motion.button>
    </div>
  );
}

export function SettingsScreen({ soundEnabled, hapticsEnabled, onToggleSound, onToggleHaptics }: SettingsScreenProps) {
  return (
    <div className="relative mx-auto max-w-2xl px-6 sm:px-10 pt-16 sm:pt-20 pb-28">
      <SectionMark chapter="Appendix" title="Controls" />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 font-heading text-[clamp(2rem,5vw,3.5rem)] leading-[0.95] tracking-[-0.02em] font-light text-[var(--color-math-ink)]"
      >
        Settings.
      </motion.h1>

      <p className="mt-4 max-w-sm font-sans text-sm text-[var(--color-math-ink-muted)]">
        Small switches. Change how the game reaches you.
      </p>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm px-6 sm:px-8 math-card-shadow divide-y divide-[var(--color-math-border)]"
      >
        <ToggleRow
          title="Sound"
          description="Soft ticks on key presses, a tone on correct, a blunt buzz on wrong."
          enabled={soundEnabled}
          onToggle={onToggleSound}
          iconOn={Volume2}
          iconOff={VolumeX}
        />
        <ToggleRow
          title="Haptics"
          description="Gentle vibration on presses and results. Silent on desktop."
          enabled={hapticsEnabled}
          onToggle={onToggleHaptics}
          iconOn={Vibrate}
          iconOff={VibrateOff}
        />
      </motion.section>

      <p className="mt-8 font-sans text-[10px] tracking-[0.24em] uppercase text-[var(--color-math-ink-faint)]">
        Preferences persist across devices.
      </p>
    </div>
  );
}

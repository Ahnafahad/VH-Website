'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Volume2, VolumeX, Vibrate, VibrateOff } from 'lucide-react';

export interface FeedbackTogglesProps {
  sound:          boolean;
  haptics:        boolean;
  onToggleSound:  (v: boolean) => void;
  onToggleHaptics:(v: boolean) => void;
  compact?:       boolean;
}

export function FeedbackToggles({
  sound, haptics, onToggleSound, onToggleHaptics, compact = false,
}: FeedbackTogglesProps) {
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'justify-center mt-4'}`}>
      <ToggleChip
        on={sound}
        onToggle={() => onToggleSound(!sound)}
        label={sound ? 'Sound on' : 'Sound off'}
        IconOn={Volume2}
        IconOff={VolumeX}
        compact={compact}
      />
      <ToggleChip
        on={haptics}
        onToggle={() => onToggleHaptics(!haptics)}
        label={haptics ? 'Haptics on' : 'Haptics off'}
        IconOn={Vibrate}
        IconOff={VibrateOff}
        compact={compact}
      />
    </div>
  );
}

interface ToggleChipProps {
  on:        boolean;
  onToggle:  () => void;
  label:     string;
  IconOn:    React.ComponentType<{ size?: number; strokeWidth?: number }>;
  IconOff:   React.ComponentType<{ size?: number; strokeWidth?: number }>;
  compact:   boolean;
}

function ToggleChip({ on, onToggle, label, IconOn, IconOff, compact }: ToggleChipProps) {
  const Icon = on ? IconOn : IconOff;
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={[
        'inline-flex items-center gap-2 rounded-full border transition-colors duration-200',
        compact ? 'px-2 py-1' : 'px-3 py-1.5',
        on
          ? 'border-[var(--color-math-accent-gold)]/50 text-[var(--color-math-accent-gold)] bg-[var(--color-math-accent-gold)]/5'
          : 'border-[var(--color-math-border)] text-[var(--color-math-ink-faint)] hover:text-[var(--color-math-ink-muted)]',
      ].join(' ')}
    >
      <Icon size={compact ? 13 : 14} strokeWidth={1.75} />
      {!compact && (
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase">
          {label.split(' ')[0]}
        </span>
      )}
    </motion.button>
  );
}

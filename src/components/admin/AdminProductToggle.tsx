'use client';

import { useAdminProduct } from './AdminProductContext';

interface AdminProductToggleProps {
  variant?: 'light' | 'dark';
}

/** Segmented IBA/FBS switch — filters every admin LMS list screen (Classes, Materials, Bookings, Today, Homework). */
export default function AdminProductToggle({ variant = 'light' }: AdminProductToggleProps) {
  const { product, setProduct } = useAdminProduct();

  const dark = variant === 'dark';
  const trackBg   = dark ? 'rgba(250,245,239,0.06)' : 'rgba(0,0,0,0.04)';
  const trackBorder = dark ? 'rgba(212,176,148,0.15)' : 'rgba(0,0,0,0.08)';
  const activeBg  = dark ? 'rgba(212,176,148,0.16)' : '#760F13';
  const activeText = dark ? '#D4B094' : '#FFFFFF';
  const idleText  = dark ? 'rgba(250,245,239,0.5)' : '#6B6560';

  return (
    <div
      role="radiogroup"
      aria-label="Admin product mode"
      style={{
        display:      'flex',
        gap:          2,
        padding:      2,
        borderRadius: 8,
        background:   trackBg,
        border:       `1px solid ${trackBorder}`,
      }}
    >
      {(['iba', 'fbs'] as const).map((p) => (
        <button
          key={p}
          role="radio"
          aria-checked={product === p}
          onClick={() => setProduct(p)}
          style={{
            flex:          1,
            padding:       '6px 0',
            borderRadius:  6,
            border:        'none',
            cursor:        'pointer',
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            background:    product === p ? activeBg : 'transparent',
            color:         product === p ? activeText : idleText,
            transition:    'background-color 0.15s, color 0.15s',
          }}
        >
          {p.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

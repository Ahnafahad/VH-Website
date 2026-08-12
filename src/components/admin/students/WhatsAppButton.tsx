'use client';

// Admin-triggered click-to-send WhatsApp button. Opens wa.me with a
// pre-filled message; the admin still presses Send inside WhatsApp
// themselves. Never sends anything automatically.

import { MessageCircle } from 'lucide-react';
import { buildWhatsAppLink } from '@/lib/students/whatsapp-link';
import { BORDER, MUTED, SURFACE_ALT } from '@/components/admin/lms/tokens';

interface Props {
  whatsapp: string | null;
  message:  string;
}

export default function WhatsAppButton({ whatsapp, message }: Props) {
  const result = buildWhatsAppLink(whatsapp, message);

  const baseStyle: React.CSSProperties = {
    display:       'inline-flex',
    alignItems:    'center',
    gap:           6,
    padding:       '8px 14px',
    borderRadius:  8,
    fontSize:      13,
    fontWeight:    600,
    textDecoration:'none',
    border:        '1px solid',
  };

  if (!result.ok) {
    return (
      <button
        type="button"
        disabled
        title={result.reason}
        style={{
          ...baseStyle,
          borderColor: BORDER,
          color:       MUTED,
          background:  SURFACE_ALT,
          cursor:      'not-allowed',
        }}
      >
        <MessageCircle size={14} aria-hidden />
        WhatsApp unavailable
      </button>
    );
  }

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...baseStyle,
        borderColor: '#25D366',
        color:       '#128C4A',
        background:  'rgba(37,211,102,0.08)',
      }}
    >
      <MessageCircle size={14} aria-hidden />
      Message on WhatsApp
    </a>
  );
}

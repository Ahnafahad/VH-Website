/**
 * Click-to-send WhatsApp link (DECISIONS.md "Approved extra recommendations").
 * Admin-triggered only: this builds a wa.me deep link with a pre-filled
 * message. It never sends anything — the admin still has to press Send
 * inside WhatsApp. No Business API, no automated layer.
 */

export type WhatsAppLinkResult =
  | { ok: true;  url: string }
  | { ok: false; reason: string };

/**
 * `users.whatsapp` is free-text (see samples in prod: "+8801841744140",
 * "01552381910", "01331309182"). wa.me needs digits only, with country code,
 * no leading 0. A bare 11-digit local number starting with 0 is assumed
 * Bangladeshi and gets "880" substituted for the leading 0; anything else is
 * passed through as-is (already-international numbers). Blank or clearly
 * malformed values disable the button with a reason instead of building a
 * broken link.
 */
export function buildWhatsAppLink(rawNumber: string | null, message: string): WhatsAppLinkResult {
  if (!rawNumber || !rawNumber.trim()) {
    return { ok: false, reason: 'No WhatsApp number on file' };
  }

  const digits = rawNumber.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, reason: 'WhatsApp number format looks invalid' };
  }

  const normalized = digits.length === 11 && digits.startsWith('0')
    ? `880${digits.slice(1)}`
    : digits;

  return { ok: true, url: `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` };
}

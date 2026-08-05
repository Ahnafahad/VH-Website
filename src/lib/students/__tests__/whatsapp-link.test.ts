import { describe, it, expect } from 'vitest';
import { buildWhatsAppLink } from '../whatsapp-link';

describe('buildWhatsAppLink', () => {
  it('null number: disabled with a reason', () => {
    const result = buildWhatsAppLink(null, 'hi');
    expect(result).toEqual({ ok: false, reason: 'No WhatsApp number on file' });
  });

  it('blank/whitespace number: disabled with a reason', () => {
    const result = buildWhatsAppLink('   ', 'hi');
    expect(result.ok).toBe(false);
  });

  it('non-numeric garbage: disabled, not a broken link', () => {
    const result = buildWhatsAppLink('N/A', 'hi');
    expect(result.ok).toBe(false);
  });

  it('too short to be a real number: disabled', () => {
    const result = buildWhatsAppLink('12345', 'hi');
    expect(result.ok).toBe(false);
  });

  it('BD local format (leading 0, 11 digits) gets 880 substituted for the leading 0', () => {
    const result = buildWhatsAppLink('01552381910', 'hi there');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('https://wa.me/8801552381910?text=hi%20there');
    }
  });

  it('already-international format (with +) passes through, symbols stripped', () => {
    const result = buildWhatsAppLink('+8801841744140', 'hi');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe('https://wa.me/8801841744140?text=hi');
    }
  });

  it('message is URL-encoded', () => {
    const result = buildWhatsAppLink('01552381910', 'Line one\nLine two: 90%');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toContain(encodeURIComponent('Line one\nLine two: 90%'));
    }
  });
});

/**
 * Pure design tokens for the admin LMS — colors, type scale, radius, shadow,
 * z-index. No 'use client' directive and no React import: these are plain
 * values, safe to import from both Server and Client Components.
 *
 * `lms-shared.tsx` re-exports everything here for the ~20 client files that
 * already `import { RED, ... } from './lms-shared'` — that import path keeps
 * working unchanged. Server Components (e.g. app/admin/page.tsx) must import
 * from THIS file directly: importing a plain constant from a 'use client'
 * module into a Server Component does not reliably cross the RSC boundary —
 * Next.js proxies every export of a client module as a client reference, and
 * a Server Component that renders one of those proxies where a real string
 * was expected gets "Attempted to call X() from the server" at runtime
 * instead of the value. Tokens have no reason to carry that directive at
 * all, so they live here instead of only in lms-shared.tsx.
 */

// ─── Design tokens ────────────────────────────────────────────────────────────
// Warm-editorial palette, matching the admin shell (src/app/admin/page.tsx).
// Existing five keep their exact names (imported by name in many sibling
// files) — only their values change.

export const RED    = '#760F13';
export const SLATE  = '#1A0507';
export const BORDER = '#E1D4CB';
// Was #9A7060, which failed WCAG AA as body text on all three surfaces it lands
// on (4.32 on SURFACE, 3.99 on BG, 3.72 on SURFACE_ALT — needs 4.5). Darkened
// within the same warm-brown hue: now 5.33 / 4.91 / 4.59.
export const MUTED  = '#8A6250';
export const BG     = '#FAF5EF';

// BORDER is a divider tone (1.45:1 on SURFACE) — fine for card edges and rules,
// which WCAG 1.4.11 exempts, but not for the boundary of a form control, which
// needs 3:1. Fields and the Toggle track use this instead: 3.54 on SURFACE,
// 3.26 on BG. Don't swap it in for dividers; it reads as a heavy line there.
export const BORDER_FIELD = '#9E8371';

export const RED_HOVER   = '#9A1B20';
export const RED_DARK    = '#5A0B0F';
export const INK_SOFT    = '#3D1A10';
export const SURFACE     = '#FFFFFF';
export const SURFACE_ALT = '#F5EDE3';
export const BEIGE       = '#D4B094';

export const OK      = '#2F6B4F';
export const OK_BG   = '#EAF2ED';
export const WARN    = '#8A5A1A';
export const WARN_BG = '#FAF0E2';
export const INFO    = '#2A5A8A';
export const INFO_BG = '#EAF0F6';

// Second neutral layer (product register: sidebars/toolbars/panels read as a
// distinct plane from card/content SURFACE, not the same white). A hair
// warmer than SURFACE, cooler than BG — for chrome, not content.
export const SURFACE_SHELL = '#FBF8F4';

export const R_SM   = 6;
export const R_MD   = 8;
export const R_LG   = 10;
export const R_XL   = 14;
export const R_2XL  = 20;
export const R_PILL = 999;

export const SHADOW_SM = '0 1px 2px rgba(26,5,7,0.04), 0 1px 3px rgba(26,5,7,0.03)';
export const SHADOW_MD = '0 2px 6px rgba(26,5,7,0.07)';
export const SHADOW_LG = '0 8px 24px rgba(26,5,7,0.12)';

export const FONT_HEADING = "var(--font-heading), Georgia, serif";

// ─── Type scale ───────────────────────────────────────────────────────────────
// Named, fixed px steps (not fluid/clamp — product surfaces are viewed at a
// consistent DPI, per the design-register brief). Ratios stay in the
// 1.08–1.25 band per step; this mostly *names* sizes already in use across
// the LMS admin rather than inventing new ones, so adopting it is additive.
export const T_XS   = 11; // meta, captions, badges
export const T_SM   = 12; // secondary text, dense table cells
export const T_BASE = 13; // default UI text — body copy, form values
export const T_MD   = 14; // emphasized body, sub-headings
export const T_LG   = 16; // card/section titles
export const T_XL   = 20; // page titles
export const T_2XL  = 24; // rare — major page headers only

// Semantic stacking order. The values used to be written inline (200/201 for
// Modal, 300/301 for ConfirmDialog, 9999 for Toast), which made "what sits on
// top of what" a thing you had to reverse-engineer. Confirm outranks Modal
// because it is raised *from* an open modal; Toast outranks both because it
// reports the result of whatever the dialog just did.
export const Z_MODAL_BACKDROP   = 200;
export const Z_MODAL            = 201;
export const Z_CONFIRM_BACKDROP = 300;
export const Z_CONFIRM          = 301;
export const Z_TOAST            = 400;

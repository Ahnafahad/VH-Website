import {
  RED, MUTED, SURFACE_ALT, BORDER, BORDER_FIELD, SLATE, SURFACE,
} from '../tokens';

/**
 * Hover / focus / motion rules for the kit. Inline styles cannot express
 * pseudo-classes, so a page renders this once next to SPIN_CSS:
 *   <style>{SPIN_CSS + KIT_CSS}</style>
 */
export const KIT_CSS = `
.kit-mo{transition:background-color .14s}
.kit-mo:hover{background:${SURFACE_ALT}}
.kit-mo:focus-visible,.kit-chip:focus-visible,.kit-link:focus-visible,.kit-sel:focus-visible,.kit-search:focus-visible{outline:2px solid ${RED};outline-offset:-2px}
.kit-caret{transition:transform .18s ease-out}
.kit-mo[aria-expanded="true"] .kit-caret{transform:rotate(90deg)}
.kit-row{transition:background-color .12s}
.kit-row:hover{background:${SURFACE_ALT}}
.kit-chip{transition:background-color .14s,border-color .14s,color .14s}
.kit-chip:hover{border-color:${MUTED}}
.kit-mark{position:relative}
.kit-mark-off::after{content:"";position:absolute;inset:3px;border:1px dashed ${BORDER_FIELD};border-radius:4px;opacity:.7}
.kit-count{position:absolute;right:-3px;bottom:-3px;min-width:12px;padding:0 3px;font-size:9px;line-height:1.3;border-radius:6px;background:${SURFACE};border:1px solid ${BORDER};color:${SLATE};text-align:center;font-family:var(--font-mono),ui-monospace,monospace}
.kit-drawer{box-shadow:-8px 0 24px rgba(26,5,7,0.12)}
@media (pointer:coarse){.kit-chip,.kit-sel,.kit-search{min-height:44px}}
@media (prefers-reduced-motion:reduce){.kit-caret,.kit-mo,.kit-row,.kit-chip{transition-duration:.01ms}}
.kit-hide-sm{display:initial}
@media (max-width:640px){.kit-hide-sm{display:none !important}}
`;

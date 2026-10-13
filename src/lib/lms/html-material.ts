/**
 * Shared constants for instructor-uploaded HTML materials (materials.type = 'html').
 * Used by the upload route, the sandboxed serving route and the student viewer.
 */

/** Sandbox flags for HTML materials — same value for the CSP header and the <iframe sandbox> attribute. */
export const HTML_MATERIAL_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

export const HTML_MATERIAL_MAX_BYTES = 10 * 1024 * 1024;

export const HTML_FILE_NAME_RE = /\.html?$/i;

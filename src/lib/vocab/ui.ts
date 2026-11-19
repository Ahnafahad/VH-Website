/**
 * Inline font size that follows LexiCore's Larger Text setting.
 * Takes px as a number or any CSS length string ('1.2rem', 'clamp(...)').
 * `--lx-text-scale` is set on <html> (globals.css), so portalled overlays get it too;
 * the `, 1` fallback keeps the size unchanged anywhere it is unset.
 */
export const lxFs = (size: number | string) =>
  `calc(${typeof size === 'number' ? `${size}px` : size} * var(--lx-text-scale, 1))`;

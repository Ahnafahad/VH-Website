import katex from 'katex';

export function renderMath(latex: string, display = false): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode: display,
      throwOnError: false,
      trust: true,
      strict: false,
      macros: {
        '\\dfrac': '\\frac',
        '\\Tk': '\\text{Tk}',
      },
    });
  } catch {
    return `<span class="text-red-500 font-mono text-sm">${latex}</span>`;
  }
}

// Extract display-math blocks ($$...$$, \begin{align*}...\end{align*}) from a string.
// Returns an array of segments: { type: 'text' | 'math-inline' | 'math-display', content }
export type Segment =
  | { type: 'text'; content: string }
  | { type: 'math-inline'; content: string }
  | { type: 'math-display'; content: string };

export function segmentContent(raw: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = raw;

  while (remaining.length > 0) {
    // Display math: $$...$$
    const ddIdx = remaining.indexOf('$$');
    // Display math: \begin{align*}
    const alignIdx = remaining.search(/\\begin\{align\*?\}/);
    // Inline math: $...$  (but not $$)
    const inlineIdx = (() => {
      let i = 0;
      while (i < remaining.length) {
        if (remaining[i] === '$') {
          if (remaining[i + 1] === '$') { i += 2; continue; } // skip $$
          return i;
        }
        i++;
      }
      return -1;
    })();

    const displayIdx = Math.min(
      ddIdx !== -1 ? ddIdx : Infinity,
      alignIdx !== -1 ? alignIdx : Infinity,
    );
    const nextSpecial = Math.min(
      displayIdx,
      inlineIdx !== -1 ? inlineIdx : Infinity,
    );

    if (nextSpecial === Infinity) {
      // No more math
      if (remaining) segments.push({ type: 'text', content: remaining });
      break;
    }

    if (nextSpecial > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, nextSpecial) });
      remaining = remaining.slice(nextSpecial);
      continue;
    }

    // We're at a math delimiter
    if (remaining.startsWith('$$')) {
      const end = remaining.indexOf('$$', 2);
      if (end === -1) { segments.push({ type: 'text', content: remaining }); break; }
      segments.push({ type: 'math-display', content: remaining.slice(2, end) });
      remaining = remaining.slice(end + 2);
    } else if (remaining.startsWith('\\begin{align')) {
      const closeTag = remaining.includes('\\begin{align*}') ? '\\end{align*}' : '\\end{align}';
      const openTag  = remaining.includes('\\begin{align*}') ? '\\begin{align*}' : '\\begin{align}';
      const end = remaining.indexOf(closeTag);
      if (end === -1) { segments.push({ type: 'text', content: remaining }); break; }
      segments.push({ type: 'math-display', content: remaining.slice(0, end + closeTag.length) });
      remaining = remaining.slice(end + closeTag.length);
    } else if (remaining.startsWith('$')) {
      const end = remaining.indexOf('$', 1);
      if (end === -1) { segments.push({ type: 'text', content: remaining }); break; }
      segments.push({ type: 'math-inline', content: remaining.slice(1, end) });
      remaining = remaining.slice(end + 1);
    } else {
      segments.push({ type: 'text', content: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return segments;
}

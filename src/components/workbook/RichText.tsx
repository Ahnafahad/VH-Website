'use client';

import React from 'react';
import { segmentContent, renderMath } from '@/lib/workbook/katex';

// Converts **bold** and _italic_ markers within a plain text segment.
function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldIdx   = remaining.indexOf('**');
    const italicIdx = remaining.indexOf('_');
    const next = Math.min(
      boldIdx   !== -1 ? boldIdx   : Infinity,
      italicIdx !== -1 ? italicIdx : Infinity,
    );

    if (next === Infinity) {
      parts.push(remaining);
      break;
    }

    if (next > 0) {
      parts.push(remaining.slice(0, next));
      remaining = remaining.slice(next);
      continue;
    }

    if (remaining.startsWith('**')) {
      const end = remaining.indexOf('**', 2);
      if (end === -1) { parts.push(remaining); break; }
      parts.push(<strong key={key++}>{remaining.slice(2, end)}</strong>);
      remaining = remaining.slice(end + 2);
    } else if (remaining.startsWith('_')) {
      const end = remaining.indexOf('_', 1);
      if (end === -1) { parts.push(remaining); break; }
      parts.push(<em key={key++}>{remaining.slice(1, end)}</em>);
      remaining = remaining.slice(end + 1);
    }
  }

  return parts;
}

interface RichTextProps {
  content: string;
  className?: string;
  inline?: boolean;
}

// Renders a string containing LaTeX math ($...$, $$...$$, \begin{align*}...)
// and markdown (**bold**, _italic_) into React nodes.
export default function RichText({ content, className, inline = false }: RichTextProps) {
  const segments = segmentContent(content);
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const seg of segments) {
    if (seg.type === 'text') {
      const mdParts = parseMarkdown(seg.content);
      for (const part of mdParts) {
        nodes.push(<React.Fragment key={key++}>{part}</React.Fragment>);
      }
    } else if (seg.type === 'math-inline') {
      const html = renderMath(seg.content, false);
      nodes.push(
        <span
          key={key++}
          className="katex-inline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (seg.type === 'math-display') {
      const html = renderMath(seg.content, true);
      nodes.push(
        <span
          key={key++}
          className="katex-display-wrap block my-3 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
  }

  if (inline) {
    return <span className={className}>{nodes}</span>;
  }

  return <span className={className}>{nodes}</span>;
}

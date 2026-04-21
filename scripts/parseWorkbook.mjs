#!/usr/bin/env node
// scripts/parseWorkbook.mjs
// Parses a LaTeX workbook chapter into structured JSON for the website.
// Usage: node scripts/parseWorkbook.mjs <input.tex> <output.json> [chapterNumber] [part]

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripComments(text) {
  // Remove LaTeX comments but preserve \% (escaped percent)
  return text.replace(/(?<!\\)%[^\n]*/g, '');
}

function slugify(text) {
  return text
    .replace(/\\&/g, 'and').replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

let _idCounter = 0;
function nextId() { return `b${_idCounter++}`; }

// Convert basic LaTeX inline markup to simplified form for the renderer.
// Keeps math ($...$, $$...$$) intact. Converts formatting commands.
function cleanInline(s) {
  if (!s) return '';

  // Strip structure-only commands
  s = s.replace(/\\medskip|\\bigskip|\\smallskip/g, '\n');
  s = s.replace(/\\newpage|\\clearpage|\\vfill|\\hfill/g, '');
  s = s.replace(/\\noindent|\\centering/g, '');
  s = s.replace(/\\normalsize|\\small|\\Large|\\large|\\footnotesize/g, '');
  s = s.replace(/\\label\{[^}]*\}/g, '');
  s = s.replace(/\\setcounter\{[^}]*\}\{[^}]*\}/g, '');
  s = s.replace(/\\renewcommand\{[^}]*\}\{[^}]*\}/g, '');
  s = s.replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, '');
  s = s.replace(/\\arraystretch|\\tabcolsep/g, '');
  s = s.replace(/\\scshape|\\itshape|\\bfseries/g, '');

  // Special characters
  s = s.replace(/\\&/g, '&');
  s = s.replace(/\\%/g, '%');
  s = s.replace(/\\ldots|\\dots/g, '...');
  s = s.replace(/---/g, '—');
  s = s.replace(/--/g, '–');
  s = s.replace(/``/g, '\u201C');
  s = s.replace(/''/g, '\u201D');
  s = s.replace(/\\,|\\;|\\:/g, '\u2009');

  // Font formatting – simple (non-nested) single-arg versions first
  // Nested handled by the React renderer via a stack-based approach
  s = s.replace(/\\textbf\{([^{}]*)\}/g, '**$1**');
  s = s.replace(/\\textit\{([^{}]*)\}/g, '_$1_');
  s = s.replace(/\\emph\{([^{}]*)\}/g, '_$1_');
  s = s.replace(/\\textsc\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\textcolor\{[^}]+\}\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\mbox\{([^{}]*)\}/g, '$1');

  // Spacing commands outside math
  s = s.replace(/\\quad\b/g, ' ');
  s = s.replace(/\\qquad\b/g, '  ');

  return s.trim();
}

// ─── Environment extractor ────────────────────────────────────────────────────
// Finds the FIRST \begin{envName}...\end{envName} in text, respecting nesting.
// Returns { before, content, after } or null.

function extractFirstEnv(text, envName) {
  const beginTag = `\\begin{${envName}}`;
  const endTag   = `\\end{${envName}}`;

  const startPos = text.indexOf(beginTag);
  if (startPos === -1) return null;

  let depth = 1;
  let i = startPos + beginTag.length;

  while (i < text.length && depth > 0) {
    const nb = text.indexOf(beginTag, i);
    const ne = text.indexOf(endTag,   i);

    if (ne === -1) return null; // malformed

    if (nb !== -1 && nb < ne) {
      depth++;
      i = nb + beginTag.length;
    } else {
      depth--;
      if (depth === 0) {
        return {
          before:  text.slice(0, startPos),
          content: text.slice(startPos + beginTag.length, ne),
          after:   text.slice(ne + endTag.length),
        };
      }
      i = ne + endTag.length;
    }
  }
  return null;
}

// Extract ALL top-level environments of given name from text.
function extractAllEnvs(text, envName) {
  const results = [];
  let remaining = text;
  while (true) {
    const r = extractFirstEnv(remaining, envName);
    if (!r) break;
    results.push(r.content);
    remaining = r.after;
  }
  return results;
}

// ─── List parser ──────────────────────────────────────────────────────────────
// Converts \begin{itemize}...\end{itemize} content to an array of strings.

function parseItemize(content) {
  const items = [];
  const parts = content.split(/\\item\b/);
  for (let i = 1; i < parts.length; i++) {
    const raw = parts[i].replace(/\[.*?\]/s, '').trim(); // strip optional arg
    items.push(cleanInline(raw));
  }
  return items;
}

// ─── Enumerate / MCQ parser ───────────────────────────────────────────────────
// Detects MCQ options: \begin{enumerate}[label=(\Alph*)]

function isMcqOptions(envContent) {
  // Options enumerate has items that are short: (A) text \item (B) text etc.
  // Detected by presence of \Alph* or (\alph*) in the outer enumerate signature
  return true; // caller checks context
}

// Parse options from \begin{enumerate}[label=(\Alph*)]...\end{enumerate}
function parseMcqOptions(content) {
  const labels = ['A','B','C','D','E','F'];
  const items = content.split(/\\item\b/).slice(1).map(s => s.trim());
  return items.map((text, idx) => ({
    label: labels[idx] ?? String(idx),
    text: cleanInline(text.replace(/\[.*?\]/s, '').trim()),
  }));
}

// ─── Box environment parser ───────────────────────────────────────────────────
// Parses content of a tcolorbox into a structured content string.
// Lists and align* blocks are extracted; rest becomes prose.

function parseBoxContent(raw) {
  // We'll store content as a LaTeX-like string but with comments removed.
  // The React renderer handles $...$ via KaTeX and ** via markdown.
  // We just do basic cleanup here.
  let text = raw;

  // Strip nested solutionbox (shouldn't appear in boxes, but defensive)
  const solEnv = extractFirstEnv(text, 'solutionbox');
  if (solEnv) text = solEnv.before + solEnv.after;

  return cleanInline(text);
}

// ─── Main content parser ──────────────────────────────────────────────────────

const BOX_ENVS = ['definitionbox','notebox','rulebox','passagebox','usagenotebox','challengebox'];

function parseContent(text, blocks, sections) {
  text = text.replace(/\r\n/g, '\n');

  while (text.trim()) {
    text = text.trimStart();
    if (!text) break;

    // ── Headings ────────────────────────────────────────────────────────────
    const sectionM = text.match(/^\\(section|subsection|subsubsection)\*?\{/);
    if (sectionM) {
      const cmd  = sectionM[1];
      const rest = text.slice(sectionM[0].length);
      // Find closing brace (no nesting in headings usually)
      const end = rest.indexOf('}');
      const title = cleanInline(rest.slice(0, end));
      const anchor = slugify(title);
      const type = cmd === 'section' ? 'section'
                 : cmd === 'subsection' ? 'subsection'
                 : 'subsubsection';

      blocks.push({ id: nextId(), type, content: title, anchor });
      if (type !== 'subsubsection') {
        sections.push({ id: anchor, title });
      }
      text = rest.slice(end + 1);
      continue;
    }

    // ── solutionbox → strip ──────────────────────────────────────────────────
    if (text.startsWith('\\begin{solutionbox}')) {
      const r = extractFirstEnv(text, 'solutionbox');
      if (r) { text = r.before + r.after; continue; }
    }

    // ── Box environments ─────────────────────────────────────────────────────
    const boxMatch = BOX_ENVS.find(e => text.startsWith(`\\begin{${e}}`));
    if (boxMatch) {
      const r = extractFirstEnv(text, boxMatch);
      if (r) {
        const typeMap = {
          definitionbox: 'definition', notebox: 'note',
          rulebox: 'rule', passagebox: 'passage',
          usagenotebox: 'usageNote', challengebox: 'challenge',
        };
        blocks.push({
          id: nextId(),
          type: typeMap[boxMatch],
          content: parseBoxContent(r.content),
        });
        text = r.after;
        continue;
      }
    }

    // ── align* math ──────────────────────────────────────────────────────────
    if (text.startsWith('\\begin{align*}') || text.startsWith('\\begin{align}')) {
      const envName = text.startsWith('\\begin{align*}') ? 'align*' : 'align';
      const r = extractFirstEnv(text, envName);
      if (r) {
        blocks.push({ id: nextId(), type: 'math', content: `\\begin{${envName}}${r.content}\\end{${envName}}` });
        text = r.after;
        continue;
      }
    }

    // ── Display math $$...$$ ─────────────────────────────────────────────────
    if (text.startsWith('$$')) {
      const end = text.indexOf('$$', 2);
      if (end !== -1) {
        blocks.push({ id: nextId(), type: 'math', content: text.slice(0, end + 2) });
        text = text.slice(end + 2);
        continue;
      }
    }

    // ── enumerate ────────────────────────────────────────────────────────────
    if (text.startsWith('\\begin{enumerate}')) {
      const r = extractFirstEnv(text, 'enumerate');
      if (r) {
        // Detect outer label to identify context
        const labelM = r.before ? '' : text.match(/\\begin\{enumerate\}\[([^\]]*)\]/)?.[1] ?? '';
        const sigLine = text.slice(0, text.indexOf('\n'));
        const isSolvedExamples = sigLine.includes('Example') || sigLine.includes('arabic');
        const isPractice = sigLine.includes('arabic') && !sigLine.includes('Example');

        parseEnumerate(r.content, sigLine, blocks);
        text = r.after;
        continue;
      }
    }

    // ── itemize ──────────────────────────────────────────────────────────────
    if (text.startsWith('\\begin{itemize}')) {
      const r = extractFirstEnv(text, 'itemize');
      if (r) {
        blocks.push({ id: nextId(), type: 'list', variant: 'bullet', items: parseItemize(r.content) });
        text = r.after;
        continue;
      }
    }

    // ── center / multicols → strip wrapper, keep content ────────────────────
    if (text.startsWith('\\begin{center}') || text.startsWith('\\begin{multicols}')) {
      const envName = text.startsWith('\\begin{center}') ? 'center' : 'multicols';
      const r = extractFirstEnv(text, envName);
      if (r) {
        // For center: check if it contains a tabular (table)
        if (envName === 'center' && r.content.includes('\\begin{tabular}')) {
          const tr = extractFirstEnv(r.content, 'tabular');
          if (tr) {
            blocks.push({ id: nextId(), type: 'table', content: r.content.trim() });
            text = r.after;
            continue;
          }
        }
        // Otherwise re-process inner content
        parseContent(r.content, blocks, sections);
        text = r.after;
        continue;
      }
    }

    // ── Strip miscellaneous commands ─────────────────────────────────────────
    const skipM = text.match(/^\\(newpage|clearpage|bigskip|medskip|smallskip|hline|toprule|midrule|bottomrule|noindent|vfill|hfill)\b\s*/);
    if (skipM) { text = text.slice(skipM[0].length); continue; }

    // ── Prose paragraph ──────────────────────────────────────────────────────
    // Collect text until next structural element
    let nextStruct = text.length;
    const structPatterns = [
      /\\begin\{/,
      /\\(section|subsection|subsubsection)\*?\{/,
      /\$\$/,
    ];
    for (const p of structPatterns) {
      const m = text.match(p);
      if (m && m.index < nextStruct) nextStruct = m.index;
    }

    const proseRaw = text.slice(0, nextStruct);
    const paragraphs = proseRaw.split(/\n{2,}/).map(p => cleanInline(p)).filter(Boolean);
    for (const p of paragraphs) {
      if (p.trim()) blocks.push({ id: nextId(), type: 'prose', content: p });
    }
    text = text.slice(nextStruct);
  }
}

// ─── Enumerate handler ────────────────────────────────────────────────────────

function parseEnumerate(content, sigLine, blocks) {
  // Split by \item at top level (not nested)
  const items = splitTopLevelItems(content);

  const isMcqContainer = sigLine.includes('arabic') || sigLine.includes('Example');

  if (!isMcqContainer) {
    // Simple ordered list
    blocks.push({ id: nextId(), type: 'list', variant: 'ordered', items: items.map(i => cleanInline(i)) });
    return;
  }

  // Each item is a question (MCQ or prose); skip degenerate header items
  for (const itemRaw of items) {
    if (itemRaw.startsWith('[') || !itemRaw.trim()) continue;
    parseMcqItem(itemRaw, sigLine, blocks);
  }
}

function splitTopLevelItems(content) {
  // Strip leading optional enumerate argument [label=..., ...] before first \item
  let c = content.trimStart();
  if (c.startsWith('[')) {
    // Find the matching ] — handles nested {} but not nested []
    let depth = 0, end = -1;
    for (let k = 0; k < c.length; k++) {
      if (c[k] === '[') depth++;
      else if (c[k] === ']') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end !== -1) c = c.slice(end + 1);
  }
  content = c;

  // Split on \item at depth 0 (not inside an environment)
  const items = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < content.length) {
    if (content.slice(i).startsWith('\\begin{')) {
      depth++;
      current += content[i];
      i++;
    } else if (content.slice(i).startsWith('\\end{')) {
      depth--;
      current += content[i];
      i++;
    } else if (content.slice(i).startsWith('\\item') && depth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
      i += 5;
      // Skip optional arg \item[...]
      if (content[i] === '[') {
        let d2 = 0, j = i;
        for (; j < content.length; j++) {
          if (content[j] === '[') d2++;
          else if (content[j] === ']') { d2--; if (d2 === 0) { i = j + 1; break; } }
        }
      }
      if (content[i] === ' ') i++;
    } else {
      current += content[i];
      i++;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function parseMcqItem(raw, sigLine, blocks) {
  let text = raw;

  // Extract question text (before first \begin{...} or options pattern)
  // Question may be wrapped in \textit{...}
  let question = '';
  let rest = text;

  // Check for \textit{...} question
  const textitM = text.match(/^\\textit\{/);
  if (textitM) {
    const r = extractFirstEnv(text.replace('\\textit{', '\\begin{__tit__}'), '__tit__');
    // Simpler: find closing } for \textit
    const inner = extractArgContent(text.slice(8)); // after \textit{
    question = cleanInline(inner.content);
    rest = text.slice(8 + inner.length + 1);
  } else {
    // Question runs until first \begin{ or \n\n
    const nextBegin = text.indexOf('\\begin{');
    const nextDouble = text.indexOf('\n\n');
    let qEnd = text.length;
    if (nextBegin !== -1 && nextBegin < qEnd) qEnd = nextBegin;
    if (nextDouble !== -1 && nextDouble < qEnd) qEnd = nextDouble;
    question = cleanInline(text.slice(0, qEnd));
    rest = text.slice(qEnd);
  }

  // Extract options from \begin{enumerate}[label=(\Alph*)]
  let options = [];
  const optEnv = extractFirstEnv(rest, 'enumerate');
  if (optEnv) {
    options = parseMcqOptions(optEnv.content);
    rest = optEnv.before + optEnv.after;
    // Also strip multicols wrapper
    const mc = extractFirstEnv(rest, 'multicols');
    if (mc) rest = mc.before + mc.after;
  }

  // Extract correct answer from solutionbox if present
  let correctLabel = null;
  let solutionExplanation = null;
  const solEnv = extractFirstEnv(rest, 'solutionbox');
  if (solEnv) {
    const solContent = solEnv.content;
    const ansM = solContent.match(/\\textbf\{Answer:\s*\(([A-E])\)\}/i)
               || solContent.match(/Answer:\s*\(([A-E])\)/i)
               || solContent.match(/\*\*Answer.*?\(([A-E])\)\*\*/i);
    if (ansM) correctLabel = ansM[1];
    // Extract brief explanation (everything before "Answer:")
    const expPart = solContent.replace(/\\textbf\{Answer.*?\}/g, '').replace(/\n+/g, ' ');
    solutionExplanation = cleanInline(expPart).trim();
    rest = solEnv.before + solEnv.after;
  }

  // Determine question type
  const isSolvedExample = sigLine.includes('Example');
  const isChallenge = sigLine.includes('challenge') || sigLine.toLowerCase().includes('hard');
  const questionType = isSolvedExample ? 'solved' : isChallenge ? 'challenge' : 'practice';

  if (!question.trim() && options.length === 0) return;

  blocks.push({
    id: nextId(),
    type: 'mcq',
    question: question.trim(),
    questionType,
    options,
    correctLabel,
    ...(solutionExplanation && { solutionHint: solutionExplanation }),
  });
}

// Extract content of {arg} starting right after the opening brace
function extractArgContent(s) {
  let depth = 0;
  let i = 0;
  let content = '';
  // s starts after '{'
  depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') { depth++; content += '{'; }
    else if (s[i] === '}') { depth--; if (depth > 0) content += '}'; }
    else content += s[i];
    i++;
  }
  return { content, length: i };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function parseChapterFile(texPath, chapterNumber, partSlug) {
  _idCounter = 0;
  const raw = readFileSync(texPath, 'utf8');
  let text = stripComments(raw).replace(/\r\n/g, '\n');

  const blocks = [];
  const sections = [];

  // Chapter title
  const chapterM = text.match(/\\chapter\{([^}]+)\}/);
  let title = 'Untitled';
  if (chapterM) {
    title = cleanInline(chapterM[1]);
    text = text.slice(chapterM.index + chapterM[0].length);
  }

  // Intro prose before first structure (chapter-level description)
  parseContent(text, blocks, sections);

  // Estimate reading time (~200 wpm for study content)
  const wordCount = blocks.reduce((n, b) => {
    const words = (b.content || b.question || '').split(/\s+/).length;
    return n + words + (b.items?.join(' ').split(/\s+/).length ?? 0);
  }, 0);
  const estimatedMinutes = Math.max(20, Math.round(wordCount / 150));

  return {
    slug: slugify(title),
    part: partSlug,
    chapterNumber,
    title,
    estimatedMinutes,
    sections,
    blocks,
  };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const [,, inputTex, outputJson, chNum, partSlug] = process.argv;

if (!inputTex || !outputJson) {
  console.error('Usage: node parseWorkbook.mjs <input.tex> <output.json> [chapterNum] [part]');
  process.exit(1);
}

const result = parseChapterFile(inputTex, parseInt(chNum ?? '1'), partSlug ?? 'mathematics');
const outDir = dirname(outputJson);
mkdirSync(outDir, { recursive: true });
writeFileSync(outputJson, JSON.stringify(result, null, 2));
console.log(`✓ Parsed "${result.title}" → ${result.blocks.length} blocks, ${result.sections.length} sections`);
console.log(`  Output: ${outputJson}`);

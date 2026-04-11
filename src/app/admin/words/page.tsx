'use client';

/**
 * /admin/words — Word Bank Management
 *
 * Three sections:
 *   1. CSV / JSON Import — drag-and-drop, parse & preview, bulk import
 *   2. Unit & Theme Management — accordion hierarchy, inline rename, delete with confirm
 *   3. Word List — cascading unit→theme filter, search, paginated table, add/edit modal
 *
 * Light mode, Linear-inspired editorial aesthetic.
 * Admin only — redirected by AdminLayout.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  BookOpen,
  Database,
  FolderOpen,
  Tag,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VocabUnit {
  id: number;
  name: string;
  description: string | null;
  order: number;
  themeCount: number;
  themes: VocabTheme[];
}

interface VocabTheme {
  id: number;
  unitId: number;
  name: string;
  order: number;
}

interface VocabWord {
  id: number;
  themeId: number;
  unitId: number;
  word: string;
  definition: string;
  synonyms: string;
  antonyms: string;
  exampleSentence: string;
  partOfSpeech: string;
  difficultyBase: number;
}

interface WordImportRow {
  word: string;
  definition: string;
  synonyms?: string;
  antonyms?: string;
  example_sentence?: string;
  part_of_speech?: string;
  unit_id: number;
  theme_id: number;
  difficulty_base?: number;
}

interface Toast {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ModalState {
  open: boolean;
  word: Partial<VocabWord> | null;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser — handles quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

function csvRowToImportRow(row: Record<string, string>): WordImportRow {
  return {
    word:             row['word']            ?? '',
    definition:       row['definition']      ?? '',
    synonyms:         row['synonyms']        ?? '',
    antonyms:         row['antonyms']        ?? '',
    example_sentence: row['exampleSentence'] ?? row['example_sentence'] ?? '',
    part_of_speech:   row['partOfSpeech']    ?? row['part_of_speech']   ?? '',
    unit_id:          Number(row['unitId']   ?? row['unit_id']          ?? 0),
    theme_id:         Number(row['themeId']  ?? row['theme_id']         ?? 0),
    difficulty_base:  row['difficultyBase'] || row['difficulty_base']
      ? Number(row['difficultyBase'] ?? row['difficulty_base'])
      : undefined,
  };
}

// ─── Motion variants ──────────────────────────────────────────────────────────

const fadeIn: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 400, damping: 32 },
  },
};

const accordionContent: Variants = {
  hidden:  { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { type: 'spring' as const, stiffness: 380, damping: 34 },
  },
};

const modalOverlay: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
};

const modalPanel: Variants = {
  hidden:  { opacity: 0, scale: 0.97, y: 10 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 420, damping: 30 },
  },
};

// ─── Section tab types ────────────────────────────────────────────────────────

type ActiveSection = 'import' | 'structure' | 'words';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WordsAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<ActiveSection>('import');
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && !session?.user?.isAdmin) router.push('/');
  }, [status, session, router]);

  function showToast(type: Toast['type'], message: string) {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ type, message });
    toastTimeout.current = setTimeout(() => setToast(null), 5000);
  }

  if (status === 'loading') {
    return (
      <div style={s.loadingPage}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#D62B38' }} />
      </div>
    );
  }

  return (
    <div style={s.page}>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12, x: '-50%' }}
            animate={{ opacity: 1, y: 0,   x: '-50%' }}
            exit={{   opacity: 0, y: -12, x: '-50%' }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
            style={{
              ...s.toast,
              ...(toast.type === 'success' ? s.toastSuccess
                : toast.type === 'error'   ? s.toastError
                : s.toastInfo),
            }}
            role="alert"
            aria-live="polite"
          >
            {toast.type === 'success' && <CheckCircle size={14} />}
            {toast.type === 'error'   && <AlertTriangle size={14} />}
            {toast.type === 'info'    && <Info size={14} />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              style={s.toastClose}
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible" style={s.pageHeader}>
        <div style={s.pageHeaderLeft}>
          <div style={s.pageTitleRow}>
            <Database size={18} style={{ color: '#D62B38', flexShrink: 0 }} />
            <h1 style={s.pageTitle}>Word Bank</h1>
          </div>
          <p style={s.pageSubtitle}>Import vocabulary, manage units &amp; themes, edit words</p>
        </div>
      </motion.div>

      {/* ── Section Tabs ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible" style={s.tabs}>
        {([ 'import', 'structure', 'words' ] as ActiveSection[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            style={{
              ...s.tab,
              ...(activeSection === tab ? s.tabActive : {}),
            }}
          >
            {tab === 'import'    && <Upload size={13} style={{ flexShrink: 0 }} />}
            {tab === 'structure' && <FolderOpen size={13} style={{ flexShrink: 0 }} />}
            {tab === 'words'     && <BookOpen size={13} style={{ flexShrink: 0 }} />}
            {tab === 'import'    ? 'Import' : tab === 'structure' ? 'Units & Themes' : 'Words'}
          </button>
        ))}
      </motion.div>

      {/* ── Sections ──────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeSection === 'import' && (
          <ImportSection key="import" onToast={showToast} />
        )}
        {activeSection === 'structure' && (
          <StructureSection key="structure" onToast={showToast} />
        )}
        {activeSection === 'words' && (
          <WordsSection key="words" onToast={showToast} />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Import
// ══════════════════════════════════════════════════════════════════════════════

function ImportSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  const [dragOver,    setDragOver]    = useState(false);
  const [fileName,    setFileName]    = useState<string | null>(null);
  const [parsed,      setParsed]      = useState<WordImportRow[] | null>(null);
  const [parseError,  setParseError]  = useState<string | null>(null);
  const [importing,   setImporting]   = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number; updated: number; errors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileInput(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setParseError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let rows: WordImportRow[];

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          rows = Array.isArray(json) ? json : json.words ?? [];
        } else {
          const { rows: csvRows } = parseCSV(text);
          rows = csvRows.map(csvRowToImportRow);
        }

        if (rows.length === 0) {
          setParseError('No rows found in file.');
          return;
        }
        setParsed(rows);
      } catch (err) {
        setParseError(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileInput(file);
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setImportResult(null);

    try {
      const res  = await fetch('/api/admin/words/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ words: parsed }),
      });
      const data = await res.json();

      if (!res.ok) {
        onToast('error', data.error ?? 'Import failed.');
        return;
      }

      setImportResult(data);
      if (data.errors?.length === 0) {
        onToast('success', `Imported ${data.imported}, updated ${data.updated} word(s).`);
      } else {
        onToast('info', `Done — ${data.errors.length} error(s). See below.`);
      }
    } catch {
      onToast('error', 'Network error. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  function resetAll() {
    setParsed(null);
    setFileName(null);
    setParseError(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const preview = parsed?.slice(0, 5) ?? [];

  return (
    <motion.div
      key="import-sec"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -4 }}
      style={s.section}
    >
      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          ...s.dropzone,
          ...(dragOver ? s.dropzoneOver : {}),
          ...(fileName  ? s.dropzoneHasFile : {}),
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload CSV or JSON file"
        onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={e => handleFileInput(e.target.files?.[0] ?? null)}
          aria-hidden
        />

        <div style={s.dropzoneInner}>
          {fileName ? (
            <>
              <div style={{ ...s.dropzoneIcon, background: '#FEF2F2' }}>
                <FileText size={22} style={{ color: '#D62B38' }} />
              </div>
              <div>
                <p style={{ ...s.dropzoneText, color: '#111827', fontWeight: 600 }}>{fileName}</p>
                <p style={{ ...s.dropzoneSubtext, color: '#D62B38' }}>
                  {parsed ? `${parsed.length} row(s) parsed` : 'Parsing...'}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); resetAll(); }}
                style={s.dropzoneReset}
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <div style={s.dropzoneIcon}>
                <Upload size={22} style={{ color: '#6B7280' }} />
              </div>
              <div>
                <p style={s.dropzoneText}>
                  {dragOver ? 'Drop to upload' : 'Drag & drop a file, or click to browse'}
                </p>
                <p style={s.dropzoneSubtext}>Accepts .csv and .json files</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Format hint ────────────────────────────────────────────────────── */}
      <div style={s.hintBox}>
        <Info size={12} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 1 }} />
        <span style={s.hintText}>
          <strong>CSV columns:</strong>{' '}
          word, definition, synonyms, antonyms, exampleSentence, partOfSpeech, unitId, themeId, difficultyBase
          &nbsp;&mdash;&nbsp;
          <strong>JSON:</strong> array of objects with same keys (camelCase or snake_case both accepted)
        </span>
      </div>

      {/* ── Parse error ────────────────────────────────────────────────────── */}
      {parseError && (
        <div style={s.errorBox}>
          <AlertTriangle size={14} style={{ color: '#B91C1C', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#991B1B' }}>{parseError}</span>
        </div>
      )}

      {/* ── Preview table ──────────────────────────────────────────────────── */}
      {parsed && parsed.length > 0 && (
        <div style={s.previewWrap}>
          <p style={s.previewLabel}>
            Preview — first {Math.min(5, parsed.length)} of {parsed.length} rows
          </p>
          <div style={s.tableScroll}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['word','definition','synonyms','antonyms','example_sentence','part_of_speech','unit_id','theme_id','difficulty_base'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={i % 2 === 0 ? s.trEven : {}}>
                    <td style={s.td}>{row.word}</td>
                    <td style={{ ...s.td, maxWidth: 180 }}>
                      <span style={s.truncate}>{row.definition}</span>
                    </td>
                    <td style={s.td}>{row.synonyms ?? ''}</td>
                    <td style={s.td}>{row.antonyms ?? ''}</td>
                    <td style={{ ...s.td, maxWidth: 180 }}>
                      <span style={s.truncate}>{row.example_sentence ?? ''}</span>
                    </td>
                    <td style={s.td}>{row.part_of_speech ?? ''}</td>
                    <td style={s.td}>{row.unit_id}</td>
                    <td style={s.td}>{row.theme_id}</td>
                    <td style={s.td}>{row.difficulty_base ?? 3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Import button ──────────────────────────────────────────────────── */}
      {parsed && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleImport}
            disabled={importing}
            style={importing ? { ...s.primaryBtn, opacity: 0.65, cursor: 'wait' } : s.primaryBtn}
          >
            {importing
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</>
              : <><Upload size={14} /> Import All ({parsed.length} rows)</>
            }
          </button>
          <button onClick={resetAll} style={s.ghostBtn}>
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* ── Import result ──────────────────────────────────────────────────── */}
      {importResult && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          style={s.resultBox}
        >
          <div style={s.resultRow}>
            <div style={{ ...s.resultStat, background: '#F0FDF4', borderColor: '#BBF7D0' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>{importResult.imported}</span>
              <span style={{ fontSize: 11, color: '#166534' }}>Imported</span>
            </div>
            <div style={{ ...s.resultStat, background: '#EFF6FF', borderColor: '#BFDBFE' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#1D4ED8' }}>{importResult.updated}</span>
              <span style={{ fontSize: 11, color: '#1D4ED8' }}>Updated</span>
            </div>
            <div style={{ ...s.resultStat, background: importResult.errors.length ? '#FEF2F2' : '#F0FDF4', borderColor: importResult.errors.length ? '#FECACA' : '#BBF7D0' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: importResult.errors.length ? '#B91C1C' : '#166534' }}>{importResult.errors.length}</span>
              <span style={{ fontSize: 11, color: importResult.errors.length ? '#B91C1C' : '#166534' }}>Errors</span>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <ul style={s.errorList}>
              {importResult.errors.map((e, i) => (
                <li key={i} style={s.errorItem}>
                  <AlertTriangle size={11} style={{ color: '#B91C1C', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#7F1D1D' }}>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Unit & Theme Structure
// ══════════════════════════════════════════════════════════════════════════════

function StructureSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  const [units,   setUnits]   = useState<VocabUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded accordion state
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Inline edit state: { id, level: 'unit'|'theme', value }
  const [editing, setEditing] = useState<{ id: number; level: 'unit' | 'theme'; value: string } | null>(null);

  // Inline delete confirm state
  const [delConfirm, setDelConfirm] = useState<{ id: number; level: 'unit' | 'theme'; name: string } | null>(null);

  // Add unit/theme form state
  const [addingUnit,       setAddingUnit]       = useState(false);
  const [newUnitName,      setNewUnitName]       = useState('');
  const [addingThemeFor,   setAddingThemeFor]    = useState<number | null>(null);
  const [newThemeName,     setNewThemeName]      = useState('');

  const [saving, setSaving] = useState(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/units');
      const data = await res.json();
      if (Array.isArray(data)) setUnits(data);
      else if (Array.isArray(data.units)) setUnits(data.units);
    } catch {
      onToast('error', 'Failed to load units.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  function toggleExpand(unitId: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  // ── Add unit ──────────────────────────────────────────────────────────────
  async function handleAddUnit() {
    const name = newUnitName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/admin/units', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onToast('success', `Unit "${name}" created.`);
      setNewUnitName('');
      setAddingUnit(false);
      fetchUnits();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Error creating unit.');
    } finally {
      setSaving(false);
    }
  }

  // ── Add theme ─────────────────────────────────────────────────────────────
  async function handleAddTheme(unitId: number) {
    const name = newThemeName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/admin/themes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, unitId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onToast('success', `Theme "${name}" created.`);
      setNewThemeName('');
      setAddingThemeFor(null);
      fetchUnits();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Error creating theme.');
    } finally {
      setSaving(false);
    }
  }

  // ── Rename (save) ─────────────────────────────────────────────────────────
  async function handleRenameSave() {
    if (!editing) return;
    const name = editing.value.trim();
    if (!name) return;
    setSaving(true);
    try {
      const endpoint = editing.level === 'unit'
        ? `/api/admin/units/${editing.id}`
        : `/api/admin/themes/${editing.id}`;
      const res = await fetch(endpoint, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onToast('success', `Renamed to "${name}".`);
      setEditing(null);
      fetchUnits();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Rename failed.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!delConfirm) return;
    setSaving(true);
    try {
      const endpoint = delConfirm.level === 'unit'
        ? `/api/admin/units/${delConfirm.id}`
        : `/api/admin/themes/${delConfirm.id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onToast('success', `"${delConfirm.name}" deleted.`);
      setDelConfirm(null);
      fetchUnits();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" style={s.loadingCard}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#D62B38' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>Loading units…</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="structure-sec"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -4 }}
      style={s.section}
    >

      {/* ── Delete confirm modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {delConfirm && (
          <motion.div
            key="del-overlay"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={s.modalOverlay}
            onClick={() => setDelConfirm(null)}
          >
            <motion.div
              variants={modalPanel}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={s.confirmPanel}
              onClick={e => e.stopPropagation()}
            >
              <div style={s.confirmIcon}>
                <AlertTriangle size={20} style={{ color: '#B91C1C' }} />
              </div>
              <h3 style={s.confirmTitle}>Delete &ldquo;{delConfirm.name}&rdquo;?</h3>
              <p style={s.confirmDesc}>
                This will permanently remove the {delConfirm.level}{' '}
                and <strong>all associated {delConfirm.level === 'unit' ? 'themes and words' : 'words'}</strong>.
                This cannot be undone.
              </p>
              <div style={s.confirmActions}>
                <button
                  onClick={() => setDelConfirm(null)}
                  style={s.ghostBtn}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={saving}
                  style={saving
                    ? { ...s.dangerBtn, opacity: 0.65, cursor: 'wait' }
                    : s.dangerBtn
                  }
                >
                  {saving
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Trash2 size={13} />
                  }
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Unit button ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
          {units.length} unit{units.length !== 1 ? 's' : ''}
        </p>
        {!addingUnit && (
          <button onClick={() => setAddingUnit(true)} style={s.primaryBtn}>
            <Plus size={13} /> Add Unit
          </button>
        )}
      </div>

      {/* ── Add Unit inline form ─────────────────────────────────────────── */}
      <AnimatePresence>
        {addingUnit && (
          <motion.div
            key="add-unit"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, height: 0 }}
            style={s.inlineForm}
          >
            <input
              autoFocus
              value={newUnitName}
              onChange={e => setNewUnitName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddUnit();
                if (e.key === 'Escape') { setAddingUnit(false); setNewUnitName(''); }
              }}
              placeholder="Unit name…"
              style={s.inlineInput}
              aria-label="New unit name"
            />
            <button
              onClick={handleAddUnit}
              disabled={!newUnitName.trim() || saving}
              style={!newUnitName.trim() || saving
                ? { ...s.iconBtn, opacity: 0.5, cursor: 'default' }
                : { ...s.iconBtn, background: '#D62B38', color: '#fff' }
              }
              aria-label="Save unit"
            >
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
            </button>
            <button
              onClick={() => { setAddingUnit(false); setNewUnitName(''); }}
              style={s.iconBtn}
              aria-label="Cancel"
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Units accordion ──────────────────────────────────────────────── */}
      {units.length === 0 && !addingUnit && (
        <div style={s.emptyState}>
          <FolderOpen size={28} style={{ color: '#D1D5DB' }} />
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#9CA3AF' }}>No units yet. Add one above.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {units.map(unit => {
          const isOpen = expanded.has(unit.id);
          const isEditingUnit = editing?.id === unit.id && editing?.level === 'unit';

          return (
            <div key={unit.id} style={s.unitCard}>
              {/* Unit header row */}
              <div style={s.unitHeader}>
                <button
                  onClick={() => toggleExpand(unit.id)}
                  style={s.expandBtn}
                  aria-label={isOpen ? `Collapse ${unit.name}` : `Expand ${unit.name}`}
                  aria-expanded={isOpen}
                >
                  {isOpen
                    ? <ChevronDown size={14} style={{ color: '#6B7280' }} />
                    : <ChevronRight size={14} style={{ color: '#6B7280' }} />
                  }
                </button>

                {isEditingUnit ? (
                  <>
                    <input
                      autoFocus
                      value={editing.value}
                      onChange={e => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSave();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      style={{ ...s.inlineInput, flex: 1, marginRight: 6 }}
                      aria-label="Rename unit"
                    />
                    <button
                      onClick={handleRenameSave}
                      disabled={!editing.value.trim() || saving}
                      style={!editing.value.trim() || saving
                        ? { ...s.iconBtn, opacity: 0.5, cursor: 'default' }
                        : { ...s.iconBtn, background: '#D62B38', color: '#fff' }
                      }
                      aria-label="Save rename"
                    >
                      {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                    </button>
                    <button onClick={() => setEditing(null)} style={s.iconBtn} aria-label="Cancel rename">
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <span style={s.unitName}>{unit.name}</span>
                    <span style={s.unitCount}>{unit.themeCount} theme{unit.themeCount !== 1 ? 's' : ''}</span>
                    <div style={s.rowActions}>
                      <button
                        onClick={() => setEditing({ id: unit.id, level: 'unit', value: unit.name })}
                        style={s.actionBtn}
                        aria-label={`Rename unit ${unit.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setDelConfirm({ id: unit.id, level: 'unit', name: unit.name })}
                        style={{ ...s.actionBtn, color: '#B91C1C' }}
                        aria-label={`Delete unit ${unit.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Themes (expanded) */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    key="themes"
                    variants={accordionContent}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={s.themeList}>
                      {unit.themes.length === 0 && (
                        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 8px 28px' }}>
                          No themes yet.
                        </p>
                      )}

                      {unit.themes.map(theme => {
                        const isEditingTheme = editing?.id === theme.id && editing?.level === 'theme';
                        return (
                          <div key={theme.id} style={s.themeRow}>
                            <Tag size={11} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                            {isEditingTheme ? (
                              <>
                                <input
                                  autoFocus
                                  value={editing.value}
                                  onChange={e => setEditing({ ...editing, value: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameSave();
                                    if (e.key === 'Escape') setEditing(null);
                                  }}
                                  style={{ ...s.inlineInput, flex: 1, marginRight: 6 }}
                                  aria-label="Rename theme"
                                />
                                <button
                                  onClick={handleRenameSave}
                                  disabled={!editing.value.trim() || saving}
                                  style={!editing.value.trim() || saving
                                    ? { ...s.iconBtn, opacity: 0.5, cursor: 'default', padding: '3px 6px' }
                                    : { ...s.iconBtn, background: '#D62B38', color: '#fff', padding: '3px 6px' }
                                  }
                                >
                                  {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
                                </button>
                                <button onClick={() => setEditing(null)} style={{ ...s.iconBtn, padding: '3px 6px' }}>
                                  <X size={11} />
                                </button>
                              </>
                            ) : (
                              <>
                                <span style={s.themeName}>{theme.name}</span>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                  <button
                                    onClick={() => setEditing({ id: theme.id, level: 'theme', value: theme.name })}
                                    style={s.actionBtn}
                                    aria-label={`Rename theme ${theme.name}`}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    onClick={() => setDelConfirm({ id: theme.id, level: 'theme', name: theme.name })}
                                    style={{ ...s.actionBtn, color: '#B91C1C' }}
                                    aria-label={`Delete theme ${theme.name}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {/* Add theme row */}
                      {addingThemeFor === unit.id ? (
                        <div style={{ ...s.inlineForm, paddingLeft: 28, paddingBottom: 8 }}>
                          <input
                            autoFocus
                            value={newThemeName}
                            onChange={e => setNewThemeName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAddTheme(unit.id);
                              if (e.key === 'Escape') { setAddingThemeFor(null); setNewThemeName(''); }
                            }}
                            placeholder="Theme name…"
                            style={s.inlineInput}
                            aria-label="New theme name"
                          />
                          <button
                            onClick={() => handleAddTheme(unit.id)}
                            disabled={!newThemeName.trim() || saving}
                            style={!newThemeName.trim() || saving
                              ? { ...s.iconBtn, opacity: 0.5, cursor: 'default', padding: '3px 8px' }
                              : { ...s.iconBtn, background: '#D62B38', color: '#fff', padding: '3px 8px' }
                            }
                          >
                            {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={() => { setAddingThemeFor(null); setNewThemeName(''); }}
                            style={{ ...s.iconBtn, padding: '3px 8px' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingThemeFor(unit.id); setNewThemeName(''); }}
                          style={s.addThemeBtn}
                        >
                          <Plus size={11} /> Add Theme
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Word List
// ══════════════════════════════════════════════════════════════════════════════

const WORDS_PER_PAGE = 20;

function WordsSection({ onToast }: { onToast: (type: Toast['type'], msg: string) => void }) {
  const [units,      setUnits]      = useState<VocabUnit[]>([]);
  const [words,      setWords]      = useState<VocabWord[]>([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);

  const [filterUnit,  setFilterUnit]  = useState<number | ''>('');
  const [filterTheme, setFilterTheme] = useState<number | ''>('');
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [modal,       setModal]       = useState<ModalState>({ open: false, word: null });
  const [delConfirm,  setDelConfirm]  = useState<{ id: number; word: string } | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Edit form state
  const [formState, setFormState] = useState<Partial<VocabWord>>({});

  // Debounce search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/units');
      const data = await res.json();
      if (Array.isArray(data)) setUnits(data);
      else if (Array.isArray(data.units)) setUnits(data.units);
    } catch { /* ignore */ }
  }, []);

  const fetchWords = useCallback(async (
    pg: number,
    uId: number | '',
    tId: number | '',
    q: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(WORDS_PER_PAGE) });
      if (uId)  params.set('unitId',  String(uId));
      if (tId)  params.set('themeId', String(tId));
      if (q)    params.set('search',  q);

      const res  = await fetch(`/api/admin/words?${params}`);
      const data = await res.json();
      setWords(data.words ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      onToast('error', 'Failed to load words.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    fetchUnits();
    fetchWords(1, '', '', '');
  }, [fetchUnits, fetchWords]);

  // Cascading filter: when unit changes, reset theme
  function handleUnitChange(val: number | '') {
    setFilterUnit(val);
    setFilterTheme('');
    setPage(1);
    fetchWords(1, val, '', search);
  }
  function handleThemeChange(val: number | '') {
    setFilterTheme(val);
    setPage(1);
    fetchWords(1, filterUnit, val, search);
  }
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
      fetchWords(1, filterUnit, filterTheme, val);
    }, 350);
  }
  function handlePageChange(pg: number) {
    setPage(pg);
    fetchWords(pg, filterUnit, filterTheme, search);
  }

  // Themes for selected unit
  const availableThemes = useMemo(() => {
    if (!filterUnit) return [];
    const unit = units.find(u => u.id === Number(filterUnit));
    return unit?.themes ?? [];
  }, [units, filterUnit]);

  // ── Modal open ────────────────────────────────────────────────────────────
  function openAddModal() {
    setFormState({
      word: '', definition: '', synonyms: '', antonyms: '',
      exampleSentence: '', partOfSpeech: '', difficultyBase: 3,
      unitId: filterUnit || undefined,
      themeId: filterTheme || undefined,
    });
    setModal({ open: true, word: null });
  }
  function openEditModal(word: VocabWord) {
    setFormState({ ...word });
    setModal({ open: true, word });
  }
  function closeModal() {
    setModal({ open: false, word: null });
    setFormState({});
  }

  // ── Save word ─────────────────────────────────────────────────────────────
  async function handleSaveWord() {
    const isEdit = modal.word?.id !== undefined;
    setSaving(true);

    try {
      // Parse synonyms/antonyms from comma string to array
      const synonymsArr = typeof formState.synonyms === 'string'
        ? formState.synonyms.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const antonymsArr = typeof formState.antonyms === 'string'
        ? formState.antonyms.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      if (isEdit) {
        const res = await fetch(`/api/admin/words/${modal.word!.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            ...formState,
            synonyms: synonymsArr,
            antonyms: antonymsArr,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
        onToast('success', `Word "${formState.word}" updated.`);
      } else {
        // POST to import with a single word
        const res = await fetch('/api/admin/words/import', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            words: [{
              word:             formState.word?.trim(),
              definition:       formState.definition?.trim(),
              synonyms:         synonymsArr.join(', '),
              antonyms:         antonymsArr.join(', '),
              example_sentence: formState.exampleSentence?.trim(),
              part_of_speech:   formState.partOfSpeech?.trim(),
              unit_id:          formState.unitId,
              theme_id:         formState.themeId,
              difficulty_base:  formState.difficultyBase,
            }],
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
        const data = await res.json();
        if (data.errors?.length) throw new Error(data.errors[0]);
        onToast('success', `Word "${formState.word}" added.`);
      }

      closeModal();
      fetchWords(page, filterUnit, filterTheme, search);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete word ───────────────────────────────────────────────────────────
  async function handleDeleteWord() {
    if (!delConfirm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/words/${delConfirm.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onToast('success', `"${delConfirm.word}" deleted.`);
      setDelConfirm(null);
      fetchWords(page, filterUnit, filterTheme, search);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setSaving(false);
    }
  }

  // Synonyms/antonyms display helper
  function parseSynonyms(json: string): string {
    try { return JSON.parse(json).join(', '); } catch { return json; }
  }

  // ── All themes for modal unit picker ─────────────────────────────────────
  const modalThemes = useMemo(() => {
    if (!formState.unitId) return [];
    const unit = units.find(u => u.id === Number(formState.unitId));
    return unit?.themes ?? [];
  }, [units, formState.unitId]);

  return (
    <motion.div
      key="words-sec"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -4 }}
      style={s.section}
    >

      {/* ── Word edit/add modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <motion.div
            key="word-modal-overlay"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={s.modalOverlay}
            onClick={closeModal}
          >
            <motion.div
              variants={modalPanel}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={s.modalPanel}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={modal.word ? 'Edit word' : 'Add word'}
            >
              {/* Modal header */}
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>{modal.word ? 'Edit Word' : 'Add Word'}</h3>
                <button onClick={closeModal} style={s.iconBtn} aria-label="Close modal">
                  <X size={15} />
                </button>
              </div>

              {/* Modal body */}
              <div style={s.modalBody}>
                {/* Word */}
                <div style={s.formField}>
                  <label style={s.label} htmlFor="wf-word">Word <span style={{ color: '#D62B38' }}>*</span></label>
                  <input
                    id="wf-word"
                    value={formState.word ?? ''}
                    onChange={e => setFormState(p => ({ ...p, word: e.target.value }))}
                    style={s.input}
                    placeholder="e.g. ephemeral"
                  />
                </div>

                {/* Definition */}
                <div style={s.formField}>
                  <label style={s.label} htmlFor="wf-def">Definition <span style={{ color: '#D62B38' }}>*</span></label>
                  <textarea
                    id="wf-def"
                    value={formState.definition ?? ''}
                    onChange={e => setFormState(p => ({ ...p, definition: e.target.value }))}
                    style={{ ...s.input, height: 72, resize: 'vertical' }}
                    placeholder="Lasting for a very short time"
                  />
                </div>

                {/* Row: Part of speech + Difficulty */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...s.formField, flex: 1 }}>
                    <label style={s.label} htmlFor="wf-pos">Part of Speech</label>
                    <input
                      id="wf-pos"
                      value={formState.partOfSpeech ?? ''}
                      onChange={e => setFormState(p => ({ ...p, partOfSpeech: e.target.value }))}
                      style={s.input}
                      placeholder="adjective"
                    />
                  </div>
                  <div style={{ ...s.formField, width: 100 }}>
                    <label style={s.label} htmlFor="wf-diff">Difficulty (1–5)</label>
                    <input
                      id="wf-diff"
                      type="number"
                      min={1}
                      max={5}
                      value={formState.difficultyBase ?? 3}
                      onChange={e => setFormState(p => ({ ...p, difficultyBase: Number(e.target.value) }))}
                      style={s.input}
                    />
                  </div>
                </div>

                {/* Synonyms */}
                <div style={s.formField}>
                  <label style={s.label} htmlFor="wf-syn">Synonyms <span style={s.helperText}>(comma-separated)</span></label>
                  <input
                    id="wf-syn"
                    value={
                      typeof formState.synonyms === 'string'
                        ? (() => { try { return JSON.parse(formState.synonyms).join(', '); } catch { return formState.synonyms; } })()
                        : ''
                    }
                    onChange={e => setFormState(p => ({ ...p, synonyms: e.target.value }))}
                    style={s.input}
                    placeholder="fleeting, transient, momentary"
                  />
                </div>

                {/* Antonyms */}
                <div style={s.formField}>
                  <label style={s.label} htmlFor="wf-ant">Antonyms <span style={s.helperText}>(comma-separated)</span></label>
                  <input
                    id="wf-ant"
                    value={
                      typeof formState.antonyms === 'string'
                        ? (() => { try { return JSON.parse(formState.antonyms).join(', '); } catch { return formState.antonyms; } })()
                        : ''
                    }
                    onChange={e => setFormState(p => ({ ...p, antonyms: e.target.value }))}
                    style={s.input}
                    placeholder="permanent, lasting"
                  />
                </div>

                {/* Example sentence */}
                <div style={s.formField}>
                  <label style={s.label} htmlFor="wf-ex">Example Sentence</label>
                  <textarea
                    id="wf-ex"
                    value={formState.exampleSentence ?? ''}
                    onChange={e => setFormState(p => ({ ...p, exampleSentence: e.target.value }))}
                    style={{ ...s.input, height: 60, resize: 'vertical' }}
                    placeholder="The joy was ephemeral, fading as quickly as it arrived."
                  />
                </div>

                {/* Unit + Theme pickers */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...s.formField, flex: 1 }}>
                    <label style={s.label} htmlFor="wf-unit">Unit <span style={{ color: '#D62B38' }}>*</span></label>
                    <select
                      id="wf-unit"
                      value={formState.unitId ?? ''}
                      onChange={e => setFormState(p => ({
                        ...p,
                        unitId: Number(e.target.value),
                        themeId: undefined,
                      }))}
                      style={s.select}
                    >
                      <option value="">Select unit…</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div style={{ ...s.formField, flex: 1 }}>
                    <label style={s.label} htmlFor="wf-theme">Theme <span style={{ color: '#D62B38' }}>*</span></label>
                    <select
                      id="wf-theme"
                      value={formState.themeId ?? ''}
                      onChange={e => setFormState(p => ({ ...p, themeId: Number(e.target.value) }))}
                      style={s.select}
                      disabled={!formState.unitId}
                    >
                      <option value="">Select theme…</option>
                      {modalThemes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div style={s.modalFooter}>
                <button onClick={closeModal} style={s.ghostBtn} disabled={saving}>Cancel</button>
                <button
                  onClick={handleSaveWord}
                  disabled={
                    saving ||
                    !formState.word?.trim() ||
                    !formState.definition?.trim() ||
                    !formState.unitId ||
                    !formState.themeId
                  }
                  style={
                    saving || !formState.word?.trim() || !formState.definition?.trim() || !formState.unitId || !formState.themeId
                      ? { ...s.primaryBtn, opacity: 0.55, cursor: 'default' }
                      : s.primaryBtn
                  }
                >
                  {saving
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Check size={13} />
                  }
                  {modal.word ? 'Save Changes' : 'Add Word'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete word confirm ──────────────────────────────────────────── */}
      <AnimatePresence>
        {delConfirm && (
          <motion.div
            key="del-word-overlay"
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={s.modalOverlay}
            onClick={() => setDelConfirm(null)}
          >
            <motion.div
              variants={modalPanel}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={s.confirmPanel}
              onClick={e => e.stopPropagation()}
            >
              <div style={s.confirmIcon}>
                <AlertTriangle size={20} style={{ color: '#B91C1C' }} />
              </div>
              <h3 style={s.confirmTitle}>Delete &ldquo;{delConfirm.word}&rdquo;?</h3>
              <p style={s.confirmDesc}>
                This will permanently remove this word and all associated user progress records.
              </p>
              <div style={s.confirmActions}>
                <button onClick={() => setDelConfirm(null)} style={s.ghostBtn} disabled={saving}>Cancel</button>
                <button
                  onClick={handleDeleteWord}
                  disabled={saving}
                  style={saving ? { ...s.dangerBtn, opacity: 0.65, cursor: 'wait' } : s.dangerBtn}
                >
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters + Add button ─────────────────────────────────────────── */}
      <div style={s.filtersRow}>
        {/* Unit filter */}
        <select
          value={filterUnit}
          onChange={e => handleUnitChange(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ ...s.select, minWidth: 130 }}
          aria-label="Filter by unit"
        >
          <option value="">All Units</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {/* Theme filter */}
        <select
          value={filterTheme}
          onChange={e => handleThemeChange(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ ...s.select, minWidth: 130 }}
          disabled={!filterUnit}
          aria-label="Filter by theme"
        >
          <option value="">All Themes</option>
          {availableThemes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Search */}
        <div style={s.searchWrap}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search words…"
            style={{ ...s.input, paddingLeft: 28, flex: 1 }}
            aria-label="Search words"
          />
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={openAddModal} style={s.primaryBtn}>
            <Plus size={13} /> Add Word
          </button>
        </div>
      </div>

      {/* ── Result count ─────────────────────────────────────────────────── */}
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9CA3AF' }}>
        {loading ? 'Loading…' : `${total} word${total !== 1 ? 's' : ''}`}
      </p>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={s.loadingCard}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: '#D62B38' }} />
          <span style={{ fontSize: 13, color: '#6B7280' }}>Loading words…</span>
        </div>
      ) : words.length === 0 ? (
        <div style={s.emptyState}>
          <BookOpen size={28} style={{ color: '#D1D5DB' }} />
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            No words found. Try adjusting filters or add a word.
          </p>
        </div>
      ) : (
        <div style={s.tableScroll}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, minWidth: 120 }}>Word</th>
                <th style={{ ...s.th, minWidth: 200 }}>Definition</th>
                <th style={{ ...s.th, minWidth: 90 }}>Part of Speech</th>
                <th style={{ ...s.th, minWidth: 60, textAlign: 'center' as const }}>Diff.</th>
                <th style={{ ...s.th, minWidth: 100, textAlign: 'right' as const }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {words.map((word, i) => (
                <tr key={word.id} style={i % 2 === 0 ? s.trEven : {}}>
                  <td style={{ ...s.td, fontWeight: 600, color: '#111827' }}>{word.word}</td>
                  <td style={{ ...s.td, maxWidth: 260 }}>
                    <span style={s.truncate}>{word.definition}</span>
                  </td>
                  <td style={s.td}>
                    {word.partOfSpeech
                      ? <span style={s.badge}>{word.partOfSpeech}</span>
                      : <span style={{ color: '#D1D5DB' }}>—</span>
                    }
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' as const }}>
                    <span style={{
                      ...s.diffBadge,
                      background: word.difficultyBase <= 2 ? '#F0FDF4'
                        : word.difficultyBase === 3 ? '#FFF7ED'
                        : '#FEF2F2',
                      color: word.difficultyBase <= 2 ? '#166534'
                        : word.difficultyBase === 3 ? '#92400E'
                        : '#B91C1C',
                    }}>
                      {word.difficultyBase}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' as const }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEditModal(word)}
                        style={s.actionBtn}
                        aria-label={`Edit ${word.word}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setDelConfirm({ id: word.id, word: word.word })}
                        style={{ ...s.actionBtn, color: '#B91C1C' }}
                        aria-label={`Delete ${word.word}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={s.pagination}>
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            style={page <= 1 ? { ...s.pageBtn, opacity: 0.4, cursor: 'default' } : s.pageBtn}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          <span style={{ fontSize: 13, color: '#374151' }}>
            Page {page} of {pages}
          </span>

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= pages}
            style={page >= pages ? { ...s.pageBtn, opacity: 0.4, cursor: 'default' } : s.pageBtn}
            aria-label="Next page"
          >
            <ChevronRightIcon size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight:   '100vh',
    background:  '#FFFFFF',
    color:       '#111827',
    fontFamily:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth:    1100,
    margin:      '0 auto',
  } as React.CSSProperties,

  loadingPage: {
    minHeight:       '100vh',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      '#FFFFFF',
  } as React.CSSProperties,

  pageHeader: {
    marginBottom: 20,
  } as React.CSSProperties,

  pageHeaderLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,

  pageTitleRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
  } as React.CSSProperties,

  pageTitle: {
    margin:        0,
    fontSize:      22,
    fontWeight:    700,
    color:         '#111827',
    letterSpacing: '-0.025em',
  } as React.CSSProperties,

  pageSubtitle: {
    margin:    0,
    fontSize:  13,
    color:     '#6B7280',
    fontWeight: 400,
  } as React.CSSProperties,

  // Tabs
  tabs: {
    display:       'flex',
    gap:           4,
    marginBottom:  20,
    borderBottom:  '1px solid #F3F4F6',
    paddingBottom: 0,
  } as React.CSSProperties,

  tab: {
    display:        'flex',
    alignItems:     'center',
    gap:            6,
    padding:        '8px 14px',
    background:     'transparent',
    border:         'none',
    borderBottom:   '2px solid transparent',
    cursor:         'pointer',
    fontSize:       13,
    fontWeight:     500,
    color:          '#6B7280',
    transition:     'color 0.15s, border-color 0.15s',
    marginBottom:   -1,
  } as React.CSSProperties,

  tabActive: {
    color:        '#111827',
    borderBottom: '2px solid #D62B38',
    fontWeight:   600,
  } as React.CSSProperties,

  // Section container
  section: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           16,
  } as React.CSSProperties,

  // Toast
  toast: {
    position:    'fixed' as const,
    top:         20,
    left:        '50%',
    zIndex:      9999,
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '10px 14px',
    borderRadius: 8,
    fontSize:    13,
    fontWeight:  500,
    boxShadow:   '0 4px 16px rgba(0,0,0,0.10)',
    maxWidth:    500,
    border:      '1px solid transparent',
  } as React.CSSProperties,
  toastSuccess: { background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' },
  toastError:   { background: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' },
  toastInfo:    { background: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' },
  toastClose: {
    marginLeft:  'auto',
    background:  'transparent',
    border:      'none',
    cursor:      'pointer',
    padding:     2,
    display:     'flex',
    alignItems:  'center',
    color:       'inherit',
    opacity:     0.6,
  } as React.CSSProperties,

  // Dropzone
  dropzone: {
    border:        '2px dashed #E5E7EB',
    borderRadius:  12,
    padding:       '32px 24px',
    background:    '#FAFAFA',
    cursor:        'pointer',
    transition:    'border-color 0.15s, background 0.15s',
    outline:       'none',
  } as React.CSSProperties,
  dropzoneOver: {
    borderColor:   '#D62B38',
    background:    '#FEF2F2',
  },
  dropzoneHasFile: {
    borderColor:   '#D62B38',
    borderStyle:   'solid',
    background:    '#FFF5F5',
  },
  dropzoneInner: {
    display:     'flex',
    alignItems:  'center',
    gap:         16,
  } as React.CSSProperties,
  dropzoneIcon: {
    width:           48,
    height:          48,
    borderRadius:    10,
    background:      '#F3F4F6',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  } as React.CSSProperties,
  dropzoneText: {
    margin:     0,
    fontSize:   14,
    fontWeight: 500,
    color:      '#374151',
  } as React.CSSProperties,
  dropzoneSubtext: {
    margin:    '2px 0 0',
    fontSize:  12,
    color:     '#9CA3AF',
  } as React.CSSProperties,
  dropzoneReset: {
    marginLeft:  'auto',
    background:  'transparent',
    border:      '1px solid #E5E7EB',
    borderRadius: 6,
    padding:     '4px 6px',
    cursor:      'pointer',
    color:       '#6B7280',
    display:     'flex',
    alignItems:  'center',
  } as React.CSSProperties,

  // Hint box
  hintBox: {
    display:     'flex',
    alignItems:  'flex-start',
    gap:         7,
    padding:     '10px 12px',
    background:  '#F9FAFB',
    border:      '1px solid #F3F4F6',
    borderRadius: 8,
  } as React.CSSProperties,
  hintText: {
    fontSize:   12,
    color:      '#6B7280',
    lineHeight: 1.5,
  } as React.CSSProperties,

  // Error box
  errorBox: {
    display:     'flex',
    alignItems:  'flex-start',
    gap:         8,
    padding:     '10px 14px',
    background:  '#FEF2F2',
    border:      '1px solid #FECACA',
    borderRadius: 8,
  } as React.CSSProperties,

  // Preview table
  previewWrap: {
    border:        '1px solid #E5E7EB',
    borderRadius:  10,
    overflow:      'hidden',
  } as React.CSSProperties,
  previewLabel: {
    margin:     0,
    padding:    '8px 12px',
    fontSize:   12,
    color:      '#6B7280',
    background: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    fontWeight: 500,
  } as React.CSSProperties,

  // Table
  tableScroll: {
    overflowX: 'auto' as const,
    borderRadius: 10,
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,
  table: {
    width:           '100%',
    borderCollapse:  'collapse' as const,
    fontSize:        13,
    background:      '#fff',
  } as React.CSSProperties,
  th: {
    padding:     '9px 12px',
    textAlign:   'left' as const,
    fontSize:    11,
    fontWeight:  600,
    color:       '#6B7280',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    background:  '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    whiteSpace:  'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding:     '10px 12px',
    borderBottom: '1px solid #F3F4F6',
    color:       '#374151',
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  trEven: {
    background: '#FAFAFA',
  } as React.CSSProperties,
  truncate: {
    display:      'block',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
    maxWidth:     '100%',
  } as React.CSSProperties,

  // Result box
  resultBox: {
    border:        '1px solid #E5E7EB',
    borderRadius:  10,
    padding:       16,
    background:    '#FAFAFA',
  } as React.CSSProperties,
  resultRow: {
    display:  'flex',
    gap:      12,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  resultStat: {
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    padding:        '12px 20px',
    borderRadius:   8,
    border:         '1px solid transparent',
    minWidth:       80,
  } as React.CSSProperties,
  errorList: {
    marginTop:  12,
    padding:    0,
    listStyle:  'none',
    display:    'flex',
    flexDirection: 'column' as const,
    gap:        4,
  } as React.CSSProperties,
  errorItem: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        6,
    padding:    '5px 8px',
    background: '#FFF5F5',
    borderRadius: 5,
  } as React.CSSProperties,

  // Buttons
  primaryBtn: {
    display:        'flex',
    alignItems:     'center',
    gap:            6,
    padding:        '8px 14px',
    background:     '#D62B38',
    color:          '#FFFFFF',
    border:         'none',
    borderRadius:   7,
    fontSize:       13,
    fontWeight:     600,
    cursor:         'pointer',
    whiteSpace:     'nowrap' as const,
    letterSpacing:  '-0.01em',
  } as React.CSSProperties,
  ghostBtn: {
    display:     'flex',
    alignItems:  'center',
    gap:         5,
    padding:     '8px 14px',
    background:  'transparent',
    color:       '#374151',
    border:      '1px solid #E5E7EB',
    borderRadius: 7,
    fontSize:    13,
    fontWeight:  500,
    cursor:      'pointer',
    whiteSpace:  'nowrap' as const,
  } as React.CSSProperties,
  dangerBtn: {
    display:     'flex',
    alignItems:  'center',
    gap:         5,
    padding:     '8px 14px',
    background:  '#B91C1C',
    color:       '#FFFFFF',
    border:      'none',
    borderRadius: 7,
    fontSize:    13,
    fontWeight:  600,
    cursor:      'pointer',
  } as React.CSSProperties,
  iconBtn: {
    display:     'flex',
    alignItems:  'center',
    justifyContent: 'center',
    padding:     '5px 8px',
    background:  '#F3F4F6',
    color:       '#374151',
    border:      '1px solid #E5E7EB',
    borderRadius: 6,
    cursor:      'pointer',
    fontSize:    12,
    fontWeight:  500,
  } as React.CSSProperties,
  actionBtn: {
    display:     'flex',
    alignItems:  'center',
    padding:     '4px 6px',
    background:  'transparent',
    color:       '#6B7280',
    border:      '1px solid transparent',
    borderRadius: 5,
    cursor:      'pointer',
    transition:  'background 0.1s, color 0.1s',
  } as React.CSSProperties,

  // Accordion / unit structure
  unitCard: {
    border:       '1px solid #E5E7EB',
    borderRadius: 10,
    overflow:     'hidden',
    background:   '#FFFFFF',
  } as React.CSSProperties,
  unitHeader: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '10px 12px',
    background:  '#FAFAFA',
    minHeight:   44,
  } as React.CSSProperties,
  expandBtn: {
    background:  'transparent',
    border:      'none',
    cursor:      'pointer',
    padding:     '2px 4px',
    display:     'flex',
    alignItems:  'center',
    flexShrink:  0,
  } as React.CSSProperties,
  unitName: {
    fontSize:   14,
    fontWeight: 600,
    color:      '#111827',
    flex:       1,
  } as React.CSSProperties,
  unitCount: {
    fontSize:   12,
    color:      '#9CA3AF',
    marginRight: 4,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  rowActions: {
    display:  'flex',
    gap:      4,
    flexShrink: 0,
  } as React.CSSProperties,
  themeList: {
    padding:     '4px 12px 6px 12px',
    display:     'flex',
    flexDirection: 'column' as const,
    gap:         2,
    borderTop:   '1px solid #F3F4F6',
  } as React.CSSProperties,
  themeRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '6px 4px 6px 16px',
    borderRadius: 6,
    minHeight:   36,
  } as React.CSSProperties,
  themeName: {
    fontSize:  13,
    color:     '#374151',
    flex:      1,
  } as React.CSSProperties,
  addThemeBtn: {
    display:     'flex',
    alignItems:  'center',
    gap:         5,
    padding:     '5px 8px 5px 20px',
    background:  'transparent',
    border:      'none',
    color:       '#9CA3AF',
    cursor:      'pointer',
    fontSize:    12,
    fontWeight:  500,
    marginTop:   2,
  } as React.CSSProperties,

  // Inline form
  inlineForm: {
    display:  'flex',
    gap:      6,
    padding:  '8px 4px',
    alignItems: 'center',
  } as React.CSSProperties,
  inlineInput: {
    padding:      '5px 10px',
    border:       '1px solid #D62B38',
    borderRadius: 6,
    fontSize:     13,
    color:        '#111827',
    background:   '#FFFFFF',
    outline:      'none',
    flex:         1,
  } as React.CSSProperties,

  // Filters row
  filtersRow: {
    display:   'flex',
    gap:       10,
    flexWrap:  'wrap' as const,
    alignItems: 'center',
  } as React.CSSProperties,

  searchWrap: {
    position:   'relative' as const,
    display:    'flex',
    alignItems: 'center',
    flex:       1,
    minWidth:   160,
  } as React.CSSProperties,

  // Form fields in modal
  formField: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           4,
  } as React.CSSProperties,
  label: {
    fontSize:   12,
    fontWeight: 600,
    color:      '#374151',
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  helperText: {
    fontSize:   11,
    fontWeight: 400,
    color:      '#9CA3AF',
  } as React.CSSProperties,
  input: {
    padding:      '8px 10px',
    border:       '1px solid #E5E7EB',
    borderRadius: 6,
    fontSize:     13,
    color:        '#111827',
    background:   '#FFFFFF',
    outline:      'none',
    width:        '100%',
  } as React.CSSProperties,
  select: {
    padding:      '8px 10px',
    border:       '1px solid #E5E7EB',
    borderRadius: 6,
    fontSize:     13,
    color:        '#111827',
    background:   '#FFFFFF',
    outline:      'none',
    cursor:       'pointer',
    width:        '100%',
  } as React.CSSProperties,

  // Modal
  modalOverlay: {
    position:        'fixed' as const,
    inset:           0,
    background:      'rgba(0,0,0,0.35)',
    zIndex:          1000,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         16,
  } as React.CSSProperties,
  modalPanel: {
    background:   '#FFFFFF',
    borderRadius: 12,
    width:        '100%',
    maxWidth:     540,
    boxShadow:    '0 8px 40px rgba(0,0,0,0.15)',
    overflow:     'hidden',
    maxHeight:    '90vh',
    display:      'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties,
  modalHeader: {
    display:       'flex',
    alignItems:    'center',
    justifyContent: 'space-between',
    padding:       '16px 20px',
    borderBottom:  '1px solid #E5E7EB',
    flexShrink:    0,
  } as React.CSSProperties,
  modalTitle: {
    margin:      0,
    fontSize:    16,
    fontWeight:  700,
    color:       '#111827',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  modalBody: {
    padding:   '18px 20px',
    display:   'flex',
    flexDirection: 'column' as const,
    gap:       14,
    overflowY: 'auto' as const,
    flex:      1,
  } as React.CSSProperties,
  modalFooter: {
    display:         'flex',
    justifyContent:  'flex-end',
    gap:             8,
    padding:         '14px 20px',
    borderTop:       '1px solid #E5E7EB',
    flexShrink:      0,
  } as React.CSSProperties,

  // Confirm panel
  confirmPanel: {
    background:   '#FFFFFF',
    borderRadius: 12,
    width:        '100%',
    maxWidth:     420,
    padding:      24,
    boxShadow:    '0 8px 40px rgba(0,0,0,0.15)',
    textAlign:    'center' as const,
  } as React.CSSProperties,
  confirmIcon: {
    width:           48,
    height:          48,
    borderRadius:    '50%',
    background:      '#FEF2F2',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    margin:          '0 auto 14px',
  } as React.CSSProperties,
  confirmTitle: {
    margin:      0,
    fontSize:    16,
    fontWeight:  700,
    color:       '#111827',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  confirmDesc: {
    margin:     '8px 0 20px',
    fontSize:   13,
    color:      '#6B7280',
    lineHeight: 1.6,
  } as React.CSSProperties,
  confirmActions: {
    display:         'flex',
    justifyContent:  'center',
    gap:             10,
  } as React.CSSProperties,

  // Misc
  emptyState: {
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    padding:        '40px 20px',
    border:         '1px dashed #E5E7EB',
    borderRadius:   10,
    background:     '#FAFAFA',
  } as React.CSSProperties,
  loadingCard: {
    display:        'flex',
    alignItems:     'center',
    gap:            10,
    padding:        32,
    justifyContent: 'center',
    background:     '#FAFAFA',
    borderRadius:   10,
    border:         '1px solid #E5E7EB',
  } as React.CSSProperties,
  badge: {
    display:      'inline-block',
    padding:      '2px 7px',
    background:   '#F3F4F6',
    color:        '#374151',
    borderRadius: 5,
    fontSize:     11,
    fontWeight:   500,
  } as React.CSSProperties,
  diffBadge: {
    display:      'inline-block',
    padding:      '2px 7px',
    borderRadius: 5,
    fontSize:     12,
    fontWeight:   600,
  } as React.CSSProperties,
  pagination: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
    paddingTop:     8,
  } as React.CSSProperties,
  pageBtn: {
    display:     'flex',
    alignItems:  'center',
    padding:     '6px 10px',
    background:  '#F3F4F6',
    border:      '1px solid #E5E7EB',
    borderRadius: 6,
    cursor:      'pointer',
    color:       '#374151',
  } as React.CSSProperties,
} as const;

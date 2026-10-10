'use client';

/**
 * The marking page's tool bar: tools, contextual options (colour / size /
 * shape / stamp / eraser mode), undo/redo, zoom, page rotation, image
 * adjustments, clear page, stylus-only and focus mode.
 */

import { useState } from 'react';
import {
  ArrowUpRight, Circle, Contrast, Eraser, Focus, Hand, Highlighter, Lasso, Maximize, MessageSquarePlus, Minus, PenTool, Plus,
  Redo2, RotateCw, Slash, Square, Stamp, Trash2, Type, Undo2, Waves,
} from 'lucide-react';
import { HIGHLIGHT_COLORS, INK_COLORS, STAMP_KINDS, STAMP_LABELS, type EssayShapeKind } from '@/lib/essays/annotations';
import { BORDER, INK_SOFT, MUTED, R_MD, R_PILL, RED, SHADOW_LG, SLATE, SURFACE, SURFACE_SHELL, T_XS, Z_MODAL_BACKDROP } from '@/components/admin/lms/tokens';
import type { MarkTool, ToolSettings } from './MarkingCanvas';

export interface ImageAdjust {
  brightness: number;
  contrast: number;
  scan: boolean;
}

export function imageFilterCss(a: ImageAdjust): string {
  const parts = [`brightness(${a.brightness / 100})`, `contrast(${a.contrast / 100})`];
  if (a.scan) parts.push('grayscale(1)', 'contrast(1.6)', 'brightness(1.08)');
  return parts.join(' ');
}

const TOOLS: { tool: MarkTool; icon: React.ComponentType<import('lucide-react').LucideProps>; label: string; key: string }[] = [
  { tool: 'pen', icon: PenTool, label: 'Pen', key: 'P' },
  { tool: 'hl', icon: Highlighter, label: 'Highlighter', key: 'H' },
  { tool: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
  { tool: 'shape', icon: Square, label: 'Shapes', key: 'S' },
  { tool: 'stamp', icon: Stamp, label: 'Stamps', key: 'K' },
  { tool: 'text', icon: Type, label: 'Text on page', key: 'T' },
  { tool: 'comment', icon: MessageSquarePlus, label: 'Comment pin', key: 'C' },
  { tool: 'lasso', icon: Lasso, label: 'Select (lasso)', key: 'L' },
  { tool: 'hand', icon: Hand, label: 'Move around', key: 'V' },
];

const SHAPES: { shape: EssayShapeKind; icon: React.ComponentType<import('lucide-react').LucideProps>; label: string }[] = [
  { shape: 'line', icon: Slash, label: 'Line' },
  { shape: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { shape: 'rect', icon: Square, label: 'Box' },
  { shape: 'ellipse', icon: Circle, label: 'Circle' },
  { shape: 'wavy', icon: Waves, label: 'Wavy underline' },
];

function Btn({ active, onClick, label, children, disabled, danger }: {
  active?: boolean; onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      style={{
        minWidth: 38, height: 38, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        borderRadius: R_MD, border: `1px solid ${active ? RED : 'transparent'}`,
        background: active ? `${RED}14` : 'transparent', color: danger ? RED : active ? RED : INK_SOFT,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, fontSize: T_XS, fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden style={{ width: 1, alignSelf: 'stretch', margin: '4px 4px', background: BORDER, flexShrink: 0 }} />;

export default function MarkingToolbar({
  settings, onSettings, canUndo, canRedo, onUndo, onRedo, zoom, onZoomIn, onZoomOut, onFit, onRotate, canRotate,
  adjust, onAdjust, onClearPage, canClear, focus, onFocus, stylusOnly, onStylusOnly, readOnly, hasSelection, onDeleteSelection,
  onScaleSelection, onRecolorSelection,
}: {
  settings: ToolSettings;
  onSettings: (s: Partial<ToolSettings>) => void;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  zoom: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void;
  onRotate: () => void; canRotate: boolean;
  adjust: ImageAdjust; onAdjust: (a: ImageAdjust) => void;
  onClearPage: () => void; canClear: boolean;
  focus: boolean; onFocus: () => void;
  stylusOnly: boolean; onStylusOnly: () => void;
  readOnly: boolean;
  hasSelection: boolean; onDeleteSelection: () => void; onScaleSelection: (f: number) => void; onRecolorSelection: (c: string) => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const t = settings.tool;
  const inkColors = t === 'hl' ? HIGHLIGHT_COLORS : INK_COLORS;
  const currentColor = t === 'hl' ? settings.hlColor : settings.color;
  const showColor = ['pen', 'hl', 'shape', 'stamp', 'text', 'comment'].includes(t) || (t === 'lasso' && hasSelection);
  const showSize = ['pen', 'hl', 'shape', 'stamp', 'text', 'eraser'].includes(t);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', background: SURFACE_SHELL, borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', flexShrink: 0 }}>
      {TOOLS.map(({ tool, icon: Icon, label, key }) => (
        <Btn key={tool} active={t === tool} onClick={() => onSettings({ tool })} label={`${label} (${key})`} disabled={readOnly && tool !== 'hand'}>
          <Icon size={18} aria-hidden />
        </Btn>
      ))}
      <Sep />

      {showColor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {inkColors.map(c => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              onClick={() => (t === 'lasso' ? onRecolorSelection(c) : onSettings(t === 'hl' ? { hlColor: c } : { color: c }))}
              style={{
                width: 24, height: 24, borderRadius: R_PILL, background: c, cursor: 'pointer', flexShrink: 0,
                border: currentColor === c && t !== 'lasso' ? `3px solid ${SLATE}` : `2px solid ${SURFACE}`,
                boxShadow: `0 0 0 1px ${BORDER}`,
              }}
            />
          ))}
          <Sep />
        </div>
      )}

      {showSize && (
        <>
          {[0, 1, 2].map(i => (
            <Btn key={i} active={settings.sizeIndex === i} onClick={() => onSettings({ sizeIndex: i as 0 | 1 | 2 })} label={['Thin / small', 'Medium', 'Thick / large'][i]}>
              <span style={{ width: 6 + i * 5, height: 6 + i * 5, borderRadius: R_PILL, background: INK_SOFT, display: 'block' }} />
            </Btn>
          ))}
          <Sep />
        </>
      )}

      {t === 'eraser' && (
        <>
          <Btn active={settings.eraserMode === 'stroke'} onClick={() => onSettings({ eraserMode: 'stroke' })} label="Erase whole strokes">Whole</Btn>
          <Btn active={settings.eraserMode === 'partial'} onClick={() => onSettings({ eraserMode: 'partial' })} label="Rub out part of a stroke">Partial</Btn>
          <Sep />
        </>
      )}

      {t === 'shape' && (
        <>
          {SHAPES.map(({ shape, icon: Icon, label }) => (
            <Btn key={shape} active={settings.shape === shape} onClick={() => onSettings({ shape })} label={label}><Icon size={16} aria-hidden /></Btn>
          ))}
          <Sep />
        </>
      )}

      {t === 'stamp' && (
        <>
          {STAMP_KINDS.map(k => (
            <Btn key={k} active={settings.stamp === k} onClick={() => onSettings({ stamp: k })} label={`Stamp ${STAMP_LABELS[k]}`}>
              <span style={{ fontSize: 14 }}>{STAMP_LABELS[k]}</span>
            </Btn>
          ))}
          <Sep />
        </>
      )}

      {t === 'lasso' && hasSelection && (
        <>
          <Btn onClick={() => onScaleSelection(0.85)} label="Make selection smaller"><Minus size={16} aria-hidden /></Btn>
          <Btn onClick={() => onScaleSelection(1.15)} label="Make selection bigger"><Plus size={16} aria-hidden /></Btn>
          <Btn onClick={onDeleteSelection} label="Delete selection" danger><Trash2 size={16} aria-hidden /></Btn>
          <Sep />
        </>
      )}

      <Btn onClick={onUndo} disabled={!canUndo} label="Undo (Ctrl+Z)"><Undo2 size={18} aria-hidden /></Btn>
      <Btn onClick={onRedo} disabled={!canRedo} label="Redo (Ctrl+Shift+Z)"><Redo2 size={18} aria-hidden /></Btn>
      <Sep />
      <Btn onClick={onZoomOut} label="Zoom out (−)"><Minus size={16} aria-hidden /></Btn>
      <button type="button" onClick={onFit} title="Fit page (0)" style={{ minWidth: 48, height: 38, border: 'none', background: 'transparent', fontSize: T_XS, fontWeight: 700, color: MUTED, cursor: 'pointer', flexShrink: 0 }}>
        {Math.round(zoom * 100)}%
      </button>
      <Btn onClick={onZoomIn} label="Zoom in (+)"><Plus size={16} aria-hidden /></Btn>
      <Btn onClick={onFit} label="Fit page"><Maximize size={16} aria-hidden /></Btn>
      <Sep />
      <Btn onClick={onRotate} disabled={!canRotate} label={canRotate ? 'Rotate page' : 'Rotate (only before marking the page)'}><RotateCw size={16} aria-hidden /></Btn>
      <Btn active={adjustOpen || adjust.scan || adjust.brightness !== 100 || adjust.contrast !== 100} onClick={() => setAdjustOpen(o => !o)} label="Brightness / contrast / scan mode">
        <Contrast size={16} aria-hidden />
      </Btn>
      <Btn onClick={onClearPage} disabled={!canClear} label="Clear all marks on this page" danger><Trash2 size={16} aria-hidden /></Btn>
      <Sep />
      <Btn active={stylusOnly} onClick={onStylusOnly} label={stylusOnly ? 'Stylus only: fingers scroll (tap to let fingers draw)' : 'Fingers draw (tap for stylus only)'}>
        <PenTool size={14} aria-hidden /> {stylusOnly ? 'Stylus' : 'Touch'}
      </Btn>
      <Btn active={focus} onClick={onFocus} label="Focus mode (F)"><Focus size={16} aria-hidden /></Btn>

      {adjustOpen && (
        <div style={{
          position: 'fixed', top: 110, right: 16, zIndex: Z_MODAL_BACKDROP - 1, width: 260, padding: 14, background: SURFACE,
          border: `1px solid ${BORDER}`, borderRadius: R_MD, boxShadow: SHADOW_LG, display: 'grid', gap: 10,
        }}>
          <label style={{ fontSize: T_XS, color: MUTED, display: 'grid', gap: 4 }}>
            Brightness {adjust.brightness}%
            <input type="range" min={50} max={160} value={adjust.brightness} onChange={e => onAdjust({ ...adjust, brightness: Number(e.target.value) })} />
          </label>
          <label style={{ fontSize: T_XS, color: MUTED, display: 'grid', gap: 4 }}>
            Contrast {adjust.contrast}%
            <input type="range" min={50} max={220} value={adjust.contrast} onChange={e => onAdjust({ ...adjust, contrast: Number(e.target.value) })} />
          </label>
          <label style={{ fontSize: T_XS, color: SLATE, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={adjust.scan} onChange={e => onAdjust({ ...adjust, scan: e.target.checked })} /> Scan mode (cleans shadows)
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" onClick={() => onAdjust({ brightness: 100, contrast: 100, scan: false })} style={{ border: 'none', background: 'transparent', color: RED, fontSize: T_XS, fontWeight: 700, cursor: 'pointer' }}>Reset</button>
            <button type="button" onClick={() => setAdjustOpen(false)} style={{ border: 'none', background: 'transparent', color: INK_SOFT, fontSize: T_XS, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          </div>
          <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>Only changes your view — the student&apos;s photo isn&apos;t edited.</p>
        </div>
      )}
    </div>
  );
}

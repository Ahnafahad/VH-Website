import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain ESM script module shared with the CLI
import { hapticProblems, imageInfo, inspectGlb, mp3Info, sniffFormat, svgProblems, validateAssetBytes } from '../../../../scripts/last-word/lib/asset-checks.mjs';
import manifest from '../assets/asset-manifest.json';

const enc = new TextEncoder();

function glb(json: object, bin = new Uint8Array(0)): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = enc.encode(text);
  const binPadded = new Uint8Array(Math.ceil(bin.length / 4) * 4);
  binPadded.set(bin);
  const total = 12 + 8 + jsonBytes.length + (bin.length ? 8 + binPadded.length : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(enc.encode('glTF'), 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  out.set(enc.encode('JSON'), 16);
  out.set(jsonBytes, 20);
  if (bin.length) {
    const o = 20 + jsonBytes.length;
    view.setUint32(o, binPadded.length, true);
    out.set(enc.encode('BIN\0'), o + 4);
    out.set(binPadded, o + 8);
  }
  return out;
}

function tile({ size = [1, 1.4, 0.2], triangles = 1000, name = 'tile_body', extensions = [] as string[], offset = [0, 0, 0] } = {}) {
  const [w, h, d] = size;
  return glb({
    asset: { version: '2.0' },
    extensionsUsed: extensions,
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0, translation: offset }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    materials: [{ name: 'tile_body_mat' }],
    accessors: [
      { count: 8, componentType: 5126, type: 'VEC3', min: [-w / 2, -h / 2, -d / 2], max: [w / 2, h / 2, d / 2] },
      { count: triangles * 3, componentType: 5123, type: 'SCALAR' },
    ],
  });
}

function png(width: number, height: number, colorType = 6) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set(enc.encode('IHDR'), 12);
  v.setUint32(16, width);
  v.setUint32(20, height);
  b[24] = 8;
  b[25] = colorType;
  return b;
}

function webpLossless(width: number, height: number, alpha = true) {
  const b = new Uint8Array(30);
  b.set(enc.encode('RIFF'), 0);
  new DataView(b.buffer).setUint32(4, 22, true);
  b.set(enc.encode('WEBPVP8L'), 8);
  new DataView(b.buffer).setUint32(16, 10, true);
  b[20] = 0x2f;
  new DataView(b.buffer).setUint32(21, (width - 1) | ((height - 1) << 14) | ((alpha ? 1 : 0) << 28), true);
  return b;
}

/** MPEG-1 Layer III, 128 kbps, 44.1 kHz frames of 417 bytes (26.12 ms each). */
function mp3(frames: number, mono = true) {
  const frame = new Uint8Array(417);
  frame.set([0xff, 0xfb, 0x90, mono ? 0xc0 : 0x00]);
  const out = new Uint8Array(frames * 417);
  for (let i = 0; i < frames; i++) out.set(frame, i * 417);
  return out;
}

const spec = (id: string) => {
  const s = manifest.assets.find((a) => a.id === id);
  if (!s) throw new Error(id);
  return s;
};

describe('format sniffing', () => {
  it('identifies formats from bytes, not names', () => {
    expect(sniffFormat(tile())).toBe('glb');
    expect(sniffFormat(png(4, 4))).toBe('png');
    expect(sniffFormat(webpLossless(4, 4))).toBe('webp');
    expect(sniffFormat(mp3(2))).toBe('mp3');
    expect(sniffFormat(enc.encode('<svg viewBox="0 0 24 24"></svg>'))).toBe('svg');
    expect(sniffFormat(enc.encode('{"a":1}'))).toBe('json');
  });

  it('rejects a PNG renamed to .webp', () => {
    const result = validateAssetBytes(spec('texture.soft-glow'), png(256, 256), 'textures/soft-glow.webp');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/content is png/);
  });
});

describe('images', () => {
  it('reads PNG and WebP dimensions and alpha', () => {
    expect(imageInfo(png(512, 256, 2))).toEqual({ width: 512, height: 256, alpha: false });
    expect(imageInfo(webpLossless(256, 256))).toEqual({ width: 256, height: 256, alpha: true });
  });

  it('enforces exact size, power-of-two and alpha', () => {
    expect(validateAssetBytes(spec('texture.soft-glow'), webpLossless(256, 256)).ok).toBe(true);
    expect(validateAssetBytes(spec('texture.soft-glow'), webpLossless(300, 300)).errors.join()).toMatch(/expected exactly 256×256/);
    expect(validateAssetBytes(spec('texture.soft-glow'), webpLossless(256, 256, false)).errors.join()).toMatch(/alpha/);
  });
});

describe('GLB models', () => {
  it('counts triangles and reads node names and bounds', () => {
    const info = inspectGlb(tile({ triangles: 1200 }));
    expect(info.triangles).toBe(1200);
    expect(info.nodeNames).toContain('tile_body');
    expect(info.bounds!.max[0] - info.bounds!.min[0]).toBeCloseTo(1);
  });

  it('accepts a tile that fits the Standard budget', () => {
    expect(validateAssetBytes(spec('model.word-tile.standard'), tile({ triangles: 1400 })).ok).toBe(true);
  });

  it('rejects over-budget triangles, wrong size, off-centre pivots and missing nodes', () => {
    const s = spec('model.word-tile.standard');
    expect(validateAssetBytes(s, tile({ triangles: 4000 })).errors.join()).toMatch(/triangles exceeds/);
    expect(validateAssetBytes(s, tile({ size: [2, 1, 0.2] })).errors.join()).toMatch(/expected 1 × 1.4/);
    expect(validateAssetBytes(s, tile({ offset: [0.5, 0, 0] })).errors.join()).toMatch(/Not centred/);
    expect(validateAssetBytes(s, tile({ name: 'Cube' })).errors.join()).toMatch(/Missing required node "tile_body"/);
  });

  it('rejects compression the site cannot decode', () => {
    const result = validateAssetBytes(spec('model.word-tile.full'), tile({ extensions: ['KHR_draco_mesh_compression'] }));
    expect(result.errors.join()).toMatch(/KHR_draco_mesh_compression/);
  });

  it('checks the chamber shell stays behind the word field', () => {
    const shell = glb({
      asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ name: 'shell', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ count: 300, componentType: 5126, type: 'VEC3', min: [-6, -3, -3], max: [6, 3, 0.5] }],
    });
    expect(validateAssetBytes(spec('model.chamber-shell.standard'), shell).errors.join()).toMatch(/outside the allowed volume/);
  });
});

describe('audio', () => {
  it('measures MP3 duration by summing frames', () => {
    const info = mp3Info(mp3(10));
    expect(info?.durationMs).toBe(261);
    expect(info?.channels).toBe(1);
    expect(info?.sampleRate).toBe(44100);
  });

  it('enforces duration windows', () => {
    expect(validateAssetBytes(spec('sfx.select'), mp3(4)).ok).toBe(true); // 104 ms
    expect(validateAssetBytes(spec('sfx.select'), mp3(20)).errors.join()).toMatch(/outside 50–140 ms/);
  });

  it('warns when an effect is stereo', () => {
    expect(validateAssetBytes(spec('sfx.select'), mp3(4, false)).warnings.join()).toMatch(/mono/);
  });
});

describe('SVG icons', () => {
  it('requires currentColor and forbids scripts, external refs, text and hard-coded colours', () => {
    expect(svgProblems('<svg viewBox="0 0 24 24"><path stroke="currentColor" d="M0 0"/></svg>', { currentColor: true })).toEqual([]);
    const bad = svgProblems('<svg><script>x</script><text>A</text><path fill="#E63946"/></svg>', { currentColor: true });
    expect(bad.join(' ')).toMatch(/viewBox/);
    expect(bad.join(' ')).toMatch(/script/);
    expect(bad.join(' ')).toMatch(/<text>/);
    expect(bad.join(' ')).toMatch(/Hard-coded colours/);
  });
});

describe('haptic patterns', () => {
  const events = spec('haptics.patterns').haptics!.events;
  it('accepts valid overrides', () => {
    expect(hapticProblems({ lock: { web: 18, native: 'medium' }, switch: { web: [6, 12, 6] } }, events)).toEqual([]);
  });
  it('rejects unknown events and unsafe durations', () => {
    expect(hapticProblems({ explode: { web: 10 } }, events).join()).toMatch(/Unknown event/);
    expect(hapticProblems({ lock: { web: 5000 } }, events).join()).toMatch(/0–400 ms/);
  });
});

describe('manifest integrity', () => {
  it('has unique ids and paths, and every entry declares a fallback', () => {
    const ids = manifest.assets.map((a) => a.id);
    const paths = manifest.assets.flatMap((a) => [a.path, ...(('altPaths' in a ? a.altPaths : []) as string[])]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
    for (const a of manifest.assets) expect(a.fallback.length).toBeGreaterThan(3);
  });
});

describe('ASSETS_NEEDED.md stays in sync with the manifest', () => {
  it('lists every manifest file in the checklist', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync('docs/last-word/ASSETS_NEEDED.md', 'utf8');
    const checklist = doc.slice(doc.indexOf('## 11. Checklist'));
    for (const a of manifest.assets) expect(checklist, a.path).toContain(`\`${a.path}\``);
    const must = manifest.assets.filter((a) => a.priority === 'must').length;
    expect(checklist).toContain(`### Must-have (${must})`);
  });
});

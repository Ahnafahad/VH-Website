/**
 * Last Word asset checks — pure functions over file bytes, no dependencies.
 * Used by scripts/last-word/validate-assets.mjs and unit-tested in
 * src/features/last-word/__tests__/asset-checks.test.ts.
 *
 * Every check reads real bytes (magic numbers, headers, glTF JSON) rather
 * than trusting a file extension, so a renamed PNG can't pass as a WebP.
 */

// ─── Format sniffing ─────────────────────────────────────────────────────────

const ascii = (buf, start, len) => String.fromCharCode(...buf.subarray(start, start + len));

export function sniffFormat(buf) {
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'glTF') return 'glb';
  if (buf.length >= 8 && buf[0] === 0x89 && ascii(buf, 1, 3) === 'PNG') return 'png';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') return 'webp';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 10 && (ascii(buf, 0, 10) === '#?RADIANCE' || ascii(buf, 0, 6) === '#?RGBE')) return 'hdr';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf.length >= 4 && ascii(buf, 0, 4) === 'OggS') return 'ogg';
  if (buf.length >= 4 && ascii(buf, 0, 4) === 'wOF2') return 'woff2';
  if (buf.length >= 3 && ascii(buf, 0, 3) === 'ID3') return 'mp3';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  const head = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 512))).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  return 'unknown';
}

// ─── Images ──────────────────────────────────────────────────────────────────

export function imageInfo(buf, format = sniffFormat(buf)) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (format === 'png') {
    // IHDR: width/height big-endian at 16/20; colour type at 25 (4 or 6 = alpha), or a tRNS chunk.
    const colorType = buf[25];
    return { width: view.getUint32(16), height: view.getUint32(20), alpha: colorType === 4 || colorType === 6 || indexOfAscii(buf, 'tRNS') > 0 };
  }
  if (format === 'webp') {
    const chunk = ascii(buf, 12, 4);
    if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff, alpha: false };
    if (chunk === 'VP8L') {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, alpha: Boolean((b >> 28) & 1) };
    }
    if (chunk === 'VP8X') {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width: w, height: h, alpha: Boolean(buf[20] & 0x10) };
    }
    return null;
  }
  if (format === 'jpeg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: view.getUint16(i + 7), height: view.getUint16(i + 5), alpha: false };
      }
      i += 2 + len;
    }
    return null;
  }
  if (format === 'hdr') {
    const text = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 4096)));
    const m = text.match(/\n-Y (\d+) \+X (\d+)\n/);
    return m ? { width: Number(m[2]), height: Number(m[1]), alpha: false } : null;
  }
  return null;
}

function indexOfAscii(buf, needle) {
  outer: for (let i = 0; i <= buf.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (buf[i + j] !== needle.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

const isPow2 = (n) => n > 0 && (n & (n - 1)) === 0;

// ─── glTF binary ─────────────────────────────────────────────────────────────

function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function inspectGlb(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (ascii(buf, 0, 4) !== 'glTF') throw new Error('Not a GLB file');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`glTF version ${version}; only 2 is supported`);
  const jsonLength = view.getUint32(12, true);
  if (ascii(buf, 16, 4) !== 'JSON') throw new Error('First GLB chunk is not JSON');
  const gltf = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jsonLength)));
  let binStart = -1;
  const binHeader = 20 + jsonLength;
  if (binHeader + 8 <= buf.length && ascii(buf, binHeader + 4, 4) === 'BIN\0') binStart = binHeader + 8;

  const accessors = gltf.accessors ?? [];
  const meshes = gltf.meshes ?? [];
  const nodes = gltf.nodes ?? [];
  let triangles = 0;
  for (const mesh of meshes) {
    for (const prim of mesh.primitives ?? []) {
      const mode = prim.mode ?? 4;
      const count = prim.indices !== undefined ? accessors[prim.indices]?.count ?? 0 : accessors[prim.attributes?.POSITION]?.count ?? 0;
      if (mode === 4) triangles += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }

  // World-space bounds from POSITION accessor min/max through each node's world matrix.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visit = (index, parent) => {
    const node = nodes[index];
    if (!node) return;
    const world = mat4Multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const prim of meshes[node.mesh]?.primitives ?? []) {
        const acc = accessors[prim.attributes?.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (let i = 0; i < 8; i++) {
          const p = [i & 1 ? acc.max[0] : acc.min[0], i & 2 ? acc.max[1] : acc.min[1], i & 4 ? acc.max[2] : acc.min[2]];
          for (let axis = 0; axis < 3; axis++) {
            const v = world[axis] * p[0] + world[4 + axis] * p[1] + world[8 + axis] * p[2] + world[12 + axis];
            min[axis] = Math.min(min[axis], v);
            max[axis] = Math.max(max[axis], v);
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  const roots = scene?.nodes ?? nodes.map((_, i) => i).filter((i) => !nodes.some((n) => n.children?.includes(i)));
  for (const root of roots) visit(root, IDENTITY);

  const images = (gltf.images ?? []).map((image) => {
    if (image.uri) return { external: !image.uri.startsWith('data:'), uri: image.uri.startsWith('data:') ? 'data:' : image.uri, mimeType: image.mimeType ?? null, width: null, height: null };
    const bv = gltf.bufferViews?.[image.bufferView];
    if (!bv || binStart < 0) return { external: false, mimeType: image.mimeType ?? null, width: null, height: null };
    const bytes = buf.subarray(binStart + (bv.byteOffset ?? 0), binStart + (bv.byteOffset ?? 0) + bv.byteLength);
    const info = imageInfo(bytes);
    return { external: false, mimeType: image.mimeType ?? null, width: info?.width ?? null, height: info?.height ?? null };
  });
  const externalBuffers = (gltf.buffers ?? []).filter((b) => b.uri && !b.uri.startsWith('data:')).map((b) => b.uri);

  return {
    triangles,
    meshCount: meshes.length,
    materialCount: (gltf.materials ?? []).length,
    nodeNames: nodes.map((n) => n.name).filter(Boolean),
    meshNames: meshes.map((m) => m.name).filter(Boolean),
    extensionsUsed: gltf.extensionsUsed ?? [],
    extensionsRequired: gltf.extensionsRequired ?? [],
    images,
    externalBuffers,
    bounds: Number.isFinite(min[0]) ? { min, max } : null,
  };
}

// ─── Audio ───────────────────────────────────────────────────────────────────

const MP3_BITRATES = {
  // [version][layer] tables (kbps); version 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5; layer 1 = III
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};
const MP3_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Sums MPEG audio frames (Layer III) for an exact duration; works for CBR and VBR. */
export function mp3Info(buf) {
  let i = 0;
  if (ascii(buf, 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + size + (buf[5] & 0x10 ? 10 : 0);
  }
  let frames = 0;
  let seconds = 0;
  let sampleRate = null;
  let channels = null;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const version = (buf[i + 1] >> 3) & 0x03; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layer = (buf[i + 1] >> 1) & 0x03; // 1 = Layer III
    const brIndex = (buf[i + 2] >> 4) & 0x0f;
    const srIndex = (buf[i + 2] >> 2) & 0x03;
    const padding = (buf[i + 2] >> 1) & 0x01;
    if (version === 1 || layer !== 1 || brIndex === 0 || brIndex === 15 || srIndex === 3) { i++; continue; }
    const bitrate = (version === 3 ? MP3_BITRATES[1] : MP3_BITRATES[2])[brIndex] * 1000;
    const rate = MP3_RATES[version][srIndex];
    const samples = version === 3 ? 1152 : 576;
    const length = Math.floor(((version === 3 ? 144 : 72) * bitrate) / rate) + padding;
    if (length < 4) { i++; continue; }
    sampleRate ??= rate;
    channels ??= ((buf[i + 3] >> 6) & 0x03) === 3 ? 1 : 2;
    frames++;
    seconds += samples / rate;
    i += length;
  }
  if (!frames) return null;
  return { durationMs: Math.round(seconds * 1000), sampleRate, channels, frames };
}

/** Ogg Opus/Vorbis duration from the last page's granule position. */
export function oggInfo(buf) {
  let last = -1;
  for (let i = buf.length - 14; i >= 0; i--) {
    if (buf[i] === 0x4f && buf[i + 1] === 0x67 && buf[i + 2] === 0x67 && buf[i + 3] === 0x53) { last = i; break; }
  }
  if (last < 0) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const granule = Number(view.getBigUint64(last + 6, true));
  const opus = indexOfAscii(buf.subarray(0, 200), 'OpusHead');
  if (opus >= 0) {
    const preSkip = view.getUint16(opus + 10, true);
    return { durationMs: Math.round(((granule - preSkip) / 48000) * 1000), sampleRate: 48000, channels: buf[opus + 9] };
  }
  const vorbis = indexOfAscii(buf.subarray(0, 200), 'vorbis');
  if (vorbis >= 0) {
    const rate = view.getUint32(vorbis + 11, true);
    return { durationMs: Math.round((granule / rate) * 1000), sampleRate: rate, channels: buf[vorbis + 10] };
  }
  return null;
}

// ─── SVG / JSON ──────────────────────────────────────────────────────────────

export function svgProblems(text, { currentColor }) {
  const problems = [];
  if (!/<svg[\s>]/.test(text)) problems.push('Not an SVG document.');
  if (!/viewBox\s*=\s*"[^"]+"/.test(text)) problems.push('Missing viewBox.');
  if (/<script[\s>]/i.test(text) || /\son[a-z]+\s*=/i.test(text)) problems.push('Contains script or event handlers.');
  if (/(xlink:)?href\s*=\s*"(https?:)?\/\//i.test(text)) problems.push('References an external resource.');
  if (/<image[\s>]/i.test(text)) problems.push('Embeds a raster <image>; icons must be vector.');
  if (/<text[\s>]/i.test(text)) problems.push('Contains <text>; convert lettering to outlines.');
  if (currentColor) {
    const colours = [...text.matchAll(/(fill|stroke)\s*[=:]\s*"?\s*(#[0-9a-f]{3,8}|rgb\([^)]*\))/gi)].map((m) => m[2]);
    if (colours.length) problems.push(`Hard-coded colours (${[...new Set(colours)].join(', ')}); use currentColor so the game can recolour it.`);
    if (!/currentColor/.test(text)) problems.push('Does not use currentColor.');
  }
  return problems;
}

export function hapticProblems(json, events) {
  const problems = [];
  if (!json || typeof json !== 'object' || Array.isArray(json)) return ['Must be a JSON object keyed by event name.'];
  for (const [event, value] of Object.entries(json)) {
    if (event.startsWith('$')) continue;
    if (!events.includes(event)) { problems.push(`Unknown event "${event}". Allowed: ${events.join(', ')}.`); continue; }
    const pattern = value?.web;
    const valid = (typeof pattern === 'number' && pattern >= 0 && pattern <= 400)
      || (Array.isArray(pattern) && pattern.length > 0 && pattern.length <= 9 && pattern.every((n) => Number.isInteger(n) && n >= 0 && n <= 400));
    if (!valid) problems.push(`"${event}.web" must be a vibration duration or an array of ≤ 9 durations (0–400 ms).`);
    const native = value?.native;
    if (native !== undefined && !['light', 'medium', 'heavy', 'success', 'warning', 'error', 'none'].includes(native)) {
      problems.push(`"${event}.native" must be one of light, medium, heavy, success, warning, error, none.`);
    }
  }
  return problems;
}

// ─── Per-asset validation ────────────────────────────────────────────────────

const near = (a, b, tol) => Math.abs(a - b) <= Math.max(tol * Math.abs(b), 1e-3);

/** Validates one file against its manifest spec. Returns { ok, errors, warnings, info }. */
export function validateAssetBytes(spec, buf, filePath = spec.path) {
  const errors = [];
  const warnings = [];
  const info = { bytes: buf.length };
  const ext = filePath.split('.').pop().toLowerCase();
  const sniffed = sniffFormat(buf);
  const expected = { glb: 'glb', png: 'png', webp: 'webp', jpg: 'jpeg', jpeg: 'jpeg', hdr: 'hdr', mp3: 'mp3', webm: 'webm', ogg: 'ogg', svg: 'svg', json: 'json', woff2: 'woff2' }[ext];
  if (!expected) errors.push(`Unsupported file extension ".${ext}".`);
  else if (sniffed !== expected) errors.push(`File content is ${sniffed}, but the name says .${ext}.`);
  if (spec.budget?.maxBytes && buf.length > spec.budget.maxBytes) errors.push(`${buf.length} bytes exceeds the ${spec.budget.maxBytes}-byte budget.`);
  if (errors.length) return { ok: false, errors, warnings, info };

  try {
    if (sniffed === 'glb') {
      const glb = inspectGlb(buf);
      Object.assign(info, { triangles: glb.triangles, meshes: glb.meshCount, materials: glb.materialCount, bounds: glb.bounds });
      const b = spec.budget ?? {};
      if (b.maxTriangles && glb.triangles > b.maxTriangles) errors.push(`${glb.triangles} triangles exceeds the ${b.maxTriangles} budget.`);
      if (b.maxMaterials && glb.materialCount > b.maxMaterials) errors.push(`${glb.materialCount} materials exceeds ${b.maxMaterials}.`);
      if (b.maxMeshes && glb.meshCount > b.maxMeshes) errors.push(`${glb.meshCount} meshes exceeds ${b.maxMeshes}.`);
      const forbidden = spec.model?.forbiddenExtensions ?? [];
      for (const extName of [...glb.extensionsUsed, ...glb.extensionsRequired]) {
        if (forbidden.includes(extName)) errors.push(`Uses ${extName}, which this tier/CSP cannot load. Export uncompressed glTF with WebP/PNG textures.`);
      }
      if (glb.externalBuffers.length || glb.images.some((img) => img.external)) errors.push('References external files; embed every buffer and texture in the .glb.');
      for (const img of glb.images) {
        if (img.width && b.maxTextureSize && Math.max(img.width, img.height) > b.maxTextureSize) errors.push(`Embedded texture ${img.width}×${img.height} exceeds ${b.maxTextureSize}px.`);
        if (img.width && (!isPow2(img.width) || !isPow2(img.height))) warnings.push(`Embedded texture ${img.width}×${img.height} is not power-of-two.`);
      }
      const names = new Set([...glb.nodeNames, ...glb.meshNames]);
      for (const required of spec.model?.requiredNodes ?? []) if (!names.has(required)) errors.push(`Missing required node "${required}" (found: ${[...names].join(', ') || 'none'}).`);
      if (glb.bounds && spec.model?.size) {
        const dims = [0, 1, 2].map((a) => glb.bounds.max[a] - glb.bounds.min[a]);
        const tol = spec.model.sizeTolerance ?? 0.1;
        // Depth is a maximum, width/height must match within tolerance.
        if (!near(dims[0], spec.model.size[0], tol) || !near(dims[1], spec.model.size[1], tol)) {
          errors.push(`Size ${dims.map((d) => d.toFixed(3)).join(' × ')} m; expected ${spec.model.size[0]} × ${spec.model.size[1]} (±${tol * 100}%) in X × Y.`);
        }
        if (dims[2] > spec.model.size[2] * (1 + tol)) errors.push(`Depth ${dims[2].toFixed(3)} m exceeds ${spec.model.size[2]} m.`);
        if (spec.model.centered) {
          const centre = [0, 1, 2].map((a) => (glb.bounds.max[a] + glb.bounds.min[a]) / 2);
          if (centre.some((c, a) => Math.abs(c) > Math.max(0.05, 0.05 * spec.model.size[a]))) errors.push(`Not centred on the origin (centre ${centre.map((c) => c.toFixed(3)).join(', ')}).`);
        }
      }
      if (glb.bounds && spec.model?.bounds) {
        const { min, max } = spec.model.bounds;
        const outside = [0, 1, 2].some((a) => glb.bounds.min[a] < min[a] - 0.05 || glb.bounds.max[a] > max[a] + 0.05);
        if (outside) errors.push(`Geometry extends outside the allowed volume ${JSON.stringify(spec.model.bounds)} (got ${JSON.stringify({ min: glb.bounds.min.map((v) => +v.toFixed(2)), max: glb.bounds.max.map((v) => +v.toFixed(2)) })}).`);
      }
      if (!glb.bounds) warnings.push('Could not compute bounds (POSITION accessors lack min/max).');
    } else if (['png', 'webp', 'jpeg', 'hdr'].includes(sniffed)) {
      const img = imageInfo(buf, sniffed);
      if (!img) errors.push('Could not read image dimensions.');
      else {
        Object.assign(info, img);
        if (spec.image) {
          if (img.width !== spec.image.width || img.height !== spec.image.height) errors.push(`Image is ${img.width}×${img.height}; expected exactly ${spec.image.width}×${spec.image.height}.`);
          if (spec.image.pot && (!isPow2(img.width) || !isPow2(img.height))) errors.push('Texture must be power-of-two.');
          if (spec.image.alpha && !img.alpha) errors.push('Needs an alpha channel (transparent background).');
        }
      }
    } else if (sniffed === 'mp3' || sniffed === 'ogg') {
      const audio = sniffed === 'mp3' ? mp3Info(buf) : oggInfo(buf);
      if (!audio) errors.push('Could not read audio frames.');
      else {
        Object.assign(info, audio);
        if (spec.audio) {
          if (audio.durationMs < spec.audio.minMs || audio.durationMs > spec.audio.maxMs) errors.push(`Duration ${audio.durationMs} ms is outside ${spec.audio.minMs}–${spec.audio.maxMs} ms.`);
          if (spec.category === 'sfx' && audio.channels && audio.channels > 1) warnings.push('SFX should be mono.');
          if (audio.sampleRate && audio.sampleRate < 44100) warnings.push(`Sample rate ${audio.sampleRate} Hz; use 44.1 or 48 kHz.`);
        }
      }
    } else if (sniffed === 'webm') {
      info.note = 'WebM duration is not parsed; the MP3 twin is the checked reference.';
    } else if (sniffed === 'svg') {
      errors.push(...svgProblems(new TextDecoder().decode(buf), { currentColor: Boolean(spec.svg?.currentColor) }));
    } else if (sniffed === 'json') {
      const json = JSON.parse(new TextDecoder().decode(buf));
      if (spec.haptics) errors.push(...hapticProblems(json, spec.haptics.events));
    }
  } catch (error) {
    errors.push(`Could not parse file: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { ok: errors.length === 0, errors, warnings, info };
}

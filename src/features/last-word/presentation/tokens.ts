export const timing = {
  micro: 110, selection: 200, card: 320, context: 480,
  flip: 600, mastery: 900, scene: 600,
} as const;

export const springs = {
  selection: { mass: 1, tension: 290, friction: 26 },
  lock: { mass: 0.8, tension: 460, friction: 30 },
  settle: { mass: 1.4, tension: 180, friction: 28 },
};

export type PresentationTier = 'full' | 'standard' | 'lite';

export function detectTier(): PresentationTier {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return 'lite';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return navigator.hardwareConcurrency >= 8 && window.devicePixelRatio <= 2.5 ? 'full' : 'standard';
}

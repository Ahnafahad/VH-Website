import type { CSSProperties } from 'react';

const ASSET_ROOT = '/lexicore-assets';

type LexiIconProps = {
  path: string;
  size?: number | string;
  color?: string;
  className?: string;
  label?: string;
  style?: CSSProperties;
};

/**
 * Renders a monochrome SVG as a mask so SVG `currentColor` assets inherit the
 * live UI state even though they are served from /public.
 */
export function LexiIcon({
  path,
  size = 24,
  color = 'currentColor',
  className,
  label,
  style,
}: LexiIconProps) {
  const url = `${ASSET_ROOT}/${path}`;

  return (
    <span
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        flex: '0 0 auto',
        backgroundColor: color,
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        ...style,
      }}
    />
  );
}

type LexiArtworkProps = {
  path: string;
  alt?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  loading?: 'eager' | 'lazy';
  style?: CSSProperties;
};

/** Responsive transparent artwork. Dynamic text and controls stay outside. */
export function LexiArtwork({
  path,
  alt = '',
  className,
  width = '100%',
  height = 'auto',
  loading = 'lazy',
  style,
}: LexiArtworkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ASSET_ROOT}/${path}`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={className}
      loading={loading}
      decoding="async"
      draggable={false}
      style={{
        display: 'block',
        width,
        height,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

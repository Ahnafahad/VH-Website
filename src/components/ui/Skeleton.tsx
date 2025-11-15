import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'text',
      width,
      height,
      animation = 'pulse',
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'bg-gray-200';

    const variantStyles = {
      text: 'rounded h-4',
      circular: 'rounded-full',
      rectangular: 'rounded-none',
      rounded: 'rounded-xl',
    };

    const animationStyles = {
      pulse: 'animate-pulse',
      wave: 'animate-shimmer',
      none: '',
    };

    const inlineStyles = {
      width: width || (variant === 'circular' ? '40px' : '100%'),
      height: height || (variant === 'circular' ? '40px' : undefined),
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`.trim()}
        style={inlineStyles}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;

// Skeleton composition helpers
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 ? '80%' : '100%'}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-6 bg-white rounded-2xl border border-gray-200 ${className}`}>
    <div className="flex items-center gap-4 mb-4">
      <Skeleton variant="circular" width="48px" height="48px" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
);

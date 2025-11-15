import React from 'react';
import { X } from 'lucide-react';

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'filled' | 'outlined';
  colorScheme?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  onRemove?: () => void;
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  (
    {
      variant = 'filled',
      colorScheme = 'gray',
      size = 'md',
      onRemove,
      leftIcon,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200';

    const sizeStyles = {
      sm: 'px-2.5 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    const iconSizes = {
      sm: 12,
      md: 14,
      lg: 16,
    };

    const colorSchemes = {
      primary: {
        filled: 'bg-vh-red-100 text-vh-red-800 hover:bg-vh-red-200',
        outlined: 'border-2 border-vh-red-200 text-vh-red-700 bg-white hover:bg-vh-red-50',
      },
      secondary: {
        filled: 'bg-vh-beige-100 text-vh-beige-800 hover:bg-vh-beige-200',
        outlined: 'border-2 border-vh-beige-200 text-vh-beige-700 bg-white hover:bg-vh-beige-50',
      },
      success: {
        filled: 'bg-success-100 text-success-800 hover:bg-success-200',
        outlined: 'border-2 border-success-200 text-success-700 bg-white hover:bg-success-50',
      },
      error: {
        filled: 'bg-error-100 text-error-800 hover:bg-error-200',
        outlined: 'border-2 border-error-200 text-error-700 bg-white hover:bg-error-50',
      },
      warning: {
        filled: 'bg-warning-100 text-warning-800 hover:bg-warning-200',
        outlined: 'border-2 border-warning-200 text-warning-700 bg-white hover:bg-warning-50',
      },
      info: {
        filled: 'bg-info-100 text-info-800 hover:bg-info-200',
        outlined: 'border-2 border-info-200 text-info-700 bg-white hover:bg-info-50',
      },
      gray: {
        filled: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        outlined: 'border-2 border-gray-200 text-gray-700 bg-white hover:bg-gray-50',
      },
    };

    const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${colorSchemes[colorScheme][variant]} ${className}`.trim();

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {leftIcon && <span className="flex items-center">{leftIcon}</span>}
        <span>{children}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center rounded-full hover:bg-black/10 transition-colors p-0.5 -mr-1"
            aria-label="Remove"
          >
            <X size={iconSizes[size]} strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  }
);

Chip.displayName = 'Chip';

export default Chip;

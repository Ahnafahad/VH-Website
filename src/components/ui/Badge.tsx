import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'solid' | 'outline' | 'subtle';
  colorScheme?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'solid',
      colorScheme = 'primary',
      size = 'md',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full';

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-1.5 text-base',
    };

    const colorSchemes = {
      primary: {
        solid: 'bg-vh-red text-white',
        outline: 'border-2 border-vh-red text-vh-red bg-white',
        subtle: 'bg-vh-red-100 text-vh-red-700',
      },
      secondary: {
        solid: 'bg-vh-beige text-white',
        outline: 'border-2 border-vh-beige text-vh-beige-700 bg-white',
        subtle: 'bg-vh-beige-100 text-vh-beige-700',
      },
      success: {
        solid: 'bg-success-600 text-white',
        outline: 'border-2 border-success-600 text-success-600 bg-white',
        subtle: 'bg-success-100 text-success-700',
      },
      error: {
        solid: 'bg-error-600 text-white',
        outline: 'border-2 border-error-600 text-error-600 bg-white',
        subtle: 'bg-error-100 text-error-700',
      },
      warning: {
        solid: 'bg-warning-500 text-white',
        outline: 'border-2 border-warning-500 text-warning-700 bg-white',
        subtle: 'bg-warning-100 text-warning-700',
      },
      info: {
        solid: 'bg-info-600 text-white',
        outline: 'border-2 border-info-600 text-info-600 bg-white',
        subtle: 'bg-info-100 text-info-700',
      },
      gray: {
        solid: 'bg-gray-800 text-white',
        outline: 'border-2 border-gray-400 text-gray-700 bg-white',
        subtle: 'bg-gray-100 text-gray-700',
      },
    };

    const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${colorSchemes[colorScheme][variant]} ${className}`.trim();

    return (
      <span ref={ref} className={combinedClassName} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;

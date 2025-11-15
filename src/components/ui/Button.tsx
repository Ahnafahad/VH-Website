import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'gray';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'solid',
      size = 'md',
      colorScheme = 'primary',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

    // Size variants
    const sizeStyles = {
      sm: 'px-4 py-2 text-sm gap-2 min-h-[36px]',
      md: 'px-6 py-3 text-base gap-2 min-h-[44px]',
      lg: 'px-8 py-4 text-lg gap-3 min-h-[52px]',
    };

    // Color scheme variants
    const colorSchemes = {
      primary: {
        solid: 'bg-vh-red text-white hover:bg-vh-light-red active:bg-vh-dark-red focus:ring-vh-red/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-vh-red text-vh-red hover:bg-vh-red/10 active:bg-vh-red/20 focus:ring-vh-red/30',
        ghost: 'text-vh-red hover:bg-vh-red/10 active:bg-vh-red/20 focus:ring-vh-red/30',
        link: 'text-vh-red hover:text-vh-light-red underline-offset-4 hover:underline focus:ring-vh-red/30',
      },
      secondary: {
        solid: 'bg-vh-beige text-white hover:bg-vh-beige-500 active:bg-vh-beige-600 focus:ring-vh-beige/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-vh-beige text-vh-beige-600 hover:bg-vh-beige/10 active:bg-vh-beige/20 focus:ring-vh-beige/30',
        ghost: 'text-vh-beige-600 hover:bg-vh-beige/10 active:bg-vh-beige/20 focus:ring-vh-beige/30',
        link: 'text-vh-beige-600 hover:text-vh-beige-700 underline-offset-4 hover:underline focus:ring-vh-beige/30',
      },
      success: {
        solid: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 focus:ring-success-600/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-success-600 text-success-600 hover:bg-success-50 active:bg-success-100 focus:ring-success-600/30',
        ghost: 'text-success-600 hover:bg-success-50 active:bg-success-100 focus:ring-success-600/30',
        link: 'text-success-600 hover:text-success-700 underline-offset-4 hover:underline focus:ring-success-600/30',
      },
      error: {
        solid: 'bg-error-600 text-white hover:bg-error-700 active:bg-error-800 focus:ring-error-600/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-error-600 text-error-600 hover:bg-error-50 active:bg-error-100 focus:ring-error-600/30',
        ghost: 'text-error-600 hover:bg-error-50 active:bg-error-100 focus:ring-error-600/30',
        link: 'text-error-600 hover:text-error-700 underline-offset-4 hover:underline focus:ring-error-600/30',
      },
      warning: {
        solid: 'bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700 focus:ring-warning-500/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-warning-500 text-warning-700 hover:bg-warning-50 active:bg-warning-100 focus:ring-warning-500/30',
        ghost: 'text-warning-700 hover:bg-warning-50 active:bg-warning-100 focus:ring-warning-500/30',
        link: 'text-warning-700 hover:text-warning-800 underline-offset-4 hover:underline focus:ring-warning-500/30',
      },
      info: {
        solid: 'bg-info-600 text-white hover:bg-info-700 active:bg-info-800 focus:ring-info-600/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-info-600 text-info-600 hover:bg-info-50 active:bg-info-100 focus:ring-info-600/30',
        ghost: 'text-info-600 hover:bg-info-50 active:bg-info-100 focus:ring-info-600/30',
        link: 'text-info-600 hover:text-info-700 underline-offset-4 hover:underline focus:ring-info-600/30',
      },
      gray: {
        solid: 'bg-gray-800 text-white hover:bg-gray-900 active:bg-gray-950 focus:ring-gray-800/30 shadow-sm hover:shadow-md',
        outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus:ring-gray-300/30',
        ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-300/30',
        link: 'text-gray-700 hover:text-gray-900 underline-offset-4 hover:underline focus:ring-gray-300/30',
      },
    };

    const fullWidthStyle = fullWidth ? 'w-full' : '';

    const combinedClassName = `${baseStyles} ${sizeStyles[size]} ${colorSchemes[colorScheme][variant]} ${fullWidthStyle} ${className}`.trim();

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <Loader2 className="animate-spin" size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} />
        )}
        {!isLoading && leftIcon && <span className="flex items-center">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

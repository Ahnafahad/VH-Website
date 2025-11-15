import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    const baseInputStyles = 'block w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-4 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60';

    const borderStyles = hasError
      ? 'border-error-500 focus:border-error-600 focus:ring-error-500/20'
      : 'border-gray-300 focus:border-vh-red focus:ring-vh-red/20';

    const paddingStyles = leftIcon ? 'pl-11' : rightIcon ? 'pr-11' : '';

    const containerWidth = fullWidth ? 'w-full' : '';

    return (
      <div className={`${containerWidth}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${baseInputStyles} ${borderStyles} ${paddingStyles} ${className}`.trim()}
            {...props}
          />
          {rightIcon && !hasError && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
          {hasError && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-error-500">
              <AlertCircle size={20} />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-error-600 flex items-center gap-1">
            <AlertCircle size={14} />
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="mt-2 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

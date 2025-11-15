import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    const baseTextareaStyles = 'block w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-4 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 resize-y min-h-[100px]';

    const borderStyles = hasError
      ? 'border-error-500 focus:border-error-600 focus:ring-error-500/20'
      : 'border-gray-300 focus:border-vh-red focus:ring-vh-red/20';

    const containerWidth = fullWidth ? 'w-full' : '';

    return (
      <div className={`${containerWidth}`}>
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            id={textareaId}
            className={`${baseTextareaStyles} ${borderStyles} ${className}`.trim()}
            {...props}
          />
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

Textarea.displayName = 'Textarea';

export default Textarea;

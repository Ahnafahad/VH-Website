import React from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options?: { value: string; label: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      options = [],
      className = '',
      id,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    const baseSelectStyles = 'block w-full rounded-lg border bg-white px-4 py-3 pr-11 text-base text-gray-900 transition-all duration-200 focus:outline-none focus:ring-4 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 appearance-none cursor-pointer';

    const borderStyles = hasError
      ? 'border-error-500 focus:border-error-600 focus:ring-error-500/20'
      : 'border-gray-300 focus:border-vh-red focus:ring-vh-red/20';

    const containerWidth = fullWidth ? 'w-full' : '';

    return (
      <div className={`${containerWidth}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`${baseSelectStyles} ${borderStyles} ${className}`.trim()}
            {...props}
          >
            {children || options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <ChevronDown size={20} />
          </div>
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

Select.displayName = 'Select';

export default Select;

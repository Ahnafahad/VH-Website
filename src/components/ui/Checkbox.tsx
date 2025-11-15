import React from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, helperText, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-start gap-3">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-gray-300 bg-white transition-all checked:border-vh-red checked:bg-vh-red hover:border-vh-red focus:outline-none focus:ring-4 focus:ring-vh-red/20 disabled:cursor-not-allowed disabled:opacity-50"
            {...props}
          />
          <Check
            size={14}
            className="pointer-events-none absolute text-white opacity-0 transition-opacity peer-checked:opacity-100"
            strokeWidth={3}
          />
        </div>
        {(label || helperText) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={checkboxId}
                className="cursor-pointer text-sm font-medium text-gray-900 select-none"
              >
                {label}
              </label>
            )}
            {helperText && (
              <p className="text-sm text-gray-500 mt-0.5">{helperText}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;

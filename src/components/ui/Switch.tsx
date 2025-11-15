import React from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, helperText, className = '', id, ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-start gap-3">
        <div className="relative inline-block mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            className="peer sr-only"
            {...props}
          />
          <label
            htmlFor={switchId}
            className="block h-6 w-11 cursor-pointer rounded-full bg-gray-300 transition-all peer-checked:bg-vh-red peer-focus:ring-4 peer-focus:ring-vh-red/20 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          >
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm" />
          </label>
        </div>
        {(label || helperText) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={switchId}
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

Switch.displayName = 'Switch';

export default Switch;

'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'full';
  showCloseButton?: boolean;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  position = 'right',
  size = 'md',
  showCloseButton = true,
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    left: {
      sm: 'w-80',
      md: 'w-96',
      lg: 'w-[32rem]',
      full: 'w-full',
    },
    right: {
      sm: 'w-80',
      md: 'w-96',
      lg: 'w-[32rem]',
      full: 'w-full',
    },
    top: {
      sm: 'h-64',
      md: 'h-80',
      lg: 'h-96',
      full: 'h-full',
    },
    bottom: {
      sm: 'h-64',
      md: 'h-80',
      lg: 'h-96',
      full: 'h-full',
    },
  };

  const positionStyles = {
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
  };

  const animationStyles = {
    left: 'animate-in slide-in-from-left duration-300',
    right: 'animate-in slide-in-from-right duration-300',
    top: 'animate-in slide-in-from-top duration-300',
    bottom: 'animate-in slide-in-from-bottom duration-300',
  };

  const drawerContent = (
    <div className="fixed inset-0 z-[1050]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={`absolute ${positionStyles[position]} ${sizeStyles[position][size]} bg-white shadow-2xl flex flex-col ${animationStyles[position]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        aria-describedby={description ? 'drawer-description' : undefined}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-6 border-b border-gray-200">
            <div className="flex-1">
              {title && (
                <h2 id="drawer-title" className="text-2xl font-bold text-gray-900">
                  {title}
                </h2>
              )}
              {description && (
                <p id="drawer-description" className="mt-2 text-gray-600">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

export default Drawer;

// Drawer subcomponents for better composition
export const DrawerFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 ${className}`}
    {...props}
  >
    {children}
  </div>
);

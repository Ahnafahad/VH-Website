'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle size={20} className="text-success-600" />,
    error: <AlertCircle size={20} className="text-error-600" />,
    warning: <AlertTriangle size={20} className="text-warning-600" />,
    info: <Info size={20} className="text-info-600" />,
  };

  const colors = {
    success: 'bg-success-50 border-success-200 text-success-900',
    error: 'bg-error-50 border-error-200 text-error-900',
    warning: 'bg-warning-50 border-warning-200 text-warning-900',
    info: 'bg-info-50 border-info-200 text-info-900',
  };

  const toastContainer =
    typeof window !== 'undefined'
      ? createPortal(
          <div
            className="fixed top-4 right-4 z-[1070] flex flex-col gap-3 pointer-events-none"
            aria-live="polite"
            aria-atomic="true"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`pointer-events-auto min-w-[320px] max-w-md rounded-xl border-2 p-4 shadow-xl animate-in slide-in-from-top-5 duration-300 ${colors[toast.type]}`}
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{toast.title}</p>
                    {toast.description && (
                      <p className="mt-1 text-sm opacity-90">{toast.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="flex-shrink-0 p-1 hover:bg-black/10 rounded-lg transition-colors"
                    aria-label="Close notification"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {toastContainer}
    </ToastContext.Provider>
  );
};

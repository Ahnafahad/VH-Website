'use client';

import React, { useState, createContext, useContext } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  openItems: string[];
  toggleItem: (value: string) => void;
  type: 'single' | 'multiple';
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

export interface AccordionProps {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  children: React.ReactNode;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  type = 'single',
  defaultValue,
  children,
  className = '',
}) => {
  const [openItems, setOpenItems] = useState<string[]>(
    Array.isArray(defaultValue)
      ? defaultValue
      : defaultValue
      ? [defaultValue]
      : []
  );

  const toggleItem = (value: string) => {
    setOpenItems((prev) => {
      if (type === 'single') {
        return prev.includes(value) ? [] : [value];
      } else {
        return prev.includes(value)
          ? prev.filter((item) => item !== value)
          : [...prev, value];
      }
    });
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem, type }}>
      <div className={`space-y-2 ${className}`}>{children}</div>
    </AccordionContext.Provider>
  );
};

export interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  value,
  children,
  className = '',
}) => {
  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const AccordionTrigger: React.FC<AccordionTriggerProps> = ({
  value,
  className = '',
  children,
  ...props
}) => {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionTrigger must be used within Accordion');

  const isOpen = context.openItems.includes(value);

  return (
    <button
      type="button"
      onClick={() => context.toggleItem(value)}
      className={`flex items-center justify-between w-full px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-vh-red/30 ${className}`}
      aria-expanded={isOpen}
      {...props}
    >
      <span>{children}</span>
      <ChevronDown
        size={20}
        className={`flex-shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
  );
};

export interface AccordionContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const AccordionContent: React.FC<AccordionContentProps> = ({
  value,
  children,
  className = '',
}) => {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionContent must be used within Accordion');

  const isOpen = context.openItems.includes(value);

  if (!isOpen) return null;

  return (
    <div
      className={`px-6 py-4 border-t border-gray-200 bg-gray-50 animate-in slide-in-from-top-2 duration-200 ${className}`}
    >
      {children}
    </div>
  );
};

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 200; // approximate
    const tooltipHeight = 40; // approximate
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  const clonedChild = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: () => setIsVisible(true),
    onMouseLeave: () => setIsVisible(false),
    onFocus: () => setIsVisible(true),
    onBlur: () => setIsVisible(false),
  });

  const tooltipContent =
    isVisible && typeof window !== 'undefined'
      ? createPortal(
          <div
            className="fixed z-[1070] px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-lg animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {clonedChild}
      {tooltipContent}
    </>
  );
};

export default Tooltip;

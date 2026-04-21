'use client';

import React from 'react';
import WorkbookSidebar from '@/components/workbook/Sidebar';
import type { WorkbookProgressStatus } from '@/lib/workbook/types';
import { Menu, X } from 'lucide-react';

interface WorkbookShellClientProps {
  children: React.ReactNode;
  initialProgress: Record<string, WorkbookProgressStatus>;
}

// Shared progress context so child pages can update progress
export const WorkbookProgressContext = React.createContext<{
  progressMap: Record<string, WorkbookProgressStatus>;
  updateProgress: (slug: string, status: WorkbookProgressStatus) => void;
}>({ progressMap: {}, updateProgress: () => {} });

export function useWorkbookProgress() {
  return React.useContext(WorkbookProgressContext);
}

export default function WorkbookShellClient({ children, initialProgress }: WorkbookShellClientProps) {
  const [progressMap, setProgressMap] = React.useState(initialProgress);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  function updateProgress(slug: string, status: WorkbookProgressStatus) {
    setProgressMap(prev => ({ ...prev, [slug]: status }));
  }

  return (
    <WorkbookProgressContext.Provider value={{ progressMap, updateProgress }}>
      <div className="wb-shell-inner">
        {/* Mobile header */}
        <header className="wb-mobile-header">
          <button
            className="wb-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="wb-mobile-title">Workbook</span>
        </header>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="wb-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`wb-sidebar-wrap ${sidebarOpen ? 'wb-sidebar-wrap--open' : ''}`}>
          <button
            className="wb-sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
          <WorkbookSidebar
            progressMap={progressMap}
            onClose={() => setSidebarOpen(false)}
          />
        </aside>

        {/* Main content */}
        <main className="wb-main">
          {children}
        </main>
      </div>
    </WorkbookProgressContext.Provider>
  );
}

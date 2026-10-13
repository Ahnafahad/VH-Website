'use client';

/**
 * HtmlMaterialViewer — shows an instructor-uploaded HTML material.
 *
 * The file is untrusted, so it renders in a sandboxed iframe (no allow-same-origin →
 * opaque origin, no access to the student's session). The serving route also sends a
 * matching CSP `sandbox`, so the protection holds even if the URL is opened directly.
 */

import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { trackFeature } from '@/lib/analytics/tracker';
import { HTML_MATERIAL_SANDBOX } from '@/lib/lms/html-material';

interface Props {
  materialId: number;
  title: string;
}

export default function HtmlMaterialViewer({ materialId, title }: Props) {
  useEffect(() => {
    trackFeature('material_opened', 'lms', { materialId, type: 'html' });
  }, [materialId]);

  return (
    <div className="flex flex-col h-dvh bg-[#F2EBE3] overflow-hidden">
      <header className="flex items-center gap-3 px-3 sm:px-5 py-3 bg-white/95 border-b border-[#E8DDD5] flex-shrink-0">
        <a
          href="/dashboard"
          className="flex min-h-11 items-center gap-1.5 px-2 -ml-2 rounded-lg text-xs font-medium text-[#A86E58] hover:text-[#5A0B0F] hover:bg-[#FAF5EF] transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </a>
        <div className="w-px h-5 bg-[#E8DDD5] flex-shrink-0" />
        <h1 className="font-heading text-[15px] sm:text-base font-medium tracking-[-0.01em] text-[#1A0507] truncate">
          {title}
        </h1>
      </header>
      <iframe
        title={title}
        src={`/api/lms/materials/${materialId}/html`}
        sandbox={HTML_MATERIAL_SANDBOX}
        referrerPolicy="no-referrer"
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}

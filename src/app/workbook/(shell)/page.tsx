import Link from 'next/link';
import { WORKBOOK_PARTS, getAllChapters } from '@/lib/workbook/chapters';
import { BookOpen, Clock, ChevronRight, Sparkles } from 'lucide-react';

export default function WorkbookDashboard() {
  const allChapters = getAllChapters();
  const firstChapter = allChapters[0];

  return (
    <div className="wb-dashboard">
      {/* Hero */}
      <div className="wb-hero">
        <div className="wb-hero-eyebrow">
          <Sparkles size={14} />
          <span>Beyond the Horizons</span>
        </div>
        <h1 className="wb-hero-title">IBA/BUP Admission Workbook</h1>
        <p className="wb-hero-subtitle">
          Your structured study companion for DU IBA, BUP IBA, DU FBS, and BUP FBS.
          Work through each chapter, track your progress, and practise with exam-style questions.
        </p>

        {firstChapter && (
          <Link
            href={`/workbook/${firstChapter.partSlug}/${firstChapter.slug}`}
            className="wb-start-btn"
          >
            <BookOpen size={16} />
            Start reading
          </Link>
        )}
      </div>

      {/* Parts grid */}
      <div className="wb-parts-grid">
        {WORKBOOK_PARTS.map(part => (
          <div key={part.slug} className="wb-part-card">
            <h2 className="wb-part-card-title">{part.title}</h2>

            {part.chapters.length === 0 ? (
              <p className="wb-part-coming-soon">Chapters coming soon</p>
            ) : (
              <ul className="wb-part-chapters">
                {part.chapters.map(ch => (
                  <li key={ch.slug}>
                    <Link
                      href={`/workbook/${ch.partSlug}/${ch.slug}`}
                      className="wb-part-chapter-link"
                    >
                      <div className="wb-part-chapter-info">
                        <span className="wb-part-chapter-num">Ch. {ch.chapterNumber}</span>
                        <span className="wb-part-chapter-name">{ch.title}</span>
                      </div>
                      <div className="wb-part-chapter-meta">
                        <Clock size={11} />
                        <span>{ch.estimatedMinutes} min</span>
                        <ChevronRight size={13} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Dev notice */}
      <div className="wb-dev-notice">
        <p>🚧 <strong>Preview mode</strong> — visible to super admin only. More chapters being added.</p>
      </div>
    </div>
  );
}

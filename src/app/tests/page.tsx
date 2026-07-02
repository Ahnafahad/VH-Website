import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';

export const metadata = { title: 'Online Tests — VH' };

export default async function TestsHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      {/* Masthead */}
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">
            Examination Hall
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">
            Online Tests
          </h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            Timed, proctored mock exams for IBA and DU FBS. Your answers are autosaved.
          </p>
        </div>
      </div>

      {/* Bucket cards */}
      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <BucketCard
            href="/tests/iba"
            label="IBA"
            fullName="Institute of Business Administration"
            university="University of Dhaka"
            description="Full-length IBA DU and IBA BUP mock tests — language, math, and analytical sections."
            accent="#9A1B20"
            glyph="Ⅰ"
          />
          <BucketCard
            href="/tests/du-fbs"
            label="DU FBS"
            fullName="Faculty of Business Studies"
            university="University of Dhaka"
            description="DU FBS mock tests — accounting, business studies, and general English sections."
            accent="#C8A24B"
            glyph="Ⅱ"
          />
        </div>
      </div>
    </main>
  );
}

function BucketCard({
  href,
  label,
  fullName,
  university,
  description,
  accent,
  glyph,
}: {
  href: string;
  label: string;
  fullName: string;
  university: string;
  description: string;
  accent: string;
  glyph: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-exam-surface border border-exam-border rounded-2xl overflow-hidden
        hover:border-exam-gold/50 transition-colors duration-200"
    >
      {/* Top accent stripe */}
      <div className="h-1.5" style={{ background: accent }} />

      <div className="p-6 sm:p-8">
        {/* Glyph seal */}
        <div
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center
            font-serif text-xl font-semibold mb-5 transition-transform duration-200 group-hover:scale-105"
          style={{ borderColor: accent, color: accent }}
        >
          {glyph}
        </div>

        <p className="text-exam-ink-faint text-xs uppercase tracking-widest mb-1">{university}</p>
        <h2 className="text-exam-ink font-serif text-2xl font-semibold mb-0.5">{label}</h2>
        <p className="text-exam-ink-muted text-xs mb-4">{fullName}</p>
        <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">{description}</p>

        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
          View tests
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  );
}

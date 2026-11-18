'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { DIAGNOSIS_LABELS, type StudentReport } from '@/lib/mocks/student-report';
import type { ReportStudentOption } from '@/lib/mocks/student-report-data';
import {
  PageHeader, FieldInput, FieldLabel, FieldSelect, GhostBtn,
  BORDER, MUTED, OK, OK_BG, RED, R_LG, R_PILL, SLATE, SURFACE, SURFACE_ALT, WARN, WARN_BG,
} from './lms-shared';

type ReportSection = StudentReport['sections'][number];
type MockSummary = StudentReport['mocks'][number];

const endpoint = '/api/admin/mocks/reports';
const number = (value: number | null) => value === null ? '—' : String(Number(value.toFixed(2)));
const percent = (ratio: number | null) => ratio === null ? '—' : `${number(ratio * 100)}%`;
const compare = (a: number | null, b: number | null) => `${number(a)} / ${number(b)}`;
const compareRate = (a: number | null, b: number | null) => `${percent(a)} / ${percent(b)}`;
const thirdLabels = ['First', 'Middle', 'Last'];
const mockTitle = (mock: MockSummary) => mock.examCode ? `${mock.title} (${mock.examCode})` : mock.title;

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

function ReportTable({ caption, columns, rows, highlights }: {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
  highlights?: boolean[];
}) {
  return (
    <div className="mock-report-table">
      <table>
        <caption>{caption}</caption>
        <thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>
          {rows.map(([label, ...cells], i) => (
            <tr key={i} className={highlights?.[i] ? 'mock-report-weak' : undefined}>
              <th scope="row">{label}</th>
              {cells.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendLine({ trend }: { trend: StudentReport['totalTrend'] }) {
  return (
    <p className="mock-report-meta">
      Mean {number(trend.mean)} · Standard deviation {number(trend.standardDeviation)} · Trend {number(trend.slope)} marks per mock
    </p>
  );
}

function SectionBlock({ section, mocks }: { section: ReportSection; mocks: Map<number, MockSummary> }) {
  const title = section.mocks[0].title;
  return (
    <section className="mock-report-panel">
      <h2>{title}</h2>
      <TrendLine trend={section.trend} />
      <ReportTable
        caption="Trend · student / top five"
        columns={['Mock', 'Net', 'Tried', 'Right', 'Wrong', 'Blank', 'Accuracy', 'Pass mark']}
        rows={section.mocks.map(entry => [
          mockTitle(mocks.get(entry.mockId)!),
          compare(entry.stats.net, entry.topFive.net),
          compare(entry.stats.attempted, entry.topFive.attempted),
          compare(entry.stats.correct, entry.topFive.correct),
          compare(entry.stats.wrong, entry.topFive.wrong),
          compare(entry.stats.blank, entry.topFive.blank),
          compareRate(entry.stats.accuracy, entry.topFive.accuracy),
          entry.belowPassMark
            ? <span style={{ color: WARN }}>Below {number(entry.passMark)}</span>
            : number(entry.passMark),
        ])}
      />
      <ReportTable
        caption="Gap to the top five"
        columns={['Mock', 'From attempts', 'From accuracy', 'Total gap', 'Formula top-five net']}
        rows={section.mocks.map(entry => [
          mockTitle(mocks.get(entry.mockId)!), number(entry.gap.volumeMarks), number(entry.gap.precisionMarks),
          number(entry.gap.netGap), number(entry.gap.formulaTopNet),
        ])}
      />
      <ReportTable
        caption="Topics across mocks · weakest tags highlighted"
        columns={['Tag', 'Seen', 'Tried', 'Right', 'Wrong', 'Accuracy', 'Coverage', 'Cohort', 'Top five', 'Marks lost']}
        rows={section.tags.map(tag => [
          tag.tag, tag.seen, tag.attempted, tag.correct, tag.wrong, percent(tag.accuracy),
          percent(tag.coverage), percent(tag.cohortCoverage), percent(tag.topFiveCoverage), number(tag.marksLost),
        ])}
        highlights={section.tags.map(tag => section.weakestTags.includes(tag.tag))}
      />
      {section.strongestTags.length > 0 && <p className="mock-report-meta">Strongest tags relative to the cohort · {section.strongestTags.join(' · ')}</p>}
      {section.mocks.map((entry, i) => {
        const mock = mocks.get(entry.mockId)!;
        return (
          <section className="mock-report-detail" key={i}>
            <h3>{mockTitle(mock)}{entry.title === title ? '' : ` · ${entry.title}`}</h3>
            {entry.diagnoses.length > 0 && (
              <ul className="mock-report-list">
                {entry.diagnoses.map(diagnosis => (
                  <li key={diagnosis.label}>
                    <strong>{DIAGNOSIS_LABELS[diagnosis.label]}</strong> · {number(diagnosis.marksAtStake)} marks at stake.
                    {' '}{diagnosis.explanation}
                  </li>
                ))}
              </ul>
            )}
            <ReportTable
              caption="Difficulty · student / top five"
              columns={['Band', 'Questions', 'Tried', 'Right', 'Wrong', 'Accuracy']}
              rows={entry.bands.map(band => [
                band.band, band.stats.questions, compare(band.stats.attempted, band.topFive.attempted),
                compare(band.stats.correct, band.topFive.correct), compare(band.stats.wrong, band.topFive.wrong),
                compareRate(band.stats.accuracy, band.topFive.accuracy),
              ])}
            />
            <ReportTable
              caption="By position in the section"
              columns={['Third', 'Questions', 'Accuracy', 'Blank']}
              rows={entry.thirds.map(third => [
                thirdLabels[third.third - 1], third.stats.questions, percent(third.stats.accuracy), third.stats.blank,
              ])}
            />
            {entry.passages.length > 0 && (
              <ReportTable
                caption="Reading comprehension"
                columns={['Passage', 'Right / total']}
                rows={entry.passages.map((passage, index) => [
                  passage.title || `Passage ${index + 1}`, compare(passage.correct, passage.total),
                ])}
              />
            )}
            <ReportTable
              caption="Marks left on the table"
              columns={['Easy marks missed', 'Hard guess penalty', 'Hard guess net']}
              rows={[[number(entry.easyMissMarks), number(entry.hardGuessPenalty), number(entry.hardGuessNet)]]}
            />
            <h4>Questions to review</h4>
            <p><strong>Easy misses</strong> · {entry.easyMissed.map(item => `Q${item.number} (${percent(item.p)} right)`).join(', ') || 'None'}</p>
            <p><strong>Common wrong options picked</strong> · {entry.trapWrong.map(item => `Q${item.number} (${item.option})`).join(', ') || 'None'}</p>
          </section>
        );
      })}
    </section>
  );
}

function Report({ report }: { report: StudentReport }) {
  const mocks = new Map(report.mocks.map(mock => [mock.id, mock]));
  return (
    <article className="mock-report-paper">
      <header className="mock-report-panel">
        <h2>{report.student.name}</h2>
        <p className="mock-report-meta">
          Student ID {report.student.studentId ?? '—'} · {report.mocks.length} {report.mocks.length === 1 ? 'mock' : 'mocks'} sat
        </p>
        <TrendLine trend={report.totalTrend} />
        <ReportTable
          caption="Total trend and rank if all easy misses were correct"
          columns={['Mock', 'Mode', 'Net', 'Rank', 'Percentile', 'Easy marks missed', 'What-if net', 'What-if rank']}
          rows={report.mocks.map(mock => [
            mockTitle(mock),
            <span key="mode" className={`mock-report-mode mock-report-${mock.mode}`}>{mock.mode}</span>,
            number(mock.net), `${mock.rank} / ${mock.cohortSize}`, `${number(mock.percentile)}%`,
            number(mock.easyMissMarks), number(mock.whatIfNet), `${mock.whatIfRank} / ${mock.cohortSize}`,
          ])}
        />
      </header>
      <section className="mock-report-panel">
        <h2>Main problems</h2>
        <ul className="mock-report-list">
          {report.sections.map(section => {
            const problem = section.mainProblem;
            return (
              <li key={section.kind}>
                <strong>{section.mocks[0].title}</strong> · {problem
                  ? `${DIAGNOSIS_LABELS[problem.label]} · ${problem.recurring ? 'Recurring' : 'Occasional'} (${problem.mocksFired}/${report.mocks.length} mocks) · ${number(problem.marksAtStake)} marks at stake`
                  : 'No diagnosis triggered'}
              </li>
            );
          })}
        </ul>
      </section>
      {report.sections.map(section => <SectionBlock key={section.kind} section={section} mocks={mocks} />)}
      {report.actionPlan.length > 0 && (
        <section className="mock-report-panel">
          <h2>Action plan</h2>
          <ul className="mock-report-list">{report.actionPlan.map((step, i) => <li key={i}>{step}</li>)}</ul>
        </section>
      )}
    </article>
  );
}

export default function MockReportsClient() {
  const [students, setStudents] = useState<ReportStudentOption[] | null>(null);
  const [listError, setListError] = useState('');
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [report, setReport] = useState<StudentReport | null>(null);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const request = new AbortController();
    void fetchJson<ReportStudentOption[]>(endpoint, request.signal).then(setStudents).catch(error => {
      if (!request.signal.aborted) setListError(error.message);
    });
    return () => request.abort();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const request = new AbortController();
    void fetchJson<StudentReport>(`${endpoint}?userId=${userId}`, request.signal).then(result => {
      if (!request.signal.aborted) setReport(result);
    }).catch(error => {
      if (!request.signal.aborted) setReportError(error.message);
    });
    return () => request.abort();
  }, [userId]);

  const choose = (id: string) => {
    setUserId(id);
    setReport(null);
    setReportError('');
  };
  const terms = query.trim().toLowerCase().split(/\s+/);
  const filtered = students?.filter(student => {
    const text = `${student.name} ${student.studentId ?? ''}`.toLowerCase();
    return student.id.toString() === userId || terms.every(term => text.includes(term));
  });

  return (
    <div className="mock-report">
      <style>{reportCss}</style>
      <div className="mock-report-controls">
        <PageHeader title="Mock Reports" action={<GhostBtn small disabled={!report} onClick={() => window.print()}>Print</GhostBtn>} />
        <Link href="/admin/mocks" style={{ color: MUTED, fontSize: 13 }}>Back to mocks</Link>
        <div className="mock-report-picker">
          <div>
            <FieldLabel htmlFor="report-search">Search students</FieldLabel>
            <FieldInput id="report-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or student ID" />
          </div>
          <div>
            <FieldLabel htmlFor="report-student">Student</FieldLabel>
            <FieldSelect id="report-student" value={userId} disabled={!filtered?.length} onChange={event => choose(event.target.value)}>
              <option value="">{students ? 'Choose a student…' : listError ? 'Students unavailable' : 'Loading students…'}</option>
              {filtered?.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name}{student.studentId ? ` · ${student.studentId}` : ''} · {student.mocksSat} {student.mocksSat === 1 ? 'mock' : 'mocks'}
                </option>
              ))}
            </FieldSelect>
          </div>
        </div>
        {(listError || reportError) && <p role="alert" style={{ color: RED }}>{listError || reportError}</p>}
        {students && !filtered?.length && <p role="status">No matching students.</p>}
        {userId && !report && !reportError && <p role="status">Loading report…</p>}
      </div>
      {report && <Report report={report} />}
    </div>
  );
}

const reportCss = `
  #admin-main:has(.mock-report) { min-width: 0; }
  .mock-report { max-width: 1100px; margin: 0 auto; color: ${SLATE}; font-size: 13px; }
  .mock-report-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr)); gap: 12px; margin: 12px 0 18px; }
  .mock-report-paper { display: grid; gap: 16px; }
  .mock-report-panel { padding: 16px; border: 1px solid ${BORDER}; border-radius: ${R_LG}px; background: ${SURFACE}; min-width: 0; }
  .mock-report h2 { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
  .mock-report h3 { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
  .mock-report h4 { margin: 10px 0 3px; font-weight: 700; }
  .mock-report-meta { color: ${MUTED}; margin: 0 0 8px; }
  .mock-report-detail { border-top: 1px solid ${BORDER}; margin-top: 14px; padding-top: 12px; }
  .mock-report-list { margin: 4px 0; padding-left: 18px; list-style: disc; }
  .mock-report-list li + li { margin-top: 4px; }
  .mock-report-table { overflow-x: auto; margin-bottom: 10px; }
  .mock-report-table:last-child { margin-bottom: 0; }
  .mock-report table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  .mock-report caption { text-align: left; font-weight: 700; padding: 3px 0; }
  .mock-report th, .mock-report td { text-align: left; padding: 4px 6px; border-bottom: 1px solid ${BORDER}; }
  .mock-report thead { background: ${SURFACE_ALT}; color: ${MUTED}; }
  .mock-report tbody th { font-weight: 600; }
  .mock-report td { white-space: nowrap; }
  .mock-report-weak { background: ${WARN_BG}; }
  .mock-report-mode { display: inline-block; border-radius: ${R_PILL}px; padding: 1px 7px; text-transform: capitalize; font-weight: 600; }
  .mock-report-offline { color: ${OK}; background: ${OK_BG}; }
  .mock-report-online { color: ${SLATE}; background: ${SURFACE_ALT}; }
  @media print {
    body:has(.mock-report) :is(aside, #admin-mobile-header, #admin-bottom-bar, #admin-more-sheet, .mock-report-controls),
    body:has(.mock-report) #admin-main > div > [role="status"] { display: none !important; }
    body:has(.mock-report) #admin-main { margin: 0 !important; padding: 0 !important; min-height: 0 !important; }
    body:has(.mock-report) #admin-main > div { padding: 0 !important; }
    .mock-report { max-width: none; font-size: 9pt; print-color-adjust: exact; }
    .mock-report-paper { display: block; }
    .mock-report-panel { margin-bottom: 10pt; padding: 8pt; }
    .mock-report h2, .mock-report h3, .mock-report h4, .mock-report caption { break-after: avoid; }
    .mock-report-table { overflow: visible; }
    .mock-report tr, .mock-report li { break-inside: avoid; }
    .mock-report th, .mock-report td { padding: 2pt 3pt; white-space: normal; }
  }
`;

'use client';

import StatCard from './StatCard';
import ChartCard from './ChartCard';
import BarList from './BarList';

interface LmsData {
  activeLearners: number;
  pageviews: number;
  reliableVisibleMs: number;
  excludedDurationEvents: number;
  pdfOpens: number;
  pdfFailures: number;
  pdfFailureRate: number;
  pdfDownloads: number;
  pdfRetries: number;
  materialUploads: number;
  classesCreated: number;
  classesJoined: number;
  joinFailures: number;
  assignmentsSubmitted: number;
  inventory: {
    materials: number;
    classes: number;
    submissions: number;
    recordingProgress: number;
  };
  topPaths: Array<{ path: string; views: number }>;
}

function durationLabel(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

export default function LmsPanel({ data }: { data: LmsData }) {
  const pathItems = data.topPaths.map(item => ({ label: item.path, value: item.views }));
  const workflowItems = [
    { label: 'PDF opens', value: data.pdfOpens },
    { label: 'PDF downloads', value: data.pdfDownloads },
    { label: 'PDF retries', value: data.pdfRetries },
    { label: 'Materials uploaded', value: data.materialUploads },
    { label: 'Classes created', value: data.classesCreated },
    { label: 'Classes joined', value: data.classesJoined },
    { label: 'Join failures', value: data.joinFailures },
    { label: 'Assignments submitted', value: data.assignmentsSubmitted },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <StatCard label="Active learners" value={data.activeLearners} sub="Distinct signed-in users or browsers" />
        <StatCard label="LMS page views" value={data.pageviews} />
        <StatCard label="Active time" value={durationLabel(data.reliableVisibleMs)} sub="Excludes implausible 4h+ page events" />
        <StatCard
          label="PDF failure rate"
          value={`${data.pdfFailureRate}%`}
          sub={`${data.pdfFailures} failed loads from ${data.pdfOpens} opens`}
          accent={data.pdfFailures > 0}
        />
      </div>

      {data.excludedDurationEvents > 0 && (
        <div role="status" style={{ padding: '12px 14px', border: '1px solid #FDE68A', borderRadius: 10, background: '#FFFBEB', color: '#92400E', fontSize: 13, lineHeight: 1.5 }}>
          {data.excludedDurationEvents} unusually long page event{data.excludedDurationEvents === 1 ? ' was' : 's were'} excluded so active-time reporting stays trustworthy.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <ChartCard title="Learning-material workflow" sub="Actions completed in the selected date range" empty={workflowItems.every(item => item.value === 0)} emptyNote="LMS action tracking starts with this release.">
          <BarList items={workflowItems} accent="#760F13" valueFormat={value => value.toLocaleString()} />
        </ChartCard>
        <ChartCard title="Most-used LMS pages" sub="Page views in the selected date range" empty={pathItems.length === 0} emptyNote="No LMS page views have been recorded in this range.">
          <BarList items={pathItems} accent="#A86E58" valueFormat={value => `${value} views`} />
        </ChartCard>
      </div>

      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15, color: '#111827' }}>Current LMS records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <StatCard label="Materials" value={data.inventory.materials} />
          <StatCard label="Classes" value={data.inventory.classes} />
          <StatCard label="Submissions" value={data.inventory.submissions} />
          <StatCard label="Recording progress" value={data.inventory.recordingProgress} />
        </div>
      </div>
    </div>
  );
}
